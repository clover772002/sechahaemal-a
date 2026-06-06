from urllib.parse import urlencode

import httpx

from app.config import settings
from app.services.cache_store import get_cached, set_cached

_HTTP_CLIENT: httpx.AsyncClient | None = None
REQUEST_TIMEOUT_SECONDS = 8.0

CACHE_TTL_BY_PATTERN: tuple[tuple[str, float], ...] = (
    ("getMinuDustFrcstDspth", 1800),
    ("getVilageFcst", 600),
    ("getMsrstnAcctoRltmMesureDnsty", 600),
    ("HealthWthrIdxServiceV3", 1800),
)


def build_request_url(base_url: str, params: dict) -> str:
    """Encoding 인증키가 이중 인코딩되지 않도록 serviceKey는 URL에 직접 붙입니다."""
    query = urlencode(params)
    return f"{base_url}?serviceKey={settings.public_data_api_key}&{query}"


def _cache_ttl_for_url(url: str) -> float:
    for pattern, ttl in CACHE_TTL_BY_PATTERN:
        if pattern in url:
            return ttl
    return 300


def _get_http_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        _HTTP_CLIENT = httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    return _HTTP_CLIENT


async def get_json(base_url: str, params: dict) -> dict:
    url = build_request_url(base_url, params)
    cached = get_cached(url)
    if cached is not None:
        return cached

    client = _get_http_client()
    response = await client.get(url)
    response.raise_for_status()
    payload = response.json()
    set_cached(url, payload, _cache_ttl_for_url(url))
    return payload
