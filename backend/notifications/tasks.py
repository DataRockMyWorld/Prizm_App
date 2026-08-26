import requests
from celery import shared_task

from .models import PushToken

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@shared_task
def send_push_notification(user_id, title, body, data=None):
    """Push `title`/`body` to every device `user_id` has registered.

    Fire-and-forget from the caller's point of view (enqueued via
    `.delay(...)`, never awaited) — a user with zero registered devices is
    a no-op, not an error, since push is a best-effort supplement to the
    app's existing polling, not a guaranteed delivery channel.
    """
    tokens = list(PushToken.objects.filter(user_id=user_id))
    if not tokens:
        return

    messages = [
        {"to": t.token, "title": title, "body": body, "data": data or {}} for t in tokens
    ]
    response = requests.post(EXPO_PUSH_URL, json=messages, timeout=10)
    response.raise_for_status()

    results = response.json().get("data", [])
    for token, result in zip(tokens, results):
        error = (result or {}).get("details", {}).get("error")
        if result.get("status") == "error" and error == "DeviceNotRegistered":
            token.delete()
