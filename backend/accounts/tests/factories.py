import factory
from django.contrib.auth import get_user_model

from accounts.models import CustomerProfile, WorkerProfile

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
