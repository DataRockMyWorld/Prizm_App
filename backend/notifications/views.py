from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushToken
from .serializers import RegisterDeviceSerializer, UnregisterDeviceSerializer


class RegisterDeviceView(APIView):
    """Upsert (by token) or drop the calling device's Expo push token.

    Upserting by token — not by (user, token) — means a token already
    registered to a different user gets reassigned to the caller rather
    than producing a duplicate row, which is what makes the shared-device
    "log out, someone else logs in" case behave correctly.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RegisterDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushToken.objects.update_or_create(
            token=serializer.validated_data["token"],
            defaults={
                "user": request.user,
                "platform": serializer.validated_data["platform"],
            },
        )
        return Response(status=200)

    def delete(self, request):
        serializer = UnregisterDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushToken.objects.filter(
            token=serializer.validated_data["token"], user=request.user
        ).delete()
        return Response(status=204)
