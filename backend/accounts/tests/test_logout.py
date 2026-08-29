import pytest
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.tests.factories import UserFactory


@pytest.mark.django_db
def test_logout_blacklists_the_refresh_token(api_client):
    user = UserFactory()
    refresh = RefreshToken.for_user(user)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/logout/", {"refresh": str(refresh)})

    assert response.status_code == 205
    with pytest.raises(TokenError):
        RefreshToken(str(refresh)).blacklist()  # already blacklisted — must fail again


@pytest.mark.django_db
def test_blacklisted_refresh_token_cannot_be_used_to_get_a_new_access_token(api_client):
    user = UserFactory()
    refresh = RefreshToken.for_user(user)
    api_client.force_authenticate(user=user)
    api_client.post("/api/auth/logout/", {"refresh": str(refresh)})
    api_client.force_authenticate(user=None)

    response = api_client.post("/api/auth/login/refresh/", {"refresh": str(refresh)})

    assert response.status_code == 401


@pytest.mark.django_db
def test_logout_requires_authentication(api_client):
    response = api_client.post("/api/auth/logout/", {"refresh": "whatever"})

    assert response.status_code == 401


@pytest.mark.django_db
def test_logout_without_a_refresh_field_returns_400(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/logout/", {})

    assert response.status_code == 400


@pytest.mark.django_db
def test_logout_with_an_already_invalid_token_still_succeeds(api_client):
    # The caller's goal — this token must not work anymore — is already true
    # either way, so this shouldn't surface as an error.
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/logout/", {"refresh": "not-a-real-token"})

    assert response.status_code == 205
