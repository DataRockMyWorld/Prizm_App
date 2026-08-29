import pytest
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from accounts.models import PhoneOTP

PHONE = "+264800555001"


@pytest.mark.django_db
def test_requesting_an_otp_stores_a_hash_not_the_raw_code(api_client, monkeypatch):
    monkeypatch.setattr("accounts.views._generate_otp_code", lambda: "123456")

    response = api_client.post("/api/auth/otp/request/", {"phone_number": PHONE})

    assert response.status_code == 200
    otp = PhoneOTP.objects.get(phone_number=PHONE)
    # Not the raw code itself, and not just prefixed by it either — a real
    # password hash, not a plaintext/lightly-obfuscated copy.
    assert otp.code_hash != "123456"
    assert not otp.code_hash.startswith("123456")
    assert check_password("123456", otp.code_hash)


@pytest.mark.django_db
def test_verify_succeeds_with_the_correct_code_and_marks_it_used(api_client, monkeypatch):
    monkeypatch.setattr("accounts.views._generate_otp_code", lambda: "123456")
    api_client.post("/api/auth/otp/request/", {"phone_number": PHONE})

    response = api_client.post(
        "/api/auth/otp/verify/", {"phone_number": PHONE, "code": "123456"}
    )

    assert response.status_code == 200
    assert "otp_token" in response.data
    otp = PhoneOTP.objects.get(phone_number=PHONE)
    assert otp.is_used is True


@pytest.mark.django_db
def test_verify_rejects_a_wrong_code(api_client):
    PhoneOTP.objects.create(
        phone_number=PHONE,
        code_hash=make_password("111111"),
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )

    response = api_client.post(
        "/api/auth/otp/verify/", {"phone_number": PHONE, "code": "222222"}
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_verify_rejects_an_already_used_code(api_client):
    PhoneOTP.objects.create(
        phone_number=PHONE,
        code_hash=make_password("333333"),
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
        is_used=True,
    )

    response = api_client.post(
        "/api/auth/otp/verify/", {"phone_number": PHONE, "code": "333333"}
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_verify_rejects_an_expired_code(api_client):
    PhoneOTP.objects.create(
        phone_number=PHONE,
        code_hash=make_password("444444"),
        expires_at=timezone.now() - timezone.timedelta(seconds=1),
    )

    response = api_client.post(
        "/api/auth/otp/verify/", {"phone_number": PHONE, "code": "444444"}
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_verify_matches_the_right_one_among_multiple_live_codes(api_client):
    # A new request doesn't invalidate an earlier unused one yet (a known,
    # separately-tracked gap) — verify still has to find whichever of the
    # live candidates actually matches.
    PhoneOTP.objects.create(
        phone_number=PHONE,
        code_hash=make_password("555555"),
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )
    PhoneOTP.objects.create(
        phone_number=PHONE,
        code_hash=make_password("666666"),
        expires_at=timezone.now() + timezone.timedelta(minutes=5),
    )

    response = api_client.post(
        "/api/auth/otp/verify/", {"phone_number": PHONE, "code": "555555"}
    )

    assert response.status_code == 200
