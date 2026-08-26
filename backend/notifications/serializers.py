from rest_framework import serializers

from .models import PushToken


class RegisterDeviceSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=PushToken.Platform.choices)


class UnregisterDeviceSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
