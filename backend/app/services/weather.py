import logging
from datetime import datetime, timedelta

from app.config import settings
from app.services.api_client import get_json

logger = logging.getLogger(__name__)

FORECAST_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"]
AM_SLOT_TIME = "0600"
AM_POP_TIME = "0900"
PM_SLOT_TIME = "1800"

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


def format_base_datetime(base_date: str, base_time: str) -> str:
    return f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:8]} {base_time[:2]}:{base_time[2:]}"


async def fetch_weather_forecast(
    nx: int,
    ny: int,
    *,
    base_date: str | None = None,
    base_time: str | None = None,
) -> tuple[list[dict], dict]:
    if not settings.public_data_api_key:
        raise ValueError("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.")

    resolved_date = base_date or get_latest_base_datetime()[0]
    resolved_time = base_time or get_latest_base_datetime()[1]
    params = {
        "dataType": "JSON",
        "base_date": resolved_date,
        "base_time": resolved_time,
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
        items = [items]

    meta = {
        "base_date": resolved_date,
        "base_time": resolved_time,
        "base_datetime": format_base_datetime(resolved_date, resolved_time),
        "nx": nx,
        "ny": ny,
        "source": "기상청 단기예보(getVilageFcst)",
    }
    return items or [], meta


async def resolve_today_extremes(nx: int, ny: int, today: str) -> dict[str, int]:
    """저녁 이후에도 오늘 최저/최고기온을 맞추기 위해 당일 이전 발표 시각을 조회합니다."""
    now = datetime.now()
    base_date = now.strftime("%Y%m%d")
    found: dict[str, int] = {}

    for base_time in reversed(FORECAST_BASE_TIMES):
        hour = int(base_time[:2])
        minute = int(base_time[2:])
        published_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if published_at > now:
            continue

        items, _ = await fetch_weather_forecast(nx, ny, base_date=base_date, base_time=base_time)
        for item in items:
            if item["fcstDate"] != today or item["category"] not in {"TMN", "TMX"}:
                continue
            found[item["category"]] = int(float(item["fcstValue"]))

        if "TMN" in found and "TMX" in found:
            break

    return found


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
    slots: dict[tuple[str, str], dict] = {}

    for key in sorted_keys:
        data = timeline[key]
        hour = {
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
        hours.append(hour)
        slots[(hour["date"], hour["time"])] = hour

    return {"hours": hours, "daily_meta": daily_meta, "slots": slots}


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


def _is_am(time: str) -> bool:
    return "0600" <= time < "1200"


def _is_pm(time: str) -> bool:
    return "1200" <= time <= "2100"


def _pop_display(value: int | None) -> tuple[int, str]:
    if value is None or value == 0:
        return 0, "-"
    return value, f"{value}%"


def _period_slot_hours(slots: dict[tuple[str, str], dict], date: str, period: str) -> list[dict]:
    predicate = _is_am if period == "am" else _is_pm
    return [
        slot
        for (slot_date, slot_time), slot in slots.items()
        if slot_date == date and predicate(slot_time)
    ]


def _summarize_period(
    slots: dict[tuple[str, str], dict],
    daily_meta: dict[str, dict[str, int]],
    date: str,
    period: str,
    *,
    is_today: bool = False,
) -> dict:
    now = datetime.now()
    if is_today and period == "am" and now.hour >= 12:
        return _empty_period()

    sky_time = AM_SLOT_TIME if period == "am" else PM_SLOT_TIME
    pop_time = AM_POP_TIME if period == "am" else PM_SLOT_TIME
    sky_slot = slots.get((date, sky_time))
    pop_slot = slots.get((date, pop_time))
    period_hours = _period_slot_hours(slots, date, period)
    meta = daily_meta.get(date, {})

    if period == "am":
        tmp = meta.get("TMN")
    else:
        tmp = meta.get("TMX")

    if not period_hours and sky_slot is None and pop_slot is None and tmp is None:
        return _empty_period()

    period_max_pop = max((hour["pop"] for hour in period_hours), default=0)
    anchor_pop = pop_slot["pop"] if pop_slot else 0
    if period_max_pop >= 40:
        pop_value = period_max_pop
    elif pop_slot:
        pop_value = anchor_pop
    else:
        pop_value = period_max_pop
    pop, pop_display = _pop_display(pop_value)

    representative = sky_slot or (
        sorted(period_hours, key=lambda hour: hour["time"])[len(period_hours) // 2]
        if period_hours
        else None
    )
    if representative:
        sky = representative["sky"]
        pty = representative["pty"]
        sky_label = representative["sky_label"]
        pty_label = representative["pty_label"]
    else:
        sky = "1"
        pty = "0"
        sky_label = "맑음"
        pty_label = "없음"

    return {
        "pop": pop,
        "pop_display": pop_display,
        "tmp": tmp,
        "tmp_display": "-" if tmp is None else f"{tmp}°C",
        "sky": sky,
        "pty": pty,
        "sky_label": sky_label,
        "pty_label": pty_label,
        "weather_icon": _weather_icon(sky, pty),
    }


def build_kma_daily_forecast(
    slots: dict[tuple[str, str], dict],
    daily_meta: dict[str, dict[str, int]],
) -> list[dict]:
    """기상청 일별 예보와 동일한 슬롯(06시/18시 POP·SKY, TMN/TMX)으로 구성합니다."""
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
                "am": _summarize_period(slots, daily_meta, date, "am", is_today=index == 0),
                "pm": _summarize_period(slots, daily_meta, date, "pm", is_today=index == 0),
            }
        )
    return columns


def summarize_rain_forecast(
    hours: list[dict],
    daily_meta: dict[str, dict[str, int]] | None = None,
    slots: dict[tuple[str, str], dict] | None = None,
    forecast_meta: dict | None = None,
    mid_data: dict | None = None,
) -> dict:
    """오늘·내일·모레 강수예보를 집계합니다."""
    target_dates = [
        (datetime.now() + timedelta(days=i)).strftime("%Y%m%d") for i in range(3)
    ]
    meta = daily_meta or {}
    slot_map = slots or {}

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

    short_daily = build_kma_daily_forecast(slot_map, meta)
    if mid_data:
        from app.services.mid_forecast import merge_kma_daily_columns

        kma_daily = merge_kma_daily_columns(short_daily, mid_data)
    else:
        kma_daily = short_daily

    max_values = [d["max_pop"] for d in days]
    merged_meta = dict(forecast_meta or {})
    if mid_data:
        merged_meta.update(
            {
                "mid_tm_fc": mid_data["tm_fc"],
                "mid_tm_fc_display": mid_data["tm_fc_display"],
                "mid_land_reg_id": mid_data["land_reg_id"],
                "mid_ta_reg_id": mid_data["ta_reg_id"],
            }
        )

    return {
        "days": days,
        "kma_daily": kma_daily,
        "forecast_meta": merged_meta,
        "three_day_max_pop": max(max_values) if max_values else 0,
        "three_day_avg_pop": round(sum(max_values) / len(max_values)) if max_values else 0,
        "rainy_day_count": sum(1 for d in days if d["max_pop"] >= 40 or d["has_rain"]),
    }
