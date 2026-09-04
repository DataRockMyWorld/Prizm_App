import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest
from jobs.tests.factories import JobRequestFactory


@pytest.mark.django_db
def test_on_my_way_sets_timestamp_and_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.ACCEPTED)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/on-my-way/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.ON_MY_WAY
    assert job.on_my_way_at is not None
    assert job.arrived_at is None
    assert job.started_at is None


@pytest.mark.django_db
def test_arrived_sets_timestamp_and_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.ON_MY_WAY, on_my_way_at=timezone.now()
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/arrived/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.ARRIVED
    assert job.arrived_at is not None
    assert job.started_at is None


@pytest.mark.django_db
def test_start_sets_timestamp_and_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.ARRIVED, arrived_at=timezone.now()
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/start/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.IN_PROGRESS
    assert job.started_at is not None


@pytest.mark.django_db
def test_on_my_way_rejected_from_wrong_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.SEARCHING)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/on-my-way/")

    assert response.status_code == 400
    job.refresh_from_db()
    assert job.status == JobRequest.Status.SEARCHING
    assert job.on_my_way_at is None


@pytest.mark.django_db
def test_job_detail_exposes_stage_timestamps_and_worker_jobs_completed(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.ARRIVED,
        accepted_at=timezone.now(),
        on_my_way_at=timezone.now(),
        arrived_at=timezone.now(),
    )
    api_client.force_authenticate(user=job.customer)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.status_code == 200
    data = response.json()
    assert data["on_my_way_at"] is not None
    assert data["arrived_at"] is not None
    assert data["started_at"] is None
    assert data["worker"]["jobs_completed"] == 2
