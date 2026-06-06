import time
from typing import TypeVar

T = TypeVar("T")

_store: dict[str, tuple[float, T]] = {}


def get_cached(key: str) -> T | None:
    entry = _store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        _store.pop(key, None)
        return None
    return value


def set_cached(key: str, value: T, ttl_seconds: float) -> None:
    _store[key] = (time.monotonic() + ttl_seconds, value)
