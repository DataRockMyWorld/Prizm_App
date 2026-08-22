import pytest
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest
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
