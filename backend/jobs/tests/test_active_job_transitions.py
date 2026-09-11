"""Worker-side status transitions for the v2 flow:
accepted → arrived → quote_pending → quote_accepted → in_progress → completed.
Quote / decline / reject specifics live in test_quote_and_decline.py.
"""

import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest
from jobs.tests.factories import JobRequestFactory


@pytest.mark.django_db
def test_arrived_from_accepted_sets_timestamp_and_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.ACCEPTED,
        accepted_at=timezone.now(),
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/arrived/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.ARRIVED
    assert job.arrived_at is not None
    assert job.started_at is None


@pytest.mark.django_db
def test_arrived_rejected_from_wrong_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.SEARCHING)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/arrived/")

    assert response.status_code == 400
    job.refresh_from_db()
    assert job.status == JobRequest.Status.SEARCHING
    assert job.arrived_at is None


@pytest.mark.django_db
def test_start_from_quote_accepted_sets_timestamp_and_status(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.QUOTE_ACCEPTED,
        arrived_at=timezone.now(),
        quoted_at=timezone.now(),
        quote_accepted_at=timezone.now(),
        agreed_price="250.00",
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/start/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.IN_PROGRESS
    assert job.started_at is not None


@pytest.mark.django_db
def test_start_rejected_before_quote_accepted(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.QUOTE_PENDING,
        arrived_at=timezone.now(),
        quoted_at=timezone.now(),
        agreed_price="250.00",
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/start/")

    assert response.status_code == 400
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_PENDING
    assert job.started_at is None


@pytest.mark.django_db
def test_complete_takes_no_body_and_only_works_in_progress(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.IN_PROGRESS,
        started_at=timezone.now(),
        agreed_price="250.00",
        worker_note="agreed on site",
    )
    api_client.force_authenticate(user=worker)

    # A stray price in the body is simply ignored — completion no longer
    # carries pricing.
    response = api_client.post(
        f"/api/jobs/{job.pk}/complete/", {"agreed_price": "999.99"}, format="json"
    )

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.COMPLETED
    assert str(job.agreed_price) == "250.00"


@pytest.mark.django_db
def test_complete_rejected_when_not_in_progress(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.QUOTE_ACCEPTED)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/complete/")

    assert response.status_code == 400
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_ACCEPTED


@pytest.mark.django_db
def test_transition_rejected_for_a_worker_who_is_not_assigned(api_client):
    other_worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=UserFactory(role=User.Role.WORKER), status=JobRequest.Status.ACCEPTED
    )
    api_client.force_authenticate(user=other_worker)

    response = api_client.post(f"/api/jobs/{job.pk}/arrived/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_full_happy_chain_end_to_end(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.ACCEPTED,
        accepted_at=timezone.now(),
    )
    api_client.force_authenticate(user=worker)
    assert api_client.post(f"/api/jobs/{job.pk}/arrived/").status_code == 200
    assert (
        api_client.post(
            f"/api/jobs/{job.pk}/quote/", {"agreed_price": "300.00"}, format="json"
        ).status_code
        == 200
    )

    api_client.force_authenticate(user=job.customer)
    assert api_client.post(f"/api/jobs/{job.pk}/confirm-quote/").status_code == 200

    api_client.force_authenticate(user=worker)
    assert api_client.post(f"/api/jobs/{job.pk}/start/").status_code == 200
    assert api_client.post(f"/api/jobs/{job.pk}/complete/").status_code == 200

    job.refresh_from_db()
    assert job.status == JobRequest.Status.COMPLETED
    assert str(job.agreed_price) == "300.00"
    for field in ("accepted_at", "arrived_at", "quoted_at", "quote_accepted_at", "started_at"):
        assert getattr(job, field) is not None, field


@pytest.mark.django_db
def test_job_detail_exposes_v2_stage_timestamps(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.QUOTE_PENDING,
        accepted_at=timezone.now(),
        arrived_at=timezone.now(),
        quoted_at=timezone.now(),
        agreed_price="200.00",
    )
    api_client.force_authenticate(user=job.customer)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.status_code == 200
    data = response.json()
    assert "on_my_way_at" not in data
    assert data["arrived_at"] is not None
    assert data["quoted_at"] is not None
    assert data["quote_accepted_at"] is None
    assert data["started_at"] is None
    assert data["worker"]["jobs_completed"] == 2
