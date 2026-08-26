from unittest import mock

import pytest

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.matching import try_match
from jobs.models import JobRequest
from jobs.tests.factories import JobOfferFactory, JobRequestFactory


def _live_job(**kwargs):
    customer = kwargs.pop("customer", None) or UserFactory(role=User.Role.CUSTOMER)
    worker = kwargs.pop("worker", None) or UserFactory(role=User.Role.WORKER)
    return JobRequestFactory(
        customer=customer,
        worker=worker,
        status=kwargs.pop("status", JobRequest.Status.ACCEPTED),
        **kwargs,
    )


@pytest.mark.django_db
def test_try_match_enqueues_push_to_the_candidate_worker(worker_profile_factory):
    job = JobRequestFactory(status=JobRequest.Status.SEARCHING)
    profile = worker_profile_factory(job)

    with mock.patch("jobs.matching.send_push_notification") as mock_task:
        try_match(job)

    mock_task.delay.assert_called_once()
    args, kwargs = mock_task.delay.call_args
    assert args[0] == profile.user_id
    assert kwargs["data"] == {"type": "job_offer", "job_id": job.id}


@pytest.mark.django_db
def test_accept_offer_enqueues_push_to_the_customer(api_client):
    offer = JobOfferFactory()
    api_client.force_authenticate(user=offer.worker)

    with mock.patch("jobs.views.send_push_notification") as mock_task:
        response = api_client.post(f"/api/jobs/offers/{offer.pk}/accept/")

    assert response.status_code == 200
    mock_task.delay.assert_called_once()
    args, kwargs = mock_task.delay.call_args
    assert args[0] == offer.job.customer_id
    assert kwargs["data"] == {"type": "job_accepted", "job_id": offer.job_id}


@pytest.mark.django_db
def test_message_from_customer_enqueues_push_to_the_worker(api_client):
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    with mock.patch("jobs.views.send_push_notification") as mock_task:
        response = api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "On my way"})

    assert response.status_code == 201
    mock_task.delay.assert_called_once()
    args, kwargs = mock_task.delay.call_args
    assert args[0] == job.worker_id
    assert kwargs["data"] == {"type": "chat_message", "job_id": job.id}


@pytest.mark.django_db
def test_message_from_worker_enqueues_push_to_the_customer(api_client):
    job = _live_job()
    worker = User.objects.get(pk=job.worker_id)
    api_client.force_authenticate(user=worker)

    with mock.patch("jobs.views.send_push_notification") as mock_task:
        response = api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "Sounds good"})

    assert response.status_code == 201
    mock_task.delay.assert_called_once()
    args, kwargs = mock_task.delay.call_args
    assert args[0] == job.customer_id
    assert kwargs["data"] == {"type": "chat_message", "job_id": job.id}


@pytest.fixture
def worker_profile_factory():
    from django.contrib.gis.geos import Point

    from accounts.tests.factories import WorkerProfileFactory

    def _make(job):
        profile = WorkerProfileFactory(
            is_online=True, last_location=Point(17.0658, -22.5609)
        )
        profile.categories.add(job.category)
        return profile

    return _make
