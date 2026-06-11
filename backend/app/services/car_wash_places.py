import logging
import math

import httpx

from app.config import settings
from app.services.kakao_local import (
    build_navigate_url,
    kakao_http_error_message,
    search_nearby_car_washes,
)

logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return int(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


async def _fetch_overpass_payload(compact_query: str) -> dict:
    headers = {"User-Agent": "sechahaemal-a/1.0 (car-wash-nearby)"}
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=45.0, headers=headers) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            for attempt in range(2):
                try:
                    response = await client.post(
                        endpoint,
                        data={"data": compact_query},
                        headers={**headers, "Content-Type": "application/x-www-form-urlencoded"},
                    )
                    response.raise_for_status()
                    return response.json()
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "Overpass 조회 실패 endpoint=%s attempt=%s err=%s",
                        endpoint,
                        attempt + 1,
                        exc,
                    )

    raise RuntimeError("OpenStreetMap 조회 실패") from last_error


async def _search_overpass_car_washes(lat: float, lng: float, radius_m: int) -> list[dict]:
    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="car_wash"](around:{radius_m},{lat},{lng});
      way["amenity"="car_wash"](around:{radius_m},{lat},{lng});
      node["name"~"세차",i](around:{radius_m},{lat},{lng});
      way["name"~"세차",i](around:{radius_m},{lat},{lng});
    );
    out center 25;
    """
    compact_query = " ".join(query.split())
    payload = await _fetch_overpass_payload(compact_query)

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


async def _search_car_washes_at_radius(
    lat: float, lng: float, radius_m: int
) -> tuple[list[dict], Exception | None, Exception | None]:
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
            logger.warning("카카오 세차장 검색 실패 radius=%s: %s", radius_m, exc)

    try:
        osm_items = await _search_overpass_car_washes(lat, lng, radius_m)
    except Exception as exc:
        osm_error = exc
        logger.warning("OpenStreetMap 세차장 검색 실패 radius=%s: %s", radius_m, exc)

    return _merge_car_wash_items(kakao_items, osm_items), kakao_error, osm_error


def _build_car_wash_response(
    items: list[dict],
    kakao_items_count: int,
    osm_items_count: int,
    radius_m: int,
) -> dict:
    response: dict = {
        "items": items,
        "count": len(items),
        "source": None,
        "search_radius_m": radius_m,
    }
    if not items:
        return response
    if kakao_items_count and osm_items_count:
        response["source"] = "mixed"
    elif kakao_items_count:
        response["source"] = "kakao"
    else:
        response["source"] = "openstreetmap"
    return response


async def find_nearby_car_washes(lat: float, lng: float, radius_m: int = 5000) -> dict:
    radii = [radius_m]
    if radius_m < 10_000:
        radii.append(10_000)

    kakao_error: Exception | None = None
    osm_error: Exception | None = None
    last_items: list[dict] = []
    last_radius = radius_m

    for search_radius in radii:
        items, kakao_error, osm_error = await _search_car_washes_at_radius(lat, lng, search_radius)
        last_items = items
        last_radius = search_radius
        if items:
            kakao_count = sum(1 for row in items if row.get("source") == "kakao")
            osm_count = len(items) - kakao_count
            return _build_car_wash_response(items, kakao_count, osm_count, search_radius)

    warning: str | None = None
    if kakao_error is not None:
        if isinstance(kakao_error, RuntimeError):
            warning = str(kakao_error)
        elif isinstance(getattr(kakao_error, "__cause__", None), httpx.HTTPStatusError):
            warning = kakao_http_error_message(kakao_error.__cause__)
        else:
            warning = "카카오 세차장 검색에 실패했습니다."
    if osm_error is not None and warning is None:
        warning = "주변 세차장 검색 서버가 바쁩니다. 잠시 후 다시 시도해 주세요."
    elif osm_error is not None:
        warning = f"{warning} (공개 지도 검색도 실패했습니다.)"

    response = _build_car_wash_response(last_items, 0, 0, last_radius)
    response["warning"] = warning
    return response
