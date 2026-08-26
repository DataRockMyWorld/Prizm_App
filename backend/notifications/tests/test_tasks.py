from unittest import mock

import pytest

from notifications.models import PushToken
from notifications.tasks import send_push_notification
from notifications.tests.factories import PushTokenFactory


def _mock_response(results):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"data": results}
    return response


@pytest.mark.django_db
def test_no_tokens_is_a_noop():
    with mock.patch("notifications.tasks.requests.post") as mock_post:
        send_push_notification(user_id=999, title="t", body="b", data={})

    mock_post.assert_not_called()


@pytest.mark.django_db
def test_sends_one_batched_call_for_multiple_tokens():
    token1 = PushTokenFactory()
    token2 = PushTokenFactory(user=token1.user)
    mock_post = mock.Mock(
        return_value=_mock_response([{"status": "ok"}, {"status": "ok"}])
    )

    with mock.patch("notifications.tasks.requests.post", mock_post):
        send_push_notification(
            user_id=token1.user_id, title="New job offer", body="Nearby", data={"type": "job_offer"}
        )

    mock_post.assert_called_once()
    sent_messages = mock_post.call_args.kwargs["json"]
    assert len(sent_messages) == 2
    assert {m["to"] for m in sent_messages} == {token1.token, token2.token}
    assert all(m["title"] == "New job offer" for m in sent_messages)


@pytest.mark.django_db
def test_device_not_registered_error_deletes_that_token():
    token = PushTokenFactory()
    mock_post = mock.Mock(
        return_value=_mock_response(
            [{"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}}]
        )
    )

    with mock.patch("notifications.tasks.requests.post", mock_post):
        send_push_notification(user_id=token.user_id, title="t", body="b", data={})

    assert not PushToken.objects.filter(pk=token.pk).exists()


@pytest.mark.django_db
def test_other_errors_do_not_delete_the_token():
    token = PushTokenFactory()
    mock_post = mock.Mock(
        return_value=_mock_response(
            [{"status": "error", "message": "rate limited", "details": {"error": "MessageRateExceeded"}}]
        )
    )

    with mock.patch("notifications.tasks.requests.post", mock_post):
        send_push_notification(user_id=token.user_id, title="t", body="b", data={})

    assert PushToken.objects.filter(pk=token.pk).exists()
