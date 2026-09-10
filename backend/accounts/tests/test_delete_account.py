import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest, Message, Rating
from jobs.tests.factories import JobRequestFactory, MessageFactory

NON_TERMINAL_STATUSES = [
    JobRequest.Status.REQUESTED,
    JobRequest.Status.SEARCHING,
    JobRequest.Status.MATCHED,
    JobRequest.Status.ACCEPTED,
    JobRequest.Status.ARRIVED,
    JobRequest.Status.QUOTE_PENDING,
    JobRequest.Status.QUOTE_ACCEPTED,
    JobRequest.Status.IN_PROGRESS,
]

TERMINAL_STATUSES = [
    JobRequest.Status.COMPLETED,
    JobRequest.Status.CANCELLED,
    JobRequest.Status.DECLINED,
    JobRequest.Status.DISPUTED,
]


@pytest.mark.django_db
def test_happy_path_scrubs_pii_and_sets_deleted_at(api_client):
    user = UserFactory(full_name="Jane Doe")
    original_phone = user.phone_number
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/delete-account/")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.deleted_at is not None
    assert user.is_active is False
    assert user.phone_number != original_phone
    assert user.full_name == ""
    assert user.has_usable_password() is False


@pytest.mark.django_db
@pytest.mark.parametrize("status", NON_TERMINAL_STATUSES)
def test_guard_rail_blocks_deletion_with_a_non_terminal_job_as_customer(api_client, status):
    user = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=user, status=status)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/delete-account/")

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.deleted_at is None


@pytest.mark.django_db
@pytest.mark.parametrize("status", NON_TERMINAL_STATUSES)
def test_guard_rail_blocks_deletion_with_a_non_terminal_job_as_worker(api_client, status):
    user = UserFactory(role=User.Role.WORKER)
    JobRequestFactory(worker=user, status=status)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/delete-account/")

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.deleted_at is None


@pytest.mark.django_db
@pytest.mark.parametrize("status", TERMINAL_STATUSES)
def test_guard_rail_allows_deletion_once_the_job_is_terminal(api_client, status):
    user = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=user, status=status)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/delete-account/")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.deleted_at is not None


@pytest.mark.django_db
def test_other_partys_job_and_messages_survive_a_deletion_untouched(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        customer=customer, worker=worker, status=JobRequest.Status.COMPLETED
    )
    message_from_customer = MessageFactory(job=job, sender=customer, text="hi")
    message_from_worker = MessageFactory(job=job, sender=worker, text="hello")
    rating = Rating.objects.create(job=job, stars=5, comment="great job")

    api_client.force_authenticate(user=customer)
    response = api_client.post("/api/auth/delete-account/")
    assert response.status_code == 200

    # The job itself, both messages, and the rating must all survive —
    # this is the regression this whole feature exists to prevent (see
    # DeleteAccountView's docstring / PRD §6).
    job.refresh_from_db()
    assert JobRequest.objects.filter(pk=job.pk).exists()
    assert Message.objects.filter(pk=message_from_customer.pk).exists()
    assert Message.objects.filter(pk=message_from_worker.pk).exists()
    assert Rating.objects.filter(pk=rating.pk).exists()

    # The worker's own account is completely untouched.
    worker.refresh_from_db()
    assert worker.deleted_at is None
    assert worker.is_active is True


@pytest.mark.django_db
def test_deleted_user_cannot_log_in(api_client):
    user = UserFactory()
    phone, pin = user.phone_number, "test-pin-1234"
    api_client.force_authenticate(user=user)
    api_client.post("/api/auth/delete-account/")

    response = api_client.post(
        "/api/auth/login/", {"phone_number": phone, "password": pin}
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_deleting_twice_does_not_error_or_double_scrub(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    first = api_client.post("/api/auth/delete-account/")
    assert first.status_code == 200
    deleted_phone_after_first = User.objects.get(pk=user.pk).phone_number

    second = api_client.post("/api/auth/delete-account/")

    assert second.status_code == 400
    assert User.objects.get(pk=user.pk).phone_number == deleted_phone_after_first


@pytest.mark.django_db
def test_a_preexisting_access_token_is_rejected_immediately_after_deletion(api_client):
    user = UserFactory()
    access_token = str(RefreshToken.for_user(user).access_token)
    api_client.force_authenticate(user=user)
    api_client.post("/api/auth/delete-account/")

    api_client.force_authenticate(user=None)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    response = api_client.get("/api/auth/profile/")

    assert response.status_code == 401
