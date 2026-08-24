import factory
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point

from accounts.models import Address, CustomerProfile, WorkerProfile

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    phone_number = factory.Sequence(lambda n: f"+264800{n:06d}")
    role = User.Role.CUSTOMER
    full_name = factory.Faker("name")

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or "test-pin-1234")
        if create:
            self.save()


class WorkerProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = WorkerProfile

    user = factory.SubFactory(UserFactory, role=User.Role.WORKER)
    id_status = WorkerProfile.IDStatus.APPROVED


class CustomerProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CustomerProfile

    user = factory.SubFactory(UserFactory, role=User.Role.CUSTOMER)


class AddressFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Address

    user = factory.SubFactory(UserFactory, role=User.Role.CUSTOMER)
    label = factory.Sequence(lambda n: f"Address {n}")
    address_text = "14 Independence Ave, Windhoek"
    location = Point(17.0836, -22.5609, srid=4326)
