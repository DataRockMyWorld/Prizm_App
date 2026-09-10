"""The on-site evaluate step: quote / confirm-quote / reject-quote / decline.
See docs/prds/active-job-flow-v2.md §5-6.
"""

import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import CancellationLog, JobRequest
from jobs.tests.factories import JobRequestFactory


def _arrived_job(worker):
    return JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.ARRIVED,
        accepted_at=timezone.now(),
        arrived_at=timezone.now(),
    )


# --- quote ----------------------------------------------------------------


@pytest.mark.django_db
def test_worker_sends_first_quote_from_arrived(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _arrived_job(worker)
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/quote/",
        {"agreed_price": "275.50", "note": "both bedrooms + kitchen"},
        format="json",
    )

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_PENDING
    assert str(job.agreed_price) == "275.50"
    assert job.worker_note == "both bedrooms + kitchen"
    assert job.quoted_at is not None


@pytest.mark.django_db
def test_worker_can_overwrite_a_quote_while_still_pending(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _arrived_job(worker)
    api_client.force_authenticate(user=worker)
    api_client.post(f"/api/jobs/{job.pk}/quote/", {"agreed_price": "200.00"}, format="json")
    job.refresh_from_db()
    first_quoted_at = job.quoted_at

    response = api_client.post(
        f"/api/jobs/{job.pk}/quote/", {"agreed_price": "260.00"}, format="json"
    )

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_PENDING
    assert str(job.agreed_price) == "260.00"
    # quoted_at is stamped once (when the customer first saw a price), not
    # bumped on every correction.
    assert job.quoted_at == first_quoted_at


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        JobRequest.Status.ACCEPTED,
        JobRequest.Status.QUOTE_ACCEPTED,
        JobRequest.Status.IN_PROGRESS,
        JobRequest.Status.COMPLETED,
    ],
)
def test_quote_rejected_from_wrong_status(api_client, status):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=status)
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/quote/", {"agreed_price": "100.00"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_quote_requires_a_positive_price(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = _arrived_job(worker)
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/quote/", {"agreed_price": "0"}, format="json"
    )

    assert response.status_code == 400


# --- confirm / reject ----------------------------------------------------


@pytest.mark.django_db
def test_customer_confirms_quote(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=JobRequest.Status.QUOTE_PENDING,
        arrived_at=timezone.now(),
        quoted_at=timezone.now(),
        agreed_price="275.00",
    )
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/confirm-quote/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_ACCEPTED
    assert job.quote_accepted_at is not None


@pytest.mark.django_db
def test_worker_cannot_confirm_their_own_quote(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.QUOTE_PENDING, agreed_price="275.00"
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/confirm-quote/")

    assert response.status_code in (403,)
    job.refresh_from_db()
    assert job.status == JobRequest.Status.QUOTE_PENDING


@pytest.mark.django_db
def test_customer_rejects_quote_closes_the_job(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.QUOTE_PENDING, agreed_price="275.00"
    )
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/reject-quote/")

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.CANCELLED


@pytest.mark.django_db
def test_confirm_and_reject_rejected_when_no_quote_pending(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.ARRIVED)
    api_client.force_authenticate(user=job.customer)

    assert api_client.post(f"/api/jobs/{job.pk}/confirm-quote/").status_code == 400
    assert api_client.post(f"/api/jobs/{job.pk}/reject-quote/").status_code == 400


# --- decline -----------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status", [JobRequest.Status.ARRIVED, JobRequest.Status.QUOTE_PENDING]
)
def test_worker_declines_on_site(api_client, status):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker,
        status=status,
        accepted_at=timezone.now(),
        arrived_at=timezone.now(),
    )
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/decline/",
        {"reason": "job_details_unclear", "note": "not what was described"},
        format="json",
    )

    assert response.status_code == 200
    job.refresh_from_db()
    assert job.status == JobRequest.Status.DECLINED
    log = CancellationLog.objects.get(job=job)
    assert log.kind == CancellationLog.Kind.ON_SITE_DECLINE
    assert log.reason == "job_details_unclear"
    assert log.note == "not what was described"
    # worker stays attached for the customer's "declined by X" screen
    assert job.worker_id == worker.id


@pytest.mark.django_db
def test_declined_job_exposes_decline_reason_to_the_customer(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.ARRIVED, arrived_at=timezone.now()
    )
    api_client.force_authenticate(user=worker)
    api_client.post(
        f"/api/jobs/{job.pk}/decline/", {"reason": "transport_issue"}, format="json"
    )

    api_client.force_authenticate(user=job.customer)
    data = api_client.get(f"/api/jobs/{job.pk}/").json()
    assert data["status"] == "declined"
    assert data["decline_reason"] == "Vehicle or transport issue"


@pytest.mark.django_db
def test_decline_reason_is_null_for_a_non_declined_job(api_client):
    job = JobRequestFactory(status=JobRequest.Status.QUOTE_PENDING, agreed_price="200.00")
    api_client.force_authenticate(user=job.customer)
    data = api_client.get(f"/api/jobs/{job.pk}/").json()
    assert data["decline_reason"] is None


@pytest.mark.django_db
def test_decline_requires_a_reason(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.ARRIVED)
    api_client.force_authenticate(user=worker)

    response = api_client.post(f"/api/jobs/{job.pk}/decline/", {}, format="json")

    assert response.status_code == 400
    job.refresh_from_db()
    assert job.status == JobRequest.Status.ARRIVED


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        JobRequest.Status.ACCEPTED,
        JobRequest.Status.QUOTE_ACCEPTED,
        JobRequest.Status.IN_PROGRESS,
    ],
)
def test_decline_rejected_outside_the_evaluate_window(api_client, status):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=status)
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/decline/", {"reason": "other"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_declined_job_is_terminal_and_not_rematched(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(
        worker=worker, status=JobRequest.Status.ARRIVED, arrived_at=timezone.now()
    )
    api_client.force_authenticate(user=worker)
    api_client.post(
        f"/api/jobs/{job.pk}/decline/", {"reason": "other"}, format="json"
    )

    from jobs.matching import try_match

    job.refresh_from_db()
    try_match(job)  # must be a no-op — job is terminal
    job.refresh_from_db()
    assert job.status == JobRequest.Status.DECLINED
    assert not job.offers.exists()


# --- dispute-price (post-completion only) -------------------------------


@pytest.mark.django_db
def test_dispute_price_only_after_completion(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    completed = JobRequestFactory(
        worker=worker, status=JobRequest.Status.COMPLETED, agreed_price="250.00"
    )
    pending = JobRequestFactory(
        worker=worker, status=JobRequest.Status.QUOTE_PENDING, agreed_price="250.00"
    )

    api_client.force_authenticate(user=pending.customer)
    assert api_client.post(f"/api/jobs/{pending.pk}/dispute-price/").status_code == 400

    api_client.force_authenticate(user=completed.customer)
    response = api_client.post(
        f"/api/jobs/{completed.pk}/dispute-price/", {"details": "charged more"}, format="json"
    )
    assert response.status_code == 200
    completed.refresh_from_db()
    assert completed.status == JobRequest.Status.DISPUTED
    assert completed.reports.filter(category="pricing_disagreement").exists()
