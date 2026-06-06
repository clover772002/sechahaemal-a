import json
import logging
from pathlib import Path

from pywebpush import WebPushException, webpush

from app.config import settings

logger = logging.getLogger(__name__)

STORAGE_PATH = Path(__file__).resolve().parent.parent / "data" / "push_subscriptions.json"

MORNING_PAYLOAD = {
    "title": "오늘 세차, 해도 될까?",
    "body": "탭해서 내 위치로 분석하고 결과를 들어보세요.",
    "url": "/",
}


def _ensure_storage_dir() -> None:
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)


def load_subscriptions() -> list[dict]:
    if not STORAGE_PATH.exists():
        return []
    try:
        data = json.loads(STORAGE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        logger.warning("푸시 구독 파일이 손상되어 초기화합니다.")
        return []


def save_subscriptions(subscriptions: list[dict]) -> None:
    _ensure_storage_dir()
    STORAGE_PATH.write_text(
        json.dumps(subscriptions, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def add_subscription(subscription: dict) -> None:
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise ValueError("구독 endpoint가 없습니다.")

    subscriptions = load_subscriptions()
    subscriptions = [item for item in subscriptions if item.get("endpoint") != endpoint]
    subscriptions.append(subscription)
    save_subscriptions(subscriptions)
    logger.info("푸시 구독 저장 완료 (총 %s건)", len(subscriptions))


def is_push_configured() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def send_morning_push() -> dict:
    if not is_push_configured():
        raise RuntimeError("VAPID 키가 설정되지 않았습니다.")

    subscriptions = load_subscriptions()
    if not subscriptions:
        return {"sent": 0, "failed": 0, "removed": 0, "total": 0}

    payload = json.dumps(MORNING_PAYLOAD, ensure_ascii=False)
    sent = 0
    failed = 0
    removed = 0
    alive: list[dict] = []

    for subscription in subscriptions:
        try:
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
            alive.append(subscription)
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                removed += 1
                logger.info("만료된 푸시 구독 제거: %s", subscription.get("endpoint"))
            else:
                failed += 1
                alive.append(subscription)
                logger.warning("푸시 전송 실패(%s): %s", status, exc)
        except Exception as exc:
            failed += 1
            alive.append(subscription)
            logger.warning("푸시 전송 오류: %s", exc)

    if removed:
        save_subscriptions(alive)

    return {
        "sent": sent,
        "failed": failed,
        "removed": removed,
        "total": len(subscriptions),
    }
