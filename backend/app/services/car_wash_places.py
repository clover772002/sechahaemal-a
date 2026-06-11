import logging
import math

import httpx

from app.config import settings
from app.services.kakao_local import build_navigate_url, search_nearby_car_washes

logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
)


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return int(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


async def _search_overpass_car_washes(lat: float, lng: float, radius_m: int) -> list[dict]:
    query = f"""
    [out:json][timeout:12];
    (
      node["amenity"="car_wash"](around:{radius_m},{lat},{lng});
      way["amenity"="car_wash"](around:{radius_m},{lat},{lng});
    );
    out center 20;
    """
    payload = None
    last_error: Exception | None = None
    headers = {"User-Agent": "sechahaemal-a/1.0 (car-wash-nearby)"}
    compact_query = " ".join(query.split())

    async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = await client.get(endpoint, params={"data": compact_query})
                response.raise_for_status()
                payload = response.json()
                break
            except Exception as exc:
                last_error = exc
                logger.warning("Overpass 조회 실패 endpoint=%s err=%s", endpoint, exc)

    if payload is None:
        raise RuntimeError("OpenStreetMap 조회 실패") from last_error

    items: list[dict] = []
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        name = tags.get("name") or tags.get("brand") or "세차장"
        if element.get("type") == "node":
            place_lat = element.get("lat")
            place_lng = element.get("lon")
        else:
            center = element.get("center") or {}
            place_lat = center.get("lat")
            place_lng = center.get("lon")
        if place_lat is None or place_lng is None:
            continue

        place_lat = float(place_lat)
        place_lng = float(place_lng)
        address = tags.get("addr:full") or tags.get("addr:street") or ""
        items.append(
            {
                "id": f"osm-{element.get('type')}-{element.get('id')}",
                "name": name,
                "address": address,
                "lat": place_lat,
                "lng": place_lng,
                "phone": tags.get("phone") or None,
                "distance_m": _haversine_m(lat, lng, place_lat, place_lng),
                "navigate_url": build_navigate_url(name, place_lat, place_lng),
                "source": "openstreetmap",
            }
        )

    items.sort(key=lambda row: row["distance_m"])
    return items[:15]


def _merge_car_wash_items(kakao_items: list[dict], osm_items: list[dict]) -> list[dict]:
    merged = list(kakao_items)
    for osm_item in osm_items:
        osm_lat, osm_lng = osm_item["lat"], osm_item["lng"]
        is_duplicate = any(
            _haversine_m(osm_lat, osm_lng, k["lat"], k["lng"]) < 80 for k in kakao_items
        )
        if not is_duplicate:
            merged.append(osm_item)
    merged.sort(key=lambda row: row.get("distance_m") if row.get("distance_m") is not None else 99999)
    return merged[:15]


async def find_nearby_car_washes(lat: float, lng: float, radius_m: int = 5000) -> dict:
    kakao_items: list[dict] = []
    osm_items: list[dict] = []
    kakao_error: Exception | None = None
    osm_error: Exception | None = None

    if settings.get_kakao_rest_api_key():
        try:
            kakao_items = await search_nearby_car_washes(lat, lng, radius_m)
            for item in kakao_items:
                item["source"] = "kakao"
        except Exception as exc:
            kakao_error = exc
            logger.warning("카카오 세차장 검색 실패: %s", exc)

    try:
        osm_items = await _search_overpass_car_washes(lat, lng, radius_m)
    except Exception as exc:
        osm_error = exc
        logger.warning("OpenStreetMap 세차장 검색 실패: %s", exc)

    items = _merge_car_wash_items(kakao_items, osm_items)
    if items:
        if kakao_items and osm_items:
            source = "mixed"
        elif kakao_items:
            source = "kakao"
        else:
            source = "openstreetmap"
        return {"items": items, "count": len(items), "source": source}

    if kakao_error is not None:
        raise RuntimeError(
            "세차장 검색에 실패했습니다. 카카오 API 키를 확인하거나 잠시 후 다시 시도해 주세요."
        ) from kakao_error
    if osm_error is not None:
        raise RuntimeError("세차장 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.") from osm_error
    return {"items": [], "count": 0, "source": None}
