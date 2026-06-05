import math

from app.locations import PRESET_LOCATIONS
from app.services.coordinates import PRESET_COORDS, _haversine

# 기상청 중기예보 구역코드 (육상/기온)
MID_REGION_PRESETS: list[dict] = [
    {
        "id": "pohang",
        "name": "포항",
        "land_reg_id": "11H10000",
        "ta_reg_id": "11H10201",
    },
    {
        "id": "seoul",
        "name": "서울",
        "land_reg_id": "11B00000",
        "ta_reg_id": "11B10101",
    },
    {
        "id": "busan",
        "name": "부산",
        "land_reg_id": "11H20000",
        "ta_reg_id": "11H20201",
    },
    {
        "id": "daegu",
        "name": "대구",
        "land_reg_id": "11H10000",
        "ta_reg_id": "11H10101",
    },
    {
        "id": "incheon",
        "name": "인천",
        "land_reg_id": "11B00000",
        "ta_reg_id": "11B20201",
    },
    {
        "id": "gwangju",
        "name": "광주",
        "land_reg_id": "11F20000",
        "ta_reg_id": "11F20501",
    },
    {
        "id": "daejeon",
        "name": "대전",
        "land_reg_id": "11C20000",
        "ta_reg_id": "11C20401",
    },
    {
        "id": "jeju",
        "name": "제주",
        "land_reg_id": "11G00000",
        "ta_reg_id": "11G00201",
    },
]

# 광역 매핑 (가장 가까운 프리셋이 없을 때)
REGION_LAND_REG_ID = {
    "서울": "11B00000",
    "인천": "11B00000",
    "경기": "11B00000",
    "강원": "11D10000",
    "충북": "11C10000",
    "충남": "11C20000",
    "대전": "11C20000",
    "세종": "11C20000",
    "전북": "11F10000",
    "전남": "11F20000",
    "광주": "11F20000",
    "경북": "11H10000",
    "대구": "11H10000",
    "경남": "11H20000",
    "울산": "11H20000",
    "부산": "11H20000",
    "제주": "11G00000",
}


def find_mid_region(lat: float, lng: float, region_name: str) -> dict:
    """GPS 기준 가장 가까운 중기예보 구역코드를 반환합니다."""
    best = None
    best_dist = float("inf")

    for preset in MID_REGION_PRESETS:
        coords = PRESET_COORDS.get(preset["id"])
        if not coords:
            continue
        dist = _haversine(lat, lng, coords[0], coords[1])
        if dist < best_dist:
            best_dist = dist
            best = preset

    if best:
        return {
            "land_reg_id": best["land_reg_id"],
            "ta_reg_id": best["ta_reg_id"],
            "name": best["name"],
            "distance_km": round(best_dist, 1),
        }

    land_reg_id = REGION_LAND_REG_ID.get(region_name, "11B00000")
    return {
        "land_reg_id": land_reg_id,
        "ta_reg_id": land_reg_id,
        "name": region_name,
        "distance_km": None,
    }
