import pytest

from accounts.tests.factories import UserFactory
from notifications.models import PushToken
from notifications.tests.factories import PushTokenFactory


@pytest.mark.django_db
def test_register_creates_a_new_token(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        "/api/notifications/register-device/",
        {"token": "ExponentPushToken[abc]", "platform": "ios"},
    )

    assert response.status_code == 200
    token = PushToken.objects.get(token="ExponentPushToken[abc]")
    assert token.user == user
    assert token.platform == PushToken.Platform.IOS


@pytest.mark.django_db
def test_register_same_token_twice_does_not_duplicate(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    body = {"token": "ExponentPushToken[abc]", "platform": "ios"}

    api_client.post("/api/notifications/register-device/", body)
    api_client.post("/api/notifications/register-device/", body)

    assert PushToken.objects.filter(token="ExponentPushToken[abc]").count() == 1


@pytest.mark.django_db
def test_register_reassigns_a_token_already_owned_by_another_user(api_client):
    original_owner = UserFactory()
    new_owner = UserFactory()
    token = PushTokenFactory(user=original_owner, token="ExponentPushToken[shared]")
    api_client.force_authenticate(user=new_owner)

    response = api_client.post(
        "/api/notifications/register-device/",
        {"token": "ExponentPushToken[shared]", "platform": "android"},
    )

    assert response.status_code == 200
    token.refresh_from_db()
    assert token.user == new_owner
    assert token.platform == PushToken.Platform.ANDROID
    assert PushToken.objects.filter(token="ExponentPushToken[shared]").count() == 1


@pytest.mark.django_db
def test_register_requires_token_and_platform(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/notifications/register-device/", {})

    assert response.status_code == 400
    assert "token" in response.data
    assert "platform" in response.data


@pytest.mark.django_db
def test_register_requires_authentication(api_client):
    response = api_client.post(
        "/api/notifications/register-device/",
        {"token": "ExponentPushToken[abc]", "platform": "ios"},
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_delete_removes_the_callers_own_token(api_client):
    user = UserFactory()
    token = PushTokenFactory(user=user, token="ExponentPushToken[mine]")
    api_client.force_authenticate(user=user)

    response = api_client.delete(
        "/api/notifications/register-device/", {"token": "ExponentPushToken[mine]"}
    )

    assert response.status_code == 204
    assert not PushToken.objects.filter(pk=token.pk).exists()


@pytest.mark.django_db
def test_delete_does_not_remove_another_users_token(api_client):
    owner = UserFactory()
    other = UserFactory()
    token = PushTokenFactory(user=owner, token="ExponentPushToken[theirs]")
    api_client.force_authenticate(user=other)

    response = api_client.delete(
        "/api/notifications/register-device/", {"token": "ExponentPushToken[theirs]"}
    )

    assert response.status_code == 204
    assert PushToken.objects.filter(pk=token.pk).exists()


@pytest.mark.django_db
def test_delete_nonexistent_token_does_not_error(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.delete(
        "/api/notifications/register-device/", {"token": "ExponentPushToken[nonexistent]"}
    )

    assert response.status_code == 204
