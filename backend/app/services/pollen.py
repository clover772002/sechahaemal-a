import asyncio
import logging
from datetime import datetime, timedelta

import httpx

from app.config import settings
from app.services.api_client import get_json
from app.services.coordinates import detect_pollen_area_no
from app.services.weather import kst_now

logger = logging.getLogger(__name__)

POLLEN_LABELS = {
    0: "낮음",
    1: "보통",
    2: "높음",
    3: "매우높음",
}

SPECIES_LABELS = {
    "oak": "참나무",
    "pine": "소나무",
    "weed": "잡초류",
}

SPECIES_ENDPOINTS = {
    "oak": "getOakPollenRiskIdxV3",
    "pine": "getPinePollenRiskIdxV3",
    "weed": "getWeedPollenRiskIdxV3",
}

DAY_LABELS = ["오늘", "내일", "모레"]
DAY_FIELDS = ["today", "tomorrow", "dayaftertomorrow"]


def active_pollen_species(month: int) -> list[str]:
    if 4 <= month <= 6:
        return ["oak", "pine"]
    if 8 <= month <= 10:
        return ["weed"]
    return []


def season_note(month: int) -> str:
    if 4 <= month <= 6:
        return "참나무·소나무 4~6월 제공"
    if 8 <= month <= 10:
        return "잡초류 8~10월 제공"
    return "꽃가루 비시즌(참·소나무 4~6월, 잡초 8~10월)"


def resolve_pollen_issue_times(now: datetime) -> list[str]:
    today = now.strftime("%Y%m%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y%m%d")
    if now.hour >= 18:
        return [f"{today}18", f"{today}06", f"{yesterday}18"]
    if now.hour >= 6:
        return [f"{today}06", f"{yesterday}18", f"{yesterday}06"]
    return [f"{yesterday}18", f"{yesterday}06"]


def _parse_grade(value) -> int | None:
    if value in (None, "", "-", "_", "N/A"):
        return None
    try:
        grade = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    if 0 <= grade <= 3:
        return grade
    return None


async def _fetch_species_pollen(species: str, area_no: str, issue_times: list[str]) -> dict | None:
    endpoint = SPECIES_ENDPOINTS[species]
    base_url = f"{settings.pollen_api_base_url}/{endpoint}"

    for issue_time in issue_times:
        params = {
            "pageNo": "1",
            "numOfRows": "10",
            "dataType": "JSON",
            "areaNo": area_no,
            "time": issue_time,
        }
        try:
            payload = await get_json(base_url, params)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {403, 404}:
                raise RuntimeError(
                    "꽃가루 API 미연동입니다. 공공데이터포털에서 "
                    "'기상청_꽃가루농도위험지수 조회서비스(3.0)' 활용신청이 필요합니다."
                ) from exc
            logger.warning("꽃가루 API HTTP 오류(%s, %s): %s", species, issue_time, exc)
            continue
        except Exception as exc:
            logger.warning("꽃가루 API 호출 실패(%s, %s): %s", species, issue_time, exc)
            continue

        header = payload.get("response", {}).get("header", {})
        if header.get("resultCode") != "00":
            logger.info(
                "꽃가루 API 응답(%s, %s): %s %s",
                species,
                issue_time,
                header.get("resultCode"),
                header.get("resultMsg"),
            )
            continue

        items = payload.get("response", {}).get("body", {}).get("items", {}).get("item")
        if isinstance(items, list):
            item = items[0] if items else None
        else:
            item = items
        if not item:
            continue

        parsed = {field: _parse_grade(item.get(field)) for field in DAY_FIELDS}
        if any(value is not None for value in parsed.values()):
            return {
                "species": species,
                "issue_time": issue_time,
                "days": parsed,
            }

    return None


async def fetch_pollen_forecast(region: str) -> dict:
    now = kst_now()
    month = now.month
    species_list = active_pollen_species(month)
    area_no = detect_pollen_area_no(region)
    issue_times = resolve_pollen_issue_times(now)

    if not species_list:
        return {
            "days": [],
            "three_day_worst_grade": None,
            "available": False,
            "in_season": False,
            "region": region,
            "forecast_meta": {
                "region": region,
                "area_no": area_no,
                "data_time": None,
                "source": "기상청 꽃가루농도위험지수(HealthWthrIdxServiceV3)",
                "season_note": season_note(month),
                "verify_hint": "날씨누리 → 테마날씨 → 생활기상정보 → 보건기상지수 → 꽃가루농도위험지수",
            },
        }

    tasks = [_fetch_species_pollen(species, area_no, issue_times) for species in species_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    species_data: dict[str, dict] = {}
    unavailable_reason: str | None = None
    issue_time: str | None = None

    for species, result in zip(species_list, results, strict=True):
        if isinstance(result, Exception):
            if isinstance(result, RuntimeError):
                unavailable_reason = str(result)
            else:
                logger.warning("꽃가루 종 조회 실패(%s): %s", species, result)
            continue
        if result:
            species_data[species] = result["days"]
            issue_time = issue_time or result["issue_time"]

    if unavailable_reason and not species_data:
        return {
            "days": [],
            "three_day_worst_grade": None,
            "available": False,
            "in_season": True,
            "unavailable_reason": unavailable_reason,
            "region": region,
            "forecast_meta": {
                "region": region,
                "area_no": area_no,
                "data_time": None,
                "source": "기상청 꽃가루농도위험지수(HealthWthrIdxServiceV3)",
                "season_note": season_note(month),
                "verify_hint": "날씨누리 → 테마날씨 → 생활기상정보 → 보건기상지수 → 꽃가루농도위험지수",
            },
        }

    if not species_data:
        return {
            "days": [],
            "three_day_worst_grade": None,
            "available": False,
            "in_season": True,
            "unavailable_reason": "꽃가루 예보 데이터가 없습니다.",
            "region": region,
            "forecast_meta": {
                "region": region,
                "area_no": area_no,
                "data_time": issue_time,
                "source": "기상청 꽃가루농도위험지수(HealthWthrIdxServiceV3)",
                "season_note": season_note(month),
                "verify_hint": "날씨누리 → 테마날씨 → 생활기상정보 → 보건기상지수 → 꽃가루농도위험지수",
            },
        }

    days: list[dict] = []
    worst_values: list[int] = []

    for index, (label, field) in enumerate(zip(DAY_LABELS, DAY_FIELDS, strict=True)):
        per_species: dict[str, int | None] = {
            species: values.get(field) for species, values in species_data.items()
        }
        present = [grade for grade in per_species.values() if grade is not None]
        if present:
            day_grade = max(present)
            worst_values.append(day_grade)
        else:
            day_grade = 0

        days.append(
            {
                "label": label,
                "grade": day_grade,
                "grade_label": POLLEN_LABELS.get(day_grade, "낮음"),
                "species": per_species,
                "active_species_labels": [
                    SPECIES_LABELS[species]
                    for species, grade in per_species.items()
                    if grade is not None
                ],
            }
        )

    return {
        "days": days,
        "three_day_worst_grade": max(worst_values) if worst_values else 0,
        "available": True,
        "in_season": True,
        "region": region,
        "forecast_meta": {
            "region": region,
            "area_no": area_no,
            "data_time": issue_time,
            "source": "기상청 꽃가루농도위험지수(HealthWthrIdxServiceV3)",
            "season_note": season_note(month),
            "verify_hint": "날씨누리 → 테마날씨 → 생활기상정보 → 보건기상지수 → 꽃가루농도위험지수",
        },
    }
