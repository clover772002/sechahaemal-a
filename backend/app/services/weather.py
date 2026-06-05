import logging
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.services.api_client import get_json

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


def kst_now() -> datetime:
    return datetime.now(KST)


FORECAST_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"]
AM_SLOT_TIME = "0600"
PM_SLOT_TIME = "1800"
POP_RULE = "일자별 시간별 강수확률 최대값"
AM_TMP_TIMES = ("0400", "0500", "0600", "0700", "0800", "0900")
PM_TMP_TIMES = ("1000", "1100", "1200", "1300", "1400", "1500", "1600", "1700", "1800")

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
    now = kst_now()
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
        "source": "기상청 단기예보",
    }
    return items or [], meta


async def resolve_today_extremes(nx: int, ny: int, today: str) -> dict[str, int]:
    """저녁 이후에도 오늘 최저/최고기온을 맞추기 위해 당일 이전 발표 시각을 조회합니다."""
    now = kst_now()
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


def _tmp_from_window(
    slots: dict[tuple[str, str], dict],
    date: str,
    period: str,
) -> int | None:
    """기상청 일별예보 기준: 오전 03~09시 최저, 오후 09~18시 최고."""
    times = AM_TMP_TIMES if period == "am" else PM_TMP_TIMES
    values = [slots.get((date, time), {}).get("tmp") for time in times]
    values = [value for value in values if value is not None]
    if not values:
        return None
    return min(values) if period == "am" else max(values)


def _period_tmp(
    slots: dict[tuple[str, str], dict],
    daily_meta: dict[str, dict[str, int]],
    date: str,
    period: str,
    *,
    is_today: bool,
) -> int | None:
    """일별 기온: 내일 이후는 TMN/TMX 우선, 오늘은 시간대 최저·최고 우선."""
    meta = daily_meta.get(date, {})
    window_tmp = _tmp_from_window(slots, date, period)
    meta_key = "TMN" if period == "am" else "TMX"
    meta_tmp = meta.get(meta_key)

    if is_today:
        if period == "am" and kst_now().hour >= 12:
            return meta_tmp if meta_tmp is not None else window_tmp
        return window_tmp if window_tmp is not None else meta_tmp

    return meta_tmp if meta_tmp is not None else window_tmp


async def enrich_today_slots(
    nx: int,
    ny: int,
    slots: dict[tuple[str, str], dict],
    today: str,
) -> dict[tuple[str, str], dict]:
    """저녁 발표분에 오늘 시간별이 없을 때 당일 이전 발표 시각으로 보강합니다."""
    if _tmp_from_window(slots, today, "am") is not None and _tmp_from_window(slots, today, "pm") is not None:
        return slots

    enriched = dict(slots)
    now = kst_now()
    base_date = now.strftime("%Y%m%d")

    for base_time in reversed(FORECAST_BASE_TIMES):
        hour = int(base_time[:2])
        minute = int(base_time[2:])
        published_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if published_at > now:
            continue

        items, _ = await fetch_weather_forecast(nx, ny, base_date=base_date, base_time=base_time)
        parsed = parse_forecast_items(items)
        for (slot_date, slot_time), slot in parsed["slots"].items():
            if slot_date == today:
                enriched[(slot_date, slot_time)] = slot

        if (
            _tmp_from_window(enriched, today, "am") is not None
            and _tmp_from_window(enriched, today, "pm") is not None
        ):
            break

    return enriched


def _daily_max_pop(slots: dict[tuple[str, str], dict], date: str) -> int:
    """해당 일자 시간별 강수확률 중 최대값."""
    day_hours = [slot for (slot_date, _), slot in slots.items() if slot_date == date]
    return max((hour["pop"] for hour in day_hours), default=0)


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
    now = kst_now()
    sky_time = AM_SLOT_TIME if period == "am" else PM_SLOT_TIME
    sky_slot = slots.get((date, sky_time))
    period_hours = _period_slot_hours(slots, date, period)
    tmp = _period_tmp(slots, daily_meta, date, period, is_today=is_today)

    if is_today and period == "am" and now.hour >= 12:
        return {
            **_empty_period(),
            "tmp": tmp,
            "tmp_display": "-" if tmp is None else f"{tmp}°C",
        }

    daily_pop = _daily_max_pop(slots, date)
    if not period_hours and sky_slot is None and tmp is None and daily_pop == 0:
        return _empty_period()

    pop, pop_display = _pop_display(daily_pop)

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
    """단기예보 시간별 데이터를 오전/오후 일별 표로 요약합니다."""
    target_dates = [
        (kst_now() + timedelta(days=i)).strftime("%Y%m%d") for i in range(3)
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
) -> dict:
    """오늘·내일·모레 강수예보를 집계합니다."""
    target_dates = [
        (kst_now() + timedelta(days=i)).strftime("%Y%m%d") for i in range(3)
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

    kma_daily = build_kma_daily_forecast(slot_map, meta)

    max_values = [d["max_pop"] for d in days]

    return {
        "days": days,
        "kma_daily": kma_daily,
        "forecast_meta": {**(forecast_meta or {}), "pop_rule": POP_RULE},
        "three_day_max_pop": max(max_values) if max_values else 0,
        "three_day_avg_pop": round(sum(max_values) / len(max_values)) if max_values else 0,
        "rainy_day_count": sum(1 for d in days if d["max_pop"] >= 40 or d["has_rain"]),
    }
