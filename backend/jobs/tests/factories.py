from datetime import timedelta

import factory
from django.contrib.gis.geos import Point
from django.utils import timezone

from accounts.models import User
from accounts.tests.factories import UserFactory
from jobs.models import JobOffer, JobRequest, Message
from services.tests.factories import ServiceCategoryFactory

# Windhoek, Namibia — a real coordinate keeps geography-field validation
# realistic without depending on any particular job's actual location.
WINDHOEK = Point(17.0658, -22.5609)


class JobRequestFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = JobRequest

    customer = factory.SubFactory(UserFactory, role=User.Role.CUSTOMER)
    category = factory.SubFactory(ServiceCategoryFactory)
    description = factory.Faker("sentence")
    location = WINDHOEK
    address = "14 Independence Ave, Windhoek"
    status = JobRequest.Status.SEARCHING
    price_range_min = 150
    price_range_max = 300


class JobOfferFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = JobOffer

    job = factory.SubFactory(JobRequestFactory)
    worker = factory.SubFactory(UserFactory, role=User.Role.WORKER)
    responds_by = factory.LazyFunction(lambda: timezone.now() + timedelta(seconds=60))


class MessageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Message

    job = factory.SubFactory(JobRequestFactory)
    sender = factory.SubFactory(UserFactory)
    text = factory.Faker("sentence")
