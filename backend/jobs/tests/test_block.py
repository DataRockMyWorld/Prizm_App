from unittest import mock

import pytest
from django.contrib.gis.geos import Point

from accounts.models import Block, User
from accounts.tests.factories import BlockFactory, UserFactory, WorkerProfileFactory
from jobs.matching import try_match
from jobs.models import JobOffer, JobRequest
from jobs.tests.factories import JobRequestFactory


def _live_job(**kwargs):
    customer = kwargs.pop("customer", None) or UserFactory(role=User.Role.CUSTOMER)
    worker = kwargs.pop("worker", None) or UserFactory(role=User.Role.WORKER)
    return JobRequestFactory(
        customer=customer,
        worker=worker,
        status=kwargs.pop("status", JobRequest.Status.ACCEPTED),
        **kwargs,
    )


@pytest.fixture
def worker_profile_factory():
    def _make(job):
        profile = WorkerProfileFactory(is_online=True, last_location=Point(17.0658, -22.5609))
        profile.categories.add(job.category)
        return profile

    return _make


# --- BlockCounterpartView -----------------------------------------------


@pytest.mark.parametrize(
    "status",
    [JobRequest.Status.COMPLETED, JobRequest.Status.CANCELLED, JobRequest.Status.DISPUTED],
)
@pytest.mark.django_db
def test_customer_can_block_worker_once_job_is_terminal(api_client, status):
    job = _live_job(status=status)
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert response.status_code == 201
    assert Block.objects.filter(blocker=job.customer, blocked_id=job.worker_id).exists()


@pytest.mark.django_db
def test_worker_can_block_customer_once_job_is_terminal(api_client):
    job = _live_job(status=JobRequest.Status.COMPLETED)
    worker = User.objects.get(pk=job.worker_id)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert response.status_code == 201
    assert Block.objects.filter(blocker=worker, blocked=job.customer).exists()


@pytest.mark.parametrize(
    "status",
    [
        JobRequest.Status.SEARCHING,
        JobRequest.Status.MATCHED,
        JobRequest.Status.ACCEPTED,
        JobRequest.Status.IN_PROGRESS,
        JobRequest.Status.AWAITING_PRICE_CONFIRMATION,
    ],
)
@pytest.mark.django_db
def test_blocking_is_rejected_while_job_is_still_active(api_client, status):
    job = _live_job(status=status)
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert response.status_code == 400
    assert not Block.objects.exists()


@pytest.mark.django_db
def test_unrelated_user_gets_403(api_client):
    job = _live_job(status=JobRequest.Status.COMPLETED)
    outsider = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=outsider)

    response = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert response.status_code == 403
    assert not Block.objects.exists()


@pytest.mark.django_db
def test_blocking_the_same_pair_twice_is_idempotent(api_client):
    job = _live_job(status=JobRequest.Status.COMPLETED)
    api_client.force_authenticate(user=job.customer)

    first = api_client.post(f"/api/jobs/{job.pk}/block/")
    second = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert first.status_code == 201
    assert second.status_code == 201
    assert Block.objects.filter(blocker=job.customer, blocked_id=job.worker_id).count() == 1


@pytest.mark.django_db
def test_blocking_rejected_when_the_job_was_cancelled_before_a_worker_was_ever_assigned(
    api_client,
):
    job = JobRequestFactory(status=JobRequest.Status.CANCELLED, worker=None)
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/block/")

    assert response.status_code == 400
    assert not Block.objects.exists()


# --- Matching exclusion ---------------------------------------------------


@pytest.mark.django_db
def test_matching_excludes_a_worker_the_customer_has_blocked(worker_profile_factory):
    job = JobRequestFactory(status=JobRequest.Status.SEARCHING)
    profile = worker_profile_factory(job)
    BlockFactory(blocker=job.customer, blocked=profile.user)

    with mock.patch("jobs.matching.send_push_notification"):
        try_match(job)

    assert not JobOffer.objects.filter(job=job, worker=profile.user).exists()


@pytest.mark.django_db
def test_matching_excludes_a_worker_who_has_blocked_the_customer(worker_profile_factory):
    """Whichever side initiated the block, the exclusion holds in both
    directions — a single Block row is enough (see accounts.models.Block)."""
    job = JobRequestFactory(status=JobRequest.Status.SEARCHING)
    profile = worker_profile_factory(job)
    BlockFactory(blocker=profile.user, blocked=job.customer)

    with mock.patch("jobs.matching.send_push_notification"):
        try_match(job)

    assert not JobOffer.objects.filter(job=job, worker=profile.user).exists()


@pytest.mark.django_db
def test_matching_is_unaffected_by_a_block_between_unrelated_users(worker_profile_factory):
    job = JobRequestFactory(status=JobRequest.Status.SEARCHING)
    profile = worker_profile_factory(job)
    BlockFactory()  # unrelated pair — shouldn't affect this job's matching at all

    with mock.patch("jobs.matching.send_push_notification"):
        try_match(job)

    assert JobOffer.objects.filter(job=job, worker=profile.user).exists()
