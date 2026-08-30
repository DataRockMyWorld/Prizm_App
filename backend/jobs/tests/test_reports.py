import pytest

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest, Report
from jobs.tests.factories import JobRequestFactory, MessageFactory


def _live_job(**kwargs):
    customer = kwargs.pop("customer", None) or UserFactory(role=User.Role.CUSTOMER)
    worker = kwargs.pop("worker", None) or UserFactory(role=User.Role.WORKER)
    return JobRequestFactory(
        customer=customer,
        worker=worker,
        status=kwargs.pop("status", JobRequest.Status.ACCEPTED),
        **kwargs,
    )


@pytest.mark.parametrize(
    "category",
    ["no_show", "safety_concern", "quality_of_work", "pricing_disagreement"],
)
@pytest.mark.django_db
def test_existing_job_outcome_categories_still_work_with_no_message(api_client, category):
    """Regression: the pre-existing report-the-user path (no message_id)
    behaves exactly as it did before this ticket."""
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/report/", {"category": category})

    assert response.status_code == 201
    report = Report.objects.get(pk=response.data["id"])
    assert report.category == category
    assert report.message is None


@pytest.mark.parametrize(
    "category",
    ["harassment", "inappropriate_content", "spam", "other"],
)
@pytest.mark.django_db
def test_new_chat_categories_validate_like_existing_ones(api_client, category):
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/report/", {"category": category})

    assert response.status_code == 201
    assert Report.objects.get(pk=response.data["id"]).category == category


@pytest.mark.django_db
def test_report_with_message_id_belonging_to_the_job_sets_message(api_client):
    job = _live_job()
    message = MessageFactory(job=job, sender=job.worker, text="you're ugly")
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(
        f"/api/jobs/{job.pk}/report/",
        {"category": "harassment", "message_id": message.pk},
    )

    assert response.status_code == 201
    report = Report.objects.get(pk=response.data["id"])
    assert report.message_id == message.pk


@pytest.mark.django_db
def test_report_with_message_id_from_a_different_job_is_rejected(api_client):
    job = _live_job()
    other_job = _live_job()
    other_message = MessageFactory(job=other_job, sender=other_job.worker, text="hi")
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(
        f"/api/jobs/{job.pk}/report/",
        {"category": "harassment", "message_id": other_message.pk},
    )

    assert response.status_code == 404
    assert not Report.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_report_with_nonexistent_message_id_is_rejected(api_client):
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(
        f"/api/jobs/{job.pk}/report/",
        {"category": "harassment", "message_id": 999999},
    )

    assert response.status_code == 404
    assert not Report.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_worker_can_also_report_a_specific_message(api_client):
    job = _live_job()
    message = MessageFactory(job=job, sender=job.customer, text="unpleasant")
    worker = User.objects.get(pk=job.worker_id)
    api_client.force_authenticate(user=worker)

    response = api_client.post(
        f"/api/jobs/{job.pk}/report/",
        {"category": "inappropriate_content", "message_id": message.pk},
    )

    assert response.status_code == 201
    assert Report.objects.get(pk=response.data["id"]).message_id == message.pk


@pytest.mark.django_db
def test_unrelated_user_gets_403_reporting_a_message(api_client):
    job = _live_job()
    message = MessageFactory(job=job, sender=job.worker, text="hi")
    outsider = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=outsider)

    response = api_client.post(
        f"/api/jobs/{job.pk}/report/",
        {"category": "harassment", "message_id": message.pk},
    )

    assert response.status_code == 403
    assert not Report.objects.filter(job=job).exists()
