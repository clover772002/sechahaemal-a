import logging
from datetime import datetime, timedelta

import httpx

from app.config import settings
from app.services.api_client import get_json

logger = logging.getLogger(__name__)

WF_ICON_MAP = {
    "맑음": "sunny",
    "구름많음": "partly_cloudy",
    "흐림": "cloudy",
    "비": "rain",
    "눈": "sleet",
    "비/눈": "rain_snow",
    "소나기": "rain",
    "빗방울": "rain",
    "빗방울눈날림": "sleet",
}


def get_mid_tm_fc() -> str:
    """중기예보 최근 발표시각(06시/18시, 30분 버퍼)을 반환합니다."""
    now = datetime.now() - timedelta(minutes=30)
    if now.hour >= 18:
        return now.strftime("%Y%m%d") + "1800"
    if now.hour >= 6:
        return now.strftime("%Y%m%d") + "0600"
    return (now - timedelta(days=1)).strftime("%Y%m%d") + "1800"


def format_tm_fc(tm_fc: str) -> str:
    return f"{tm_fc[:4]}-{tm_fc[4:6]}-{tm_fc[6:8]} {tm_fc[8:10]}:{tm_fc[10:12]}"


def _mid_day_index(issue_date: str, target_date: str) -> int | None:
    """중기예보 필드 번호(rnSt4Am 등)를 계산합니다. 오늘은 None."""
    delta = (
        datetime.strptime(target_date, "%Y%m%d") - datetime.strptime(issue_date, "%Y%m%d")
    ).days
    if delta < 1:
        return None
    return delta + 3


def _wf_to_icon(wf: str, pop: int) -> str:
    icon = WF_ICON_MAP.get(wf.strip(), "partly_cloudy")
    if pop >= 60 and icon in {"sunny", "partly_cloudy"}:
        return "cloudy"
    if pop >= 60 and "비" in wf:
        return "rain"
    return icon


async def _fetch_mid_payload(url: str, reg_id: str, tm_fc: str) -> dict:
    params = {
        "dataType": "JSON",
        "pageNo": "1",
        "numOfRows": "10",
        "regId": reg_id,
        "tmFc": tm_fc,
    }
    payload = await get_json(url, params)
    header = payload.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        message = header.get("resultMsg", "알 수 없는 오류")
        raise RuntimeError(f"중기예보 API 오류: {message}")

    items = payload.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        return items
    if not items:
        raise RuntimeError("중기예보 응답이 비어 있습니다.")
    return items[0]


async def fetch_mid_forecast(land_reg_id: str, ta_reg_id: str) -> dict | None:
    if not settings.public_data_api_key:
        raise ValueError("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.")

    tm_fc = get_mid_tm_fc()
    issue_date = tm_fc[:8]

    try:
        land_item = await _fetch_mid_payload(settings.mid_land_api_url, land_reg_id, tm_fc)
        ta_item = await _fetch_mid_payload(settings.mid_ta_api_url, ta_reg_id, tm_fc)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 403:
            logger.warning(
                "중기예보 403: 활용신청 승인 대기 중이거나 동일 인증키에 미연동입니다. land=%s ta=%s",
                land_reg_id,
                ta_reg_id,
            )
            return None
        logger.exception("중기예보 API HTTP 오류")
        raise RuntimeError("중기예보 API 호출에 실패했습니다.") from exc
    except Exception as exc:
        logger.exception("중기예보 API 호출 실패")
        raise RuntimeError("중기예보 API 호출에 실패했습니다.") from exc

    return {
        "tm_fc": tm_fc,
        "tm_fc_display": format_tm_fc(tm_fc),
        "issue_date": issue_date,
        "land_reg_id": land_reg_id,
        "ta_reg_id": ta_reg_id,
        "land": land_item,
        "ta": ta_item,
    }


def _period_from_mid(
    mid_data: dict,
    target_date: str,
    period: str,
) -> dict | None:
    issue_date = mid_data["issue_date"]
    day_index = _mid_day_index(issue_date, target_date)
    if day_index is None:
        return None

    land = mid_data["land"]
    ta = mid_data["ta"]
    suffix = "Am" if period == "am" else "Pm"

    wf_key = f"wf{day_index}{suffix}"
    pop_key = f"rnSt{day_index}{suffix}"
    if wf_key not in land and pop_key not in land:
        return None

    wf = str(land.get(wf_key, "맑음"))
    pop_raw = land.get(pop_key)
    pop = int(pop_raw) if pop_raw is not None else 0
    pop_display = "-" if pop == 0 else f"{pop}%"

    if period == "am":
        tmp_key = f"taMin{day_index}"
    else:
        tmp_key = f"taMax{day_index}"

    tmp_raw = ta.get(tmp_key)
    tmp = int(float(tmp_raw)) if tmp_raw is not None else None

    return {
        "pop": pop,
        "pop_display": pop_display,
        "tmp": tmp,
        "tmp_display": "-" if tmp is None else f"{tmp}°C",
        "sky_label": wf,
        "pty_label": "없음",
        "weather_icon": _wf_to_icon(wf, pop),
        "source": "mid",
    }


def merge_period_forecast(
    short_period: dict,
    mid_data: dict | None,
    target_date: str,
    period: str,
    day_offset: int,
) -> dict:
    """단기+중기 병합. 오늘~4일차는 단기 우선, 빈 값은 중기로 보완. 5일차부터 중기."""
    if mid_data is None:
        return short_period

    mid_period = _period_from_mid(mid_data, target_date, period)

    if day_offset >= 4 and mid_period:
        return {**mid_period, "sky": "1", "pty": "0"}

    if day_offset <= 3:
        merged = dict(short_period)
        if not mid_period:
            return merged

        if merged.get("tmp_display") == "-" and mid_period.get("tmp") is not None:
            merged["tmp"] = mid_period["tmp"]
            merged["tmp_display"] = mid_period["tmp_display"]

        if merged.get("pop_display") == "-" and mid_period.get("pop_display") != "-":
            merged["pop"] = mid_period["pop"]
            merged["pop_display"] = mid_period["pop_display"]

        if merged.get("sky_label") in {None, "-", ""} and mid_period.get("sky_label"):
            merged["sky_label"] = mid_period["sky_label"]
            merged["weather_icon"] = mid_period["weather_icon"]

        return merged

    return mid_period or short_period


def merge_kma_daily_columns(
    short_columns: list[dict],
    mid_data: dict | None,
) -> list[dict]:
    if not mid_data:
        return short_columns

    merged_columns: list[dict] = []
    issue_date = mid_data["issue_date"]
    today = datetime.now().strftime("%Y%m%d")

    for index, column in enumerate(short_columns):
        target_date = column["date"]
        day_offset = (
            datetime.strptime(target_date, "%Y%m%d") - datetime.strptime(today, "%Y%m%d")
        ).days

        merged_columns.append(
            {
                **column,
                "am": merge_period_forecast(column["am"], mid_data, target_date, "am", day_offset),
                "pm": merge_period_forecast(column["pm"], mid_data, target_date, "pm", day_offset),
            }
        )

    return merged_columns
