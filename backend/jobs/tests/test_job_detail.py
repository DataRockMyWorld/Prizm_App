import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest, Rating
from jobs.tests.factories import JobRequestFactory


@pytest.mark.django_db
def test_job_detail_exposes_customer_and_accepted_at_to_the_worker(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER, full_name="Sarah K.")
    worker = UserFactory(role=User.Role.WORKER)
    accepted_at = timezone.now()
    job = JobRequestFactory(
        customer=customer,
        worker=worker,
        status=JobRequest.Status.ACCEPTED,
        accepted_at=accepted_at,
    )
    api_client.force_authenticate(user=worker)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.status_code == 200
    assert response.data["customer"]["full_name"] == "Sarah K."
    assert response.data["accepted_at"] is not None


@pytest.mark.django_db
def test_job_detail_rating_is_null_until_rated(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    api_client.force_authenticate(user=worker)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.data["rating"] is None


@pytest.mark.django_db
def test_job_detail_exposes_rating_once_the_customer_has_rated(api_client):
    worker = UserFactory(role=User.Role.WORKER)
    job = JobRequestFactory(worker=worker, status=JobRequest.Status.COMPLETED)
    Rating.objects.create(job=job, stars=5, comment="Great work")
    api_client.force_authenticate(user=worker)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.data["rating"] == {"stars": 5, "comment": "Great work"}
