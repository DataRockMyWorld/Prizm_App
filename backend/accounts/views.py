import secrets
import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from jobs.models import JobRequest

from .models import Address, Certification, PhoneOTP, User
from .permissions import IsCustomerRole, IsWorkerRole
from .serializers import (
    OTP_TOKEN_SALT,
    AddressSerializer,
    CertificationSerializer,
    CustomerProfileSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    ProfileSerializer,
    RegisterSerializer,
    WorkerProfileSerializer,
)
from .throttles import OTPRequestThrottle, OTPVerifyThrottle, PinLoginThrottle

OTP_TTL_SECONDS = 300  # 5 minutes

# A 4-digit PIN is only 10,000 combinations — PinLoginThrottle (see throttles.py)
# caps request bursts, but a patient attacker could still spread guesses across
# hours/days within that rate. This adds a persistent per-phone lockout on top:
# once wrong, count resets on any successful login, so it never punishes normal
# typos, only sustained guessing.
PIN_LOGIN_LOCKOUT_THRESHOLD = 5
PIN_LOGIN_LOCKOUT_SECONDS = 15 * 60


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
            code_hash=make_password(code),
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

        # code_hash can't be matched with a direct `.filter(code=...)` equality
        # lookup any more (it's a salted hash, not the raw code) — check each
        # still-live candidate for this phone number instead. There can be
        # more than one (a new request doesn't invalidate an earlier unused
        # one yet), so this mirrors the previous behavior of accepting any
        # still-valid code, just via check_password instead of `==`.
        candidates = PhoneOTP.objects.filter(
            phone_number=phone_number, is_used=False, expires_at__gte=timezone.now()
        ).order_by("-created_at")
        otp = next((c for c in candidates if check_password(code, c.code_hash)), None)
        if otp is None:
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


class CustomerProfileView(generics.RetrieveAPIView):
    """Customer-only, read-only: stats for the Profile tab (requests_completed)."""

    serializer_class = CustomerProfileSerializer
    permission_classes = [IsAuthenticated, IsCustomerRole]

    def get_object(self):
        return self.request.user.customer_profile


class CertificationListCreateView(generics.ListCreateAPIView):
    """Worker-only: optional per-category certification uploads (screen 9)."""

    serializer_class = CertificationSerializer
    permission_classes = [IsAuthenticated, IsWorkerRole]

    def get_queryset(self):
        return Certification.objects.filter(worker=self.request.user.worker_profile)

    def perform_create(self, serializer):
        serializer.save(worker=self.request.user.worker_profile)


class AddressListCreateView(generics.ListCreateAPIView):
    """Saved addresses (Profile tab): freeform, full CRUD, scoped to the owner."""

    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.addresses.all()


class PinLoginView(TokenObtainPairView):
    """Phone + PIN login. Wraps the stock SimpleJWT view with a per-phone
    lockout (see PIN_LOGIN_LOCKOUT_* above) on top of PinLoginThrottle's
    request-rate cap — a 4-digit PIN needs both, since rate limiting alone
    still leaves the full keyspace guessable given enough time."""

    throttle_classes = [PinLoginThrottle]

    def post(self, request, *args, **kwargs):
        phone_number = request.data.get("phone_number", "")
        cache_key = f"pin-login-failures:{phone_number}"

        if phone_number and cache.get(cache_key, 0) >= PIN_LOGIN_LOCKOUT_THRESHOLD:
            return Response(
                {"detail": "Too many attempts. Try again in a few minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # SimpleJWT's TokenObtainPairView raises AuthenticationFailed on a bad
        # phone/PIN combo rather than returning a 401 Response — must catch it
        # here to count the failure, then re-raise so DRF's normal exception
        # handling still builds the response the client sees.
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            if phone_number:
                cache.set(cache_key, cache.get(cache_key, 0) + 1, PIN_LOGIN_LOCKOUT_SECONDS)
            raise

        if phone_number:
            cache.delete(cache_key)
        return response


class DeleteAccountView(APIView):
    """Real account deletion — anonymizes the User row in place rather than
    hard-`DELETE`ing it. A literal DELETE would cascade through
    JobRequest.customer and Message.sender (both CASCADE), destroying the
    *other* party's job/message history for any job they share — a customer
    deleting their account shouldn't blow a hole in a worker's completed-jobs
    record, and vice versa. This still satisfies "real deletion, not
    deactivation": login is permanently blocked (is_active=False, checked
    live on every request by JWTAuthentication.get_user — no separate token
    check needed, see docs/tickets/app-store-readiness.md T4), and PII is
    irrecoverably scrubbed, not just hidden."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.deleted_at is not None:
            return Response({"detail": "Account already deleted."}, status=status.HTTP_400_BAD_REQUEST)

        active_job = JobRequest.objects.filter(
            Q(customer=user) | Q(worker=user)
        ).exclude(status__in=JobRequest.TERMINAL_STATUSES).exists()
        if active_job:
            return Response(
                {"detail": "Finish or cancel your active job before deleting your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Not a real phone number — deliberately fails phone_number_validator
        # if ever re-validated (e.g. via a serializer/admin form), which is
        # fine: nothing should treat a deleted account's phone_number as a
        # real one again. Plain .save() below doesn't call full_clean(), so
        # the validator (only enforced on serializer/form validation, not at
        # the ORM level) never runs here.
        user.phone_number = f"deleted-{user.id}-{uuid.uuid4().hex[:8]}"
        user.full_name = ""
        if user.photo:
            user.photo.delete(save=False)
        user.set_unusable_password()
        user.is_active = False
        user.deleted_at = timezone.now()
        user.save(
            update_fields=["phone_number", "full_name", "photo", "password", "is_active", "deleted_at"]
        )

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)

        return Response(status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Actually revokes the session's refresh token (blacklists it), so a
    stolen/leaked token can be killed on demand instead of staying valid for
    its full 30-day lifetime regardless of what the app does client-side."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "refresh is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            # Already invalid/expired/blacklisted — the caller's goal (this
            # token must not work anymore) is already true either way.
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)
