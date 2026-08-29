import pytest
from django.core.cache import cache
from django.test import override_settings

from accounts.tests.factories import UserFactory

# Isolate from the real (Redis-backed) cache so repeated test runs never
# collide with lockout/throttle state left over from a previous run.
LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM_CACHE)
@pytest.mark.django_db
def test_locks_out_after_repeated_failed_pin_attempts(api_client):
    cache.clear()
    user = UserFactory(phone_number="+264800999001")

    for _ in range(5):
        response = api_client.post(
            "/api/auth/login/",
            {"phone_number": user.phone_number, "password": "wrong-pin"},
        )
        assert response.status_code == 401

    locked_response = api_client.post(
        "/api/auth/login/",
        {"phone_number": user.phone_number, "password": "test-pin-1234"},
    )

    assert locked_response.status_code == 429


@override_settings(CACHES=LOCMEM_CACHE)
@pytest.mark.django_db
def test_successful_login_resets_the_failure_count(api_client):
    cache.clear()
    user = UserFactory(phone_number="+264800999002")

    for _ in range(3):
        api_client.post(
            "/api/auth/login/",
            {"phone_number": user.phone_number, "password": "wrong-pin"},
        )

    success_response = api_client.post(
        "/api/auth/login/",
        {"phone_number": user.phone_number, "password": "test-pin-1234"},
    )
    assert success_response.status_code == 200

    after_reset_response = api_client.post(
        "/api/auth/login/",
        {"phone_number": user.phone_number, "password": "wrong-pin"},
    )
    # Failure count was reset by the successful login, not carried over —
    # so this single wrong guess is a normal 401, not a 429 lockout.
    assert after_reset_response.status_code == 401


@override_settings(CACHES=LOCMEM_CACHE)
@pytest.mark.django_db
def test_correct_pin_still_works_below_the_lockout_threshold(api_client):
    cache.clear()
    user = UserFactory(phone_number="+264800999003")

    response = api_client.post(
        "/api/auth/login/",
        {"phone_number": user.phone_number, "password": "test-pin-1234"},
    )

    assert response.status_code == 200
    assert "access" in response.data
