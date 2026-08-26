import factory

from accounts.tests.factories import UserFactory
from notifications.models import PushToken


class PushTokenFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PushToken

    user = factory.SubFactory(UserFactory)
    token = factory.Sequence(lambda n: f"ExponentPushToken[test-{n}]")
    platform = PushToken.Platform.IOS
