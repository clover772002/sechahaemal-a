import asyncio
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

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "sechahaemal-a/1.0 (https://sechahaemal-a.vercel.app)"

SEARCH_BUDGET_SECONDS = 16.0


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return int(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _viewbox_for_radius(lat: float, lng: float, radius_m: int) -> str:
    dlat = radius_m / 111_000
    cos_lat = max(0.2, math.cos(math.radians(lat)))
    dlng = radius_m / (111_000 * cos_lat)
    left = lng - dlng
    right = lng + dlng
    top = lat + dlat
    bottom = lat - dlat
    return f"{left},{top},{right},{bottom}"


def _parse_nominatim_row(row: dict, lat: float, lng: float, radius_m: int) -> dict | None:
    if row.get("type") != "car_wash":
        return None
    try:
        place_lat = float(row["lat"])
        place_lng = float(row["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    distance_m = _haversine_m(lat, lng, place_lat, place_lng)
    if distance_m > radius_m:
        return None

    osm_type = row.get("osm_type") or "node"
    osm_id = row.get("osm_id")
    if osm_id is None:
        return None

    raw_name = (row.get("name") or "").strip()
    display_name = (row.get("display_name") or "").strip()
    name = raw_name or (display_name.split(",")[0].strip() if display_name else "") or "세차장"
    address = display_name if display_name and display_name != name else ""

    return {
        "id": f"osm-{osm_type}-{osm_id}",
        "name": name,
        "address": address,
        "lat": place_lat,
        "lng": place_lng,
        "phone": None,
        "distance_m": distance_m,
        "navigate_url": build_navigate_url(name, place_lat, place_lng, lat, lng),
        "source": "openstreetmap",
    }


async def _search_nominatim_car_washes(lat: float, lng: float, radius_m: int) -> list[dict]:
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    merged: dict[str, dict] = {}

    params = {
        "q": "car wash",
        "format": "json",
        "limit": 25,
        "viewbox": _viewbox_for_radius(lat, lng, radius_m),
        "bounded": 1,
        "countrycodes": "kr",
    }
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        response = await client.get(NOMINATIM_SEARCH_URL, params=params)
        response.raise_for_status()
        for row in response.json():
            item = _parse_nominatim_row(row, lat, lng, radius_m)
            if item is None:
                continue
            merged[item["id"]] = item

    return _sort_places_by_distance(list(merged.values()), lat, lng)[:15]


def _sort_places_by_distance(items: list[dict], lat: float, lng: float) -> list[dict]:
    for item in items:
        item["distance_m"] = _haversine_m(lat, lng, item["lat"], item["lng"])
    items.sort(key=lambda row: row["distance_m"])
    return items


def _merge_car_wash_items(
    kakao_items: list[dict], osm_items: list[dict], lat: float, lng: float
) -> list[dict]:
    merged = list(kakao_items)
    for osm_item in osm_items:
        osm_lat, osm_lng = osm_item["lat"], osm_item["lng"]
        is_duplicate = any(
            _haversine_m(osm_lat, osm_lng, k["lat"], k["lng"]) < 80 for k in kakao_items
        )
        if not is_duplicate:
            merged.append(osm_item)
    return _sort_places_by_distance(merged, lat, lng)[:15]


async def _try_kakao(lat: float, lng: float, radius_m: int) -> tuple[list[dict], Exception | None]:
    if not settings.get_kakao_rest_api_key():
        return [], None
    try:
        items = await asyncio.wait_for(search_nearby_car_washes(lat, lng, radius_m), timeout=6.0)
        for item in items:
            item["source"] = "kakao"
        return items, None
    except Exception as exc:
        logger.warning("카카오 세차장 검색 실패 radius=%s: %s", radius_m, exc)
        return [], exc


async def _try_osm(lat: float, lng: float, radius_m: int) -> tuple[list[dict], Exception | None]:
    try:
        return await asyncio.wait_for(_search_nominatim_car_washes(lat, lng, radius_m), timeout=11.0), None
    except Exception as exc:
        logger.warning("OpenStreetMap(Nominatim) 세차장 검색 실패 radius=%s: %s", radius_m, exc)
        return [], exc


async def _search_car_washes_at_radius(
    lat: float, lng: float, radius_m: int
) -> tuple[list[dict], Exception | None, Exception | None]:
    kakao_result, osm_result = await asyncio.gather(
        _try_kakao(lat, lng, radius_m),
        _try_osm(lat, lng, radius_m),
    )
    kakao_items, kakao_error = kakao_result
    osm_items, osm_error = osm_result
    return _merge_car_wash_items(kakao_items, osm_items, lat, lng), kakao_error, osm_error


def _build_car_wash_response(items: list[dict], radius_m: int, lat: float, lng: float) -> dict:
    items = _sort_places_by_distance(items, lat, lng)[:15]
    response: dict = {
        "items": items,
        "count": len(items),
        "source": None,
        "search_radius_m": radius_m,
    }
    if not items:
        return response
    kakao_count = sum(1 for row in items if row.get("source") == "kakao")
    osm_count = len(items) - kakao_count
    if kakao_count and osm_count:
        response["source"] = "mixed"
    elif kakao_count:
        response["source"] = "kakao"
    else:
        response["source"] = "openstreetmap"
    return response


def _log_search_errors(kakao_error: Exception | None, osm_error: Exception | None) -> None:
    if kakao_error is None:
        return
    if isinstance(kakao_error, RuntimeError):
        logger.warning("카카오 세차장 검색 오류: %s", kakao_error)
        return
    if isinstance(getattr(kakao_error, "__cause__", None), httpx.HTTPStatusError):
        logger.warning("카카오 세차장 검색 오류: %s", kakao_http_error_message(kakao_error.__cause__))
        return
    logger.warning("카카오 세차장 검색 오류: %s", kakao_error)


def _build_warning(kakao_error: Exception | None, osm_error: Exception | None) -> str | None:
    _log_search_errors(kakao_error, osm_error)
    if osm_error is not None:
        return "세차장 목록을 불러오지 못했어요. 아래 카카오맵에서 직접 찾아보세요."
    if kakao_error is not None:
        return "일부 세차장 정보가 빠져 있을 수 있어요."
    return None


async def find_nearby_car_washes(lat: float, lng: float, radius_m: int = 5000) -> dict:
    search_radius = max(radius_m, 10_000)
    kakao_error: Exception | None = None
    osm_error: Exception | None = None

    try:
        items, kakao_error, osm_error = await asyncio.wait_for(
            _search_car_washes_at_radius(lat, lng, search_radius),
            timeout=SEARCH_BUDGET_SECONDS,
        )
    except TimeoutError:
        logger.warning("세차장 검색 시간 초과 radius=%s", search_radius)
        items = []
        osm_error = TimeoutError("세차장 검색 시간 초과")

    if items:
        return _build_car_wash_response(items, search_radius, lat, lng)

    response = _build_car_wash_response([], search_radius, lat, lng)
    response["warning"] = _build_warning(kakao_error, osm_error)
    return response
