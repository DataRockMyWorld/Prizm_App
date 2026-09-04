import pytest

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobRequest
from jobs.tests.factories import JobRequestFactory


@pytest.mark.django_db
def test_default_call_returns_everything_unpaginated(api_client):
    """Several other call sites (account-deletion's blocking-job check,
    the customer Messages tab) need the full history and must keep
    working — a bare GET with no query params is the contract they rely
    on, so it must stay a plain array, never the paginated shape."""
    customer = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(customer=customer, status=JobRequest.Status.SEARCHING)
    api_client.force_authenticate(user=customer)

    response = api_client.get("/api/jobs/")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 2


@pytest.mark.django_db
def test_status_group_active_excludes_terminal_jobs(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED)
    JobRequestFactory(customer=customer, status=JobRequest.Status.CANCELLED)
    active = JobRequestFactory(customer=customer, status=JobRequest.Status.ACCEPTED)
    api_client.force_authenticate(user=customer)

    response = api_client.get("/api/jobs/", {"status_group": "active"})

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert [job["id"] for job in data] == [active.pk]


@pytest.mark.django_db
def test_status_group_completed_excludes_active_jobs(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=customer, status=JobRequest.Status.SEARCHING)
    completed = JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED)
    disputed = JobRequestFactory(customer=customer, status=JobRequest.Status.DISPUTED)
    api_client.force_authenticate(user=customer)

    response = api_client.get("/api/jobs/", {"status_group": "completed"})

    assert response.status_code == 200
    ids = {job["id"] for job in response.json()}
    assert ids == {completed.pk, disputed.pk}


@pytest.mark.django_db
def test_completed_with_page_param_returns_paginated_shape(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    jobs = [
        JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED) for _ in range(3)
    ]
    api_client.force_authenticate(user=customer)

    response = api_client.get(
        "/api/jobs/", {"status_group": "completed", "page": 1, "page_size": 2}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3
    assert len(data["results"]) == 2
    assert data["next"] is not None
    assert data["previous"] is None
    # newest-first — the 3rd-created job (last in `jobs`) comes first
    assert data["results"][0]["id"] == jobs[-1].pk


@pytest.mark.django_db
def test_completed_page_two_has_the_remainder_and_a_previous_link(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    for _ in range(3):
        JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED)
    api_client.force_authenticate(user=customer)

    response = api_client.get(
        "/api/jobs/", {"status_group": "completed", "page": 2, "page_size": 2}
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["next"] is None
    assert data["previous"] is not None


@pytest.mark.django_db
def test_pagination_only_shows_the_authenticated_users_own_jobs(api_client):
    customer = UserFactory(role=User.Role.CUSTOMER)
    other_customer = UserFactory(role=User.Role.CUSTOMER)
    JobRequestFactory(customer=other_customer, status=JobRequest.Status.COMPLETED)
    mine = JobRequestFactory(customer=customer, status=JobRequest.Status.COMPLETED)
    api_client.force_authenticate(user=customer)

    response = api_client.get("/api/jobs/", {"status_group": "completed", "page": 1})

    data = response.json()
    assert data["count"] == 1
    assert data["results"][0]["id"] == mine.pk
