from urllib.parse import urlencode

import httpx

from app.config import settings


def build_request_url(base_url: str, params: dict) -> str:
    """Encoding 인증키가 이중 인코딩되지 않도록 serviceKey는 URL에 직접 붙입니다."""
    query = urlencode(params)
    return f"{base_url}?serviceKey={settings.public_data_api_key}&{query}"


async def get_json(base_url: str, params: dict) -> dict:
    url = build_request_url(base_url, params)
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
