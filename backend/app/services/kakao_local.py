import logging
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

KAKAO_KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
DEFAULT_RADIUS_M = 3000
MAX_RADIUS_M = 10000
SEARCH_QUERIES = ("세차장", "셀프세차")


def build_navigate_url(name: str, lat: float, lng: float) -> str:
    return f"https://map.kakao.com/link/to/{quote(name)},{lat},{lng}"


def _parse_distance_meters(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


async def search_nearby_car_washes(
    lat: float,
    lng: float,
    radius_m: int = DEFAULT_RADIUS_M,
) -> list[dict]:
    if not settings.kakao_rest_api_key:
        raise RuntimeError("KAKAO_REST_API_KEY가 설정되지 않았습니다.")

    radius_m = max(500, min(radius_m, MAX_RADIUS_M))
    headers = {"Authorization": f"KakaoAK {settings.kakao_rest_api_key}"}
    merged: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=8.0) as client:
        for query in SEARCH_QUERIES:
            params = {
                "query": query,
                "x": lng,
                "y": lat,
                "radius": radius_m,
                "sort": "distance",
                "size": 15,
            }
            response = await client.get(KAKAO_KEYWORD_SEARCH_URL, headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()

            for doc in payload.get("documents", []):
                place_id = doc.get("id")
                if not place_id:
                    continue

                try:
                    place_lat = float(doc["y"])
                    place_lng = float(doc["x"])
                except (KeyError, TypeError, ValueError):
                    continue

                address = doc.get("road_address_name") or doc.get("address_name") or ""
                distance_m = _parse_distance_meters(doc.get("distance"))
                item = {
                    "id": place_id,
                    "name": doc.get("place_name", "세차장"),
                    "address": address,
                    "lat": place_lat,
                    "lng": place_lng,
                    "phone": doc.get("phone") or None,
                    "distance_m": distance_m,
                    "navigate_url": build_navigate_url(
                        doc.get("place_name", "세차장"),
                        place_lat,
                        place_lng,
                    ),
                }

                existing = merged.get(place_id)
                if existing is None or (
                    distance_m is not None
                    and (existing.get("distance_m") is None or distance_m < existing["distance_m"])
                ):
                    merged[place_id] = item

    items = list(merged.values())
    items.sort(key=lambda row: row.get("distance_m") if row.get("distance_m") is not None else 99999)
    return items[:15]
