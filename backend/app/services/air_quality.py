import logging
from datetime import datetime

from app.config import settings
from app.services.api_client import get_json

logger = logging.getLogger(__name__)

GRADE_LABELS = {
    "1": "좋음",
    "2": "보통",
    "3": "나쁨",
    "4": "매우나쁨",
}

TEXT_GRADE_MAP = {
    "좋음": 1,
    "보통": 2,
    "나쁨": 3,
    "매우나쁨": 4,
}

DAY_LABELS = ["오늘", "내일", "모레"]


async def fetch_air_quality(station_name: str) -> dict:
    params = {
        "returnType": "json",
        "stationName": station_name,
        "dataTerm": "DAILY",
        "ver": "1.3",
    }
    payload = await get_json(settings.dust_api_url, params)
    header = payload.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        raise RuntimeError(f"에어코리아 API 오류: {header.get('resultMsg', '')}")

    items = payload.get("response", {}).get("body", {}).get("items", [])
    if not items:
        raise RuntimeError("에어코리아 측정 데이터가 없습니다.")

    latest = items[0]
    return {
        "data_time": latest.get("dataTime"),
        "pm10_value": latest.get("pm10Value", "-"),
        "pm10_grade": latest.get("pm10Grade"),
        "pm10_grade_label": GRADE_LABELS.get(latest.get("pm10Grade", ""), "알 수 없음"),
        "pm25_value": latest.get("pm25Value", "-"),
        "pm25_grade": latest.get("pm25Grade"),
        "pm25_grade_label": GRADE_LABELS.get(latest.get("pm25Grade", ""), "알 수 없음"),
    }


def _parse_region_grade(inform_data: str, region: str) -> str | None:
    if not inform_data:
        return None
    for chunk in inform_data.split(","):
        if ":" not in chunk:
            continue
        name, grade = chunk.split(":", 1)
        if region in name.strip():
            return grade.strip()
    return None


async def fetch_dust_forecast(region: str) -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    params = {
        "returnType": "json",
        "searchDate": today,
        "InformCode": "PM25",
    }
    payload = await get_json(settings.dust_forecast_api_url, params)
    header = payload.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        raise RuntimeError(f"미세먼지 예보 오류: {header.get('resultMsg', '')}")

    items = payload.get("response", {}).get("body", {}).get("items", [])
    if not items:
        raise RuntimeError("미세먼지 예보 데이터가 없습니다.")

    days: list[dict] = []
    for index, item in enumerate(items[:3]):
        grade_text = _parse_region_grade(item.get("informData", ""), region)
        if not grade_text:
            grade_text = item.get("informOverall", "보통")

        grade_num = TEXT_GRADE_MAP.get(grade_text, 2)
        days.append(
            {
                "label": DAY_LABELS[index] if index < 3 else f"+{index}일",
                "grade": grade_num,
                "grade_label": grade_text,
                "data_time": item.get("dataTime"),
            }
        )

    while len(days) < 3:
        days.append(
            {
                "label": DAY_LABELS[len(days)],
                "grade": days[-1]["grade"] if days else 2,
                "grade_label": days[-1]["grade_label"] if days else "보통",
                "data_time": None,
            }
        )

    grade_values = [d["grade"] for d in days]
    return {
        "days": days[:3],
        "three_day_avg_grade": round(sum(grade_values) / len(grade_values), 1),
        "three_day_worst_grade": max(grade_values),
        "region": region,
    }
