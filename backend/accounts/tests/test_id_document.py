import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from accounts.models import User, WorkerProfile
from accounts.tests.factories import WorkerProfileFactory


def _fake_image(name="id.jpg"):
    return SimpleUploadedFile(name, b"fake-image-bytes", content_type="image/jpeg")


@pytest.mark.django_db
def test_submitting_front_and_back_together_sets_pending(api_client):
    profile = WorkerProfileFactory(id_status=WorkerProfile.IDStatus.NOT_SUBMITTED)
    api_client.force_authenticate(user=profile.user)

    response = api_client.patch(
        "/api/auth/worker-profile/",
        {"id_document": _fake_image("front.jpg"), "id_document_back": _fake_image("back.jpg")},
        format="multipart",
    )

    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.id_status == WorkerProfile.IDStatus.PENDING
    assert profile.id_document
    assert profile.id_document_back


@pytest.mark.django_db
def test_submitting_only_back_still_resets_to_pending(api_client):
    # A worker fixing just the back side after a rejection (front was fine)
    # should still re-enter review — not stay silently Rejected.
    profile = WorkerProfileFactory(id_status=WorkerProfile.IDStatus.REJECTED)
    api_client.force_authenticate(user=profile.user)

    response = api_client.patch(
        "/api/auth/worker-profile/",
        {"id_document_back": _fake_image("back.jpg")},
        format="multipart",
    )

    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.id_status == WorkerProfile.IDStatus.PENDING


@pytest.mark.django_db
def test_resubmission_clears_earlier_rejection(api_client):
    reviewer = WorkerProfileFactory().user
    profile = WorkerProfileFactory(
        id_status=WorkerProfile.IDStatus.REJECTED,
        id_rejection_reason="Photo too blurry",
        id_reviewed_by=reviewer,
    )
    api_client.force_authenticate(user=profile.user)

    response = api_client.patch(
        "/api/auth/worker-profile/",
        {"id_document": _fake_image("front.jpg"), "id_document_back": _fake_image("back.jpg")},
        format="multipart",
    )

    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.id_status == WorkerProfile.IDStatus.PENDING
    assert profile.id_rejection_reason == ""
    assert profile.id_reviewed_by is None
    assert profile.id_reviewed_at is None


@pytest.mark.django_db
def test_patch_without_a_document_field_does_not_touch_review_state(api_client):
    profile = WorkerProfileFactory(id_status=WorkerProfile.IDStatus.APPROVED)
    api_client.force_authenticate(user=profile.user)

    response = api_client.patch(
        "/api/auth/worker-profile/",
        {},
        format="multipart",
    )

    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.id_status == WorkerProfile.IDStatus.APPROVED


@pytest.mark.django_db
def test_customer_cannot_submit_id_document(api_client):
    customer = User.objects.create(phone_number="+264800000099", role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=customer)

    response = api_client.patch(
        "/api/auth/worker-profile/",
        {"id_document": _fake_image("front.jpg")},
        format="multipart",
    )

    assert response.status_code == 403
