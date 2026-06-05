import logging
from datetime import datetime, timedelta

from app.config import settings
from app.services.api_client import get_json

logger = logging.getLogger(__name__)

FORECAST_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"]

PTY_LABELS = {
    "0": "없음",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
    "5": "빗방울",
    "6": "빗방울/눈날림",
    "7": "눈날림",
}

SKY_LABELS = {
    "1": "맑음",
    "3": "구름많음",
    "4": "흐림",
}

DAY_LABELS = ["오늘", "내일", "모레"]
WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"]


def get_latest_base_datetime() -> tuple[str, str]:
    now = datetime.now()
    base_date = now.strftime("%Y%m%d")

    for base_time in reversed(FORECAST_BASE_TIMES):
        hour = int(base_time[:2])
        minute = int(base_time[2:])
        published_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if published_at <= now:
            return base_date, base_time

    yesterday = (now - timedelta(days=1)).strftime("%Y%m%d")
    return yesterday, "2300"


async def fetch_weather_forecast(nx: int, ny: int) -> list[dict]:
    if not settings.public_data_api_key:
        raise ValueError("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.")

    base_date, base_time = get_latest_base_datetime()
    params = {
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
        "numOfRows": "1000",
        "pageNo": "1",
    }

    payload = await get_json(settings.weather_api_url, params)
    header = payload.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        message = header.get("resultMsg", "알 수 없는 오류")
        logger.error("기상청 API 오류: %s", message)
        raise RuntimeError(f"기상청 API 오류: {message}")

    items = payload.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    return items or []


def _is_am(time: str) -> bool:
    return "0600" <= time < "1200"


def _is_pm(time: str) -> bool:
    return "1200" <= time <= "2100"


def parse_forecast_items(items: list[dict]) -> dict:
    timeline: dict[str, dict] = {}
    daily_meta: dict[str, dict[str, int]] = {}

    for item in items:
        date = item["fcstDate"]
        category = item["category"]
        if category in {"TMN", "TMX"}:
            daily_meta.setdefault(date, {})[category] = int(float(item["fcstValue"]))
            continue

        key = f"{date}{item['fcstTime']}"
        timeline.setdefault(key, {})
        timeline[key][category] = item["fcstValue"]

    sorted_keys = sorted(timeline.keys())
    hours: list[dict] = []

    for key in sorted_keys:
        data = timeline[key]
        hours.append(
            {
                "datetime": key,
                "date": key[:8],
                "time": key[8:],
                "pop": int(data.get("POP", "0") or "0"),
                "pty": data.get("PTY", "0"),
                "pty_label": PTY_LABELS.get(data.get("PTY", "0"), "알 수 없음"),
                "sky": data.get("SKY", "1"),
                "sky_label": SKY_LABELS.get(data.get("SKY", "1"), "알 수 없음"),
                "tmp": int(float(data["TMP"])) if data.get("TMP") else None,
            }
        )

    return {"hours": hours, "daily_meta": daily_meta}


def _weather_icon(sky: str, pty: str) -> str:
    if pty in {"1", "4", "5"}:
        return "rain"
    if pty in {"3", "6", "7"}:
        return "sleet"
    if pty == "2":
        return "rain_snow"
    if sky == "4":
        return "cloudy"
    if sky == "3":
        return "partly_cloudy"
    return "sunny"


def _empty_period() -> dict:
    return {
        "pop": 0,
        "pop_display": "-",
        "tmp": None,
        "tmp_display": "-",
        "sky": "1",
        "pty": "0",
        "sky_label": "맑음",
        "pty_label": "없음",
        "weather_icon": "sunny",
    }


def _summarize_period(
    hours: list[dict],
    date: str,
    period: str,
    daily_meta: dict[str, dict[str, int]],
    *,
    is_today: bool = False,
) -> dict:
    now = datetime.now()
    if is_today and period == "am" and now.hour >= 12:
        return _empty_period()

    day_hours = [h for h in hours if h["date"] == date]
    slot_hours = [h for h in day_hours if _is_am(h["time"])] if period == "am" else [h for h in day_hours if _is_pm(h["time"])]
    meta = daily_meta.get(date, {})

    if not day_hours and not meta:
        return _empty_period()

    pop = max((h["pop"] for h in slot_hours), default=0)
    pop_display = "-" if not slot_hours or pop == 0 else f"{pop}%"

    if period == "am":
        tmp = meta.get("TMN")
        if tmp is None and slot_hours:
            temps = [h["tmp"] for h in slot_hours if h["tmp"] is not None]
            tmp = min(temps) if temps else None
    else:
        tmp = meta.get("TMX")
        if tmp is None and slot_hours:
            temps = [h["tmp"] for h in slot_hours if h["tmp"] is not None]
            tmp = max(temps) if temps else None

    if slot_hours:
        representative = sorted(slot_hours, key=lambda h: h["time"])[len(slot_hours) // 2]
    elif day_hours:
        representative = sorted(day_hours, key=lambda h: h["time"])[len(day_hours) // 2]
    else:
        representative = {"sky": "1", "pty": "0", "sky_label": "맑음", "pty_label": "없음"}

    sky = representative["sky"]
    pty = representative["pty"]
    if pop >= 60 and pty == "0" and sky in {"1", "3"}:
        sky = "4"

    return {
        "pop": pop,
        "pop_display": pop_display,
        "tmp": tmp,
        "tmp_display": "-" if tmp is None else f"{tmp}°C",
        "sky": sky,
        "pty": pty,
        "sky_label": SKY_LABELS.get(sky, representative["sky_label"]),
        "pty_label": representative["pty_label"],
        "weather_icon": _weather_icon(sky, pty),
    }


def build_kma_daily_forecast(hours: list[dict], daily_meta: dict[str, dict[str, int]]) -> list[dict]:
    """기상청 일별 예보 표 형식(오전/오후)으로 3일치를 구성합니다."""
    target_dates = [
        (datetime.now() + timedelta(days=i)).strftime("%Y%m%d") for i in range(3)
    ]

    columns: list[dict] = []
    for index, date in enumerate(target_dates):
        dt = datetime.strptime(date, "%Y%m%d")
        columns.append(
            {
                "label": DAY_LABELS[index],
                "date": date,
                "date_title": f"{dt.day}일({WEEKDAY_LABELS[dt.weekday()]})",
                "is_today": index == 0,
                "am": _summarize_period(hours, date, "am", daily_meta, is_today=index == 0),
                "pm": _summarize_period(hours, date, "pm", daily_meta, is_today=index == 0),
            }
        )
    return columns


def summarize_rain_forecast(hours: list[dict], daily_meta: dict[str, dict[str, int]] | None = None) -> dict:
    """오늘·내일·모레 강수예보를 집계합니다."""
    target_dates = [
        (datetime.now() + timedelta(days=i)).strftime("%Y%m%d") for i in range(3)
    ]

    days: list[dict] = []
    for index, date in enumerate(target_dates):
        day_hours = [h for h in hours if h["date"] == date]
        max_pop = max((h["pop"] for h in day_hours), default=0)
        has_rain = any(h["pty"] not in ("0", "") for h in day_hours)
        avg_pop = round(sum(h["pop"] for h in day_hours) / len(day_hours)) if day_hours else 0

        if max_pop >= 60 or has_rain:
            risk = "high"
            risk_label = "높음"
        elif max_pop >= 30:
            risk = "medium"
            risk_label = "보통"
        else:
            risk = "low"
            risk_label = "낮음"

        days.append(
            {
                "label": DAY_LABELS[index],
                "date": date,
                "max_pop": max_pop,
                "avg_pop": avg_pop,
                "has_rain": has_rain,
                "risk": risk,
                "risk_label": risk_label,
            }
        )

    max_values = [d["max_pop"] for d in days]
    return {
        "days": days,
        "kma_daily": build_kma_daily_forecast(hours, daily_meta or {}),
        "three_day_max_pop": max(max_values) if max_values else 0,
        "three_day_avg_pop": round(sum(max_values) / len(max_values)) if max_values else 0,
        "rainy_day_count": sum(1 for d in days if d["max_pop"] >= 40 or d["has_rain"]),
    }
