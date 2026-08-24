import pytest

from accounts.models import User
from accounts.tests.factories import CustomerProfileFactory, WorkerProfileFactory
from jobs.models import JobRequest, Rating
from jobs.tests.factories import JobRequestFactory


@pytest.mark.django_db
def test_worker_profile_stats_are_zero_and_null_with_no_jobs(api_client):
    worker_profile = WorkerProfileFactory()
    api_client.force_authenticate(user=worker_profile.user)

    response = api_client.get("/api/auth/worker-profile/")

    assert response.status_code == 200
    assert response.data["jobs_completed"] == 0
    assert response.data["rating_average"] is None


@pytest.mark.django_db
def test_worker_profile_jobs_completed_counts_only_completed_status(api_client):
    worker_profile = WorkerProfileFactory()
    JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.CANCELLED)
    JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.IN_PROGRESS)
    api_client.force_authenticate(user=worker_profile.user)

    response = api_client.get("/api/auth/worker-profile/")

    assert response.data["jobs_completed"] == 2


@pytest.mark.django_db
def test_worker_profile_rating_average_only_averages_completed_jobs(api_client):
    worker_profile = WorkerProfileFactory()
    rated_job_a = JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.COMPLETED)
    Rating.objects.create(job=rated_job_a, stars=5)
    rated_job_b = JobRequestFactory(worker=worker_profile.user, status=JobRequest.Status.COMPLETED)
    Rating.objects.create(job=rated_job_b, stars=3)
    unrated_completed_job = JobRequestFactory(
        worker=worker_profile.user, status=JobRequest.Status.COMPLETED
    )
    # Shouldn't happen in practice, but a rating on a non-completed job must
    # not skew the average — asserted explicitly per the ticket.
    cancelled_but_rated_job = JobRequestFactory(
        worker=worker_profile.user, status=JobRequest.Status.CANCELLED
    )
    Rating.objects.create(job=cancelled_but_rated_job, stars=1)
    api_client.force_authenticate(user=worker_profile.user)

    response = api_client.get("/api/auth/worker-profile/")

    assert response.data["rating_average"] == 4.0
    assert unrated_completed_job.pk is not None  # sanity: exists, just unrated


@pytest.mark.django_db
def test_customer_profile_requests_completed_counts_only_completed_status(api_client):
    customer_profile = CustomerProfileFactory()
    JobRequestFactory(customer=customer_profile.user, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(customer=customer_profile.user, status=JobRequest.Status.CANCELLED)
    JobRequestFactory(customer=customer_profile.user, status=JobRequest.Status.SEARCHING)
    api_client.force_authenticate(user=customer_profile.user)

    response = api_client.get("/api/auth/customer-profile/")

    assert response.status_code == 200
    assert response.data["requests_completed"] == 1


@pytest.mark.django_db
def test_customer_profile_rejects_worker_role(api_client):
    worker_profile = WorkerProfileFactory()
    api_client.force_authenticate(user=worker_profile.user)

    response = api_client.get("/api/auth/customer-profile/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_profile_exposes_date_joined_for_member_since(api_client):
    worker_profile = WorkerProfileFactory()
    api_client.force_authenticate(user=worker_profile.user)

    response = api_client.get("/api/auth/profile/")

    assert response.status_code == 200
    assert response.data["date_joined"] is not None
