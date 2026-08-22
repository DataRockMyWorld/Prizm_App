from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import CancellationLog, JobRequest
from jobs.tests.factories import JobRequestFactory


def _accepted_job(worker, accepted_at):
    return JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.ACCEPTED,
        accepted_at=accepted_at,
    )


@pytest.mark.django_db
def test_worker_cancel_within_window_reason_only(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _accepted_job(worker, timezone.now())
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/cancel/", {"reason": "personal_emergency"}, format="json"
    )

    assert response.status_code == 200
    log = CancellationLog.objects.get(job=job)
    assert log.reason == "personal_emergency"
    assert log.note == ""
    job.refresh_from_db()
    assert job.status == JobRequest.Status.SEARCHING


@pytest.mark.django_db
def test_worker_cancel_with_note(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _accepted_job(worker, timezone.now())
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/cancel/",
        {"reason": "transport_issue", "note": "Flat tire on the way there"},
        format="json",
    )

    assert response.status_code == 200
    log = CancellationLog.objects.get(job=job)
    assert log.note == "Flat tire on the way there"


@pytest.mark.django_db
def test_worker_cancel_past_window_rejected(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _accepted_job(worker, timezone.now() - timedelta(minutes=11))
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/cancel/", {"reason": "other"}, format="json"
    )

    assert response.status_code == 400
    assert not CancellationLog.objects.filter(job=job).exists()
    job.refresh_from_db()
    assert job.status == JobRequest.Status.ACCEPTED


@pytest.mark.django_db
def test_worker_cancel_missing_reason_rejected(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _accepted_job(worker, timezone.now())
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/cancel/", {}, format="json")

    assert response.status_code == 400
    assert not CancellationLog.objects.filter(job=job).exists()
