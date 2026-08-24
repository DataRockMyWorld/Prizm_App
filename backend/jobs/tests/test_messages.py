import pytest

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest, Message
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


@pytest.mark.django_db
def test_customer_and_worker_can_both_list_and_send(api_client):
    job = _live_job()

    api_client.force_authenticate(user=job.customer)
    assert api_client.get(f"/api/jobs/{job.pk}/messages/").status_code == 200
    assert api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "On my way"}).status_code == 201

    worker = User.objects.get(pk=job.worker_id)
    api_client.force_authenticate(user=worker)
    assert api_client.get(f"/api/jobs/{job.pk}/messages/").status_code == 200
    assert api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "Sounds good"}).status_code == 201


@pytest.mark.django_db
def test_unrelated_user_gets_403_on_list_and_create(api_client):
    job = _live_job()
    outsider = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=outsider)

    assert api_client.get(f"/api/jobs/{job.pk}/messages/").status_code == 403
    assert api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "hi"}).status_code == 403


@pytest.mark.django_db
def test_create_rejects_blank_and_whitespace_only_text(api_client):
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    assert api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": ""}).status_code == 400
    assert api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "   "}).status_code == 400
    assert not Message.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_create_rejected_when_no_worker_assigned(api_client):
    job = JobRequestFactory(status=JobRequest.Status.SEARCHING)  # no worker
    api_client.force_authenticate(user=job.customer)

    response = api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "Anyone there?"})

    assert response.status_code == 400
    assert not Message.objects.filter(job=job).exists()


@pytest.mark.parametrize(
    "status",
    [JobRequest.Status.COMPLETED, JobRequest.Status.CANCELLED, JobRequest.Status.DISPUTED],
)
@pytest.mark.django_db
def test_create_rejected_once_job_is_terminal_but_reading_still_works(api_client, status):
    job = _live_job(status=status)
    MessageFactory(job=job, sender=job.customer, text="earlier message")
    api_client.force_authenticate(user=job.customer)

    post_response = api_client.post(f"/api/jobs/{job.pk}/messages/", {"text": "still here?"})
    get_response = api_client.get(f"/api/jobs/{job.pk}/messages/")

    assert post_response.status_code == 400
    assert get_response.status_code == 200
    assert len(get_response.data) == 1


@pytest.mark.django_db
def test_messages_are_ordered_oldest_first(api_client):
    job = _live_job()
    first = MessageFactory(job=job, sender=job.customer, text="first")
    second = MessageFactory(job=job, sender=job.customer, text="second")
    third = MessageFactory(job=job, sender=job.customer, text="third")
    api_client.force_authenticate(user=job.customer)

    response = api_client.get(f"/api/jobs/{job.pk}/messages/")

    assert [row["id"] for row in response.data] == [first.pk, second.pk, third.pk]


@pytest.mark.django_db
def test_last_message_is_null_with_no_messages(api_client):
    job = _live_job()
    api_client.force_authenticate(user=job.customer)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.data["last_message"] is None


@pytest.mark.django_db
def test_last_message_reflects_the_most_recent_one(api_client):
    job = _live_job()
    MessageFactory(job=job, sender=job.customer, text="older")
    newer = MessageFactory(job=job, sender=job.customer, text="newer")
    api_client.force_authenticate(user=job.customer)

    response = api_client.get(f"/api/jobs/{job.pk}/")

    assert response.data["last_message"]["text"] == "newer"
    assert response.data["last_message"]["sender_id"] == newer.sender_id
