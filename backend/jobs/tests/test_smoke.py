import pytest

from jobs.models import JobRequest
from jobs.tests.factories import JobRequestFactory

# Baseline sanity check that the T0a factory chain (User -> ServiceCategory
# -> JobRequest) works end-to-end. Safe to delete once real coverage lands
# for the tickets that touch JobRequest.


@pytest.mark.django_db
def test_job_request_factory_creates_a_valid_matched_job():
    job = JobRequestFactory(status=JobRequest.Status.MATCHED)

    assert job.pk is not None
    assert job.customer.role == "customer"
    assert job.category.pk is not None
    assert job.status == JobRequest.Status.MATCHED
