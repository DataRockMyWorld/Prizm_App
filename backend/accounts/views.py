import secrets

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Certification, PhoneOTP, User
from .permissions import IsWorkerRole
from .serializers import (
    OTP_TOKEN_SALT,
    CertificationSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    ProfileSerializer,
    RegisterSerializer,
    WorkerProfileSerializer,
)
from .throttles import OTPRequestThrottle, OTPVerifyThrottle

OTP_TTL_SECONDS = 300  # 5 minutes


def _generate_otp_code():
    return f"{secrets.randbelow(1_000_000):06d}"


class RequestOTPView(APIView):
    """Step 1 of onboarding: send (or, in dev, log) a one-time code to a phone number."""

    permission_classes = [AllowAny]
    throttle_classes = [OTPRequestThrottle]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]

        code = _generate_otp_code()
        PhoneOTP.objects.create(
            phone_number=phone_number,
            code=code,
            expires_at=timezone.now() + timezone.timedelta(seconds=OTP_TTL_SECONDS),
        )

        if settings.DEBUG:
            print(f"[DEV OTP] {phone_number}: {code}")
        else:
            # No SMS gateway wired up yet — provider TBD.
            pass

        return Response({"detail": "OTP sent."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    """Step 2 of onboarding: exchange a valid code for a short-lived registration token."""

    permission_classes = [AllowAny]
    throttle_classes = [OTPVerifyThrottle]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data["phone_number"]
        code = serializer.validated_data["code"]

        otp = (
            PhoneOTP.objects.filter(phone_number=phone_number, code=code, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if otp is None or otp.expires_at < timezone.now():
            return Response(
                {"detail": "Invalid or expired code."}, status=status.HTTP_400_BAD_REQUEST
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        signer = signing.TimestampSigner(salt=OTP_TOKEN_SALT)
        otp_token = signer.sign(phone_number)

        return Response(
            {
                "otp_token": otp_token,
                "is_new_user": not User.objects.filter(phone_number=phone_number).exists(),
            },
            status=status.HTTP_200_OK,
        )


class RegisterView(APIView):
    """Step 3 of onboarding: set a PIN and create the account, keyed by role."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_201_CREATED,
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    """Final onboarding step (name + photo + liability ack) and general profile edits."""

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class WorkerProfileView(generics.RetrieveUpdateAPIView):
    """Worker-only: categories + ID document submission (screens 7b/8 in onboarding)."""

    serializer_class = WorkerProfileSerializer
    permission_classes = [IsAuthenticated, IsWorkerRole]

    def get_object(self):
        return self.request.user.worker_profile


class CertificationListCreateView(generics.ListCreateAPIView):
    """Worker-only: optional per-category certification uploads (screen 9)."""

    serializer_class = CertificationSerializer
    permission_classes = [IsAuthenticated, IsWorkerRole]

    def get_queryset(self):
        return Certification.objects.filter(worker=self.request.user.worker_profile)

    def perform_create(self, serializer):
        serializer.save(worker=self.request.user.worker_profile)
