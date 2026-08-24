import pytest

from accounts.models import Address, User
from accounts.tests.factories import AddressFactory, UserFactory


@pytest.mark.django_db
def test_list_returns_only_the_requesting_users_addresses(api_client):
    owner = UserFactory(role=User.Role.CUSTOMER)
    other = UserFactory(role=User.Role.CUSTOMER)
    mine = AddressFactory(user=owner, label="Home")
    AddressFactory(user=other, label="Their place")
    api_client.force_authenticate(user=owner)

    response = api_client.get("/api/auth/addresses/")

    assert response.status_code == 200
    ids = [row["id"] for row in response.data]
    assert ids == [mine.pk]


@pytest.mark.django_db
def test_create_sets_owner_from_the_authenticated_request(api_client):
    user = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        "/api/auth/addresses/",
        {
            "label": "Work",
            "address_text": "7 Sam Nujoma Dr, Windhoek",
            "latitude": -22.5700,
            "longitude": 17.0836,
        },
    )

    assert response.status_code == 201
    address = Address.objects.get(pk=response.data["id"])
    assert address.user == user
    assert address.location.y == pytest.approx(-22.5700)
    assert address.location.x == pytest.approx(17.0836)


@pytest.mark.django_db
def test_create_requires_label_address_text_and_coordinates(api_client):
    user = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/addresses/", {})

    assert response.status_code == 400
    for field in ("label", "address_text", "latitude", "longitude"):
        assert field in response.data


@pytest.mark.django_db
def test_retrieve_another_users_address_returns_404(api_client):
    other = UserFactory(role=User.Role.CUSTOMER)
    address = AddressFactory(user=other)
    requester = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=requester)

    response = api_client.get(f"/api/auth/addresses/{address.pk}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_update_another_users_address_returns_404_and_does_not_change_it(api_client):
    other = UserFactory(role=User.Role.CUSTOMER)
    address = AddressFactory(user=other, label="Original")
    requester = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=requester)

    response = api_client.patch(f"/api/auth/addresses/{address.pk}/", {"label": "Hijacked"})

    assert response.status_code == 404
    address.refresh_from_db()
    assert address.label == "Original"


@pytest.mark.django_db
def test_delete_another_users_address_returns_404_and_does_not_delete_it(api_client):
    other = UserFactory(role=User.Role.CUSTOMER)
    address = AddressFactory(user=other)
    requester = UserFactory(role=User.Role.CUSTOMER)
    api_client.force_authenticate(user=requester)

    response = api_client.delete(f"/api/auth/addresses/{address.pk}/")

    assert response.status_code == 404
    assert Address.objects.filter(pk=address.pk).exists()


@pytest.mark.django_db
def test_owner_can_update_and_delete_their_own_address(api_client):
    user = UserFactory(role=User.Role.CUSTOMER)
    address = AddressFactory(user=user, label="Home")
    api_client.force_authenticate(user=user)

    update_response = api_client.patch(f"/api/auth/addresses/{address.pk}/", {"label": "Updated"})
    assert update_response.status_code == 200
    address.refresh_from_db()
    assert address.label == "Updated"

    delete_response = api_client.delete(f"/api/auth/addresses/{address.pk}/")
    assert delete_response.status_code == 204
    assert not Address.objects.filter(pk=address.pk).exists()
