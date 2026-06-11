import asyncio
import logging
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

KAKAO_KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
DEFAULT_RADIUS_M = 5000
MAX_RADIUS_M = 10000
SEARCH_QUERIES = ("세차장", "셀프세차", "손세차", "세차")


def build_navigate_url(name: str, lat: float, lng: float) -> str:
    return f"https://map.kakao.com/link/to/{quote(name)},{lat},{lng}"


def _parse_distance_meters(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def kakao_http_error_message(exc: httpx.HTTPStatusError) -> str:
    status = exc.response.status_code
    if status == 401:
        return (
            "카카오 REST API 키가 올바르지 않습니다. "
            "Railway의 KAKAO_REST_API_KEY(REST API 키)를 확인해 주세요."
        )
    if status == 403:
        return (
            "카카오 로컬 API 사용 권한이 없습니다. "
            "developers.kakao.com → 앱 → 제품 설정에서 '로컬' API를 활성화해 주세요."
        )
    try:
        body = exc.response.json()
        message = body.get("message")
        if message:
            return f"카카오 API 오류: {message}"
    except Exception:
        pass
    return f"카카오 API 호출 실패(HTTP {status})"


async def search_nearby_car_washes(
    lat: float,
    lng: float,
    radius_m: int = DEFAULT_RADIUS_M,
) -> list[dict]:
    api_key = settings.get_kakao_rest_api_key()
    if not api_key:
        raise RuntimeError(
            "KAKAO_REST_API_KEY가 설정되지 않았습니다. "
            "Railway Variables에 카카오 REST API 키를 추가해 주세요."
        )

    radius_m = max(500, min(radius_m, MAX_RADIUS_M))
    headers = {"Authorization": f"KakaoAK {api_key}"}
    merged: dict[str, dict] = {}
    last_http_error: httpx.HTTPStatusError | None = None

    async def fetch_query(client: httpx.AsyncClient, query: str) -> tuple[str, dict | None, httpx.HTTPStatusError | None]:
        params = {
            "query": query,
            "x": lng,
            "y": lat,
            "radius": radius_m,
            "sort": "distance",
            "size": 15,
        }
        try:
            response = await client.get(KAKAO_KEYWORD_SEARCH_URL, headers=headers, params=params)
            response.raise_for_status()
            return query, response.json(), None
        except httpx.HTTPStatusError as exc:
            logger.warning("카카오 검색 실패 query=%s status=%s", query, exc.response.status_code)
            return query, None, exc

    async with httpx.AsyncClient(timeout=4.0) as client:
        results = await asyncio.gather(*(fetch_query(client, query) for query in SEARCH_QUERIES))

    for _query, payload, http_error in results:
        if http_error is not None:
            last_http_error = http_error
        if not payload:
            continue

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

    if not merged:
        if last_http_error is not None:
            raise RuntimeError(kakao_http_error_message(last_http_error)) from last_http_error
        return []

    items = list(merged.values())
    items.sort(key=lambda row: row.get("distance_m") if row.get("distance_m") is not None else 99999)
    return items[:15]
