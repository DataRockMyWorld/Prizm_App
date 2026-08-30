from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.gis.db import models as gis_models
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from config.storage_backends import unique_upload_path
from config.validators import validate_file_size

phone_number_validator = RegexValidator(
    regex=r"^\+?[1-9]\d{7,14}$",
    message="Enter a valid phone number in international format, e.g. +264811234567.",
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone_number, password, **extra_fields):
        if not phone_number:
            raise ValueError("Users must have a phone number.")
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone_number, password, **extra_fields)

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.CUSTOMER)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Phone + PIN authenticated user.

    The inherited `password` field stores the hashed PIN — auth is phone
    number + SMS OTP + PIN, not a traditional password, but reusing
    Django's password hashing/`set_password`/`check_password` machinery
    for the PIN keeps auth, admin, and `createsuperuser` working as-is.
    """

    class Role(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        WORKER = "worker", "Worker"

    phone_number = models.CharField(
        max_length=20, unique=True, validators=[phone_number_validator]
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    full_name = models.CharField(max_length=150, blank=True)
    photo = models.ImageField(
        upload_to=unique_upload_path("user_photos"),
        blank=True,
        null=True,
        validators=[validate_file_size],
    )
    liability_acknowledged_at = models.DateTimeField(null=True, blank=True)
    # Account deletion anonymizes rather than hard-deletes the row (see
    # DeleteAccountView) — deleted_at is the actual "is this deleted" signal;
    # is_active is also set False on deletion (blocks login/JWT auth
    # immediately, see JWTAuthentication.get_user) but isn't reused as the
    # sole deletion marker, since some future "suspended" state might also
    # want is_active=False without meaning "deleted."
    deleted_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["role"]

    def __str__(self):
        return self.phone_number


class WorkerProfile(models.Model):
    class SubscriptionStatus(models.TextChoices):
        FREE = "free", "Free"
        SUBSCRIBED = "subscribed", "Subscribed"

    class IDStatus(models.TextChoices):
        NOT_SUBMITTED = "not_submitted", "Not submitted"
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="worker_profile"
    )
    categories = models.ManyToManyField(
        "services.ServiceCategory", related_name="workers", blank=True
    )
    id_document = models.FileField(
        upload_to=unique_upload_path("id_documents"),
        blank=True,
        null=True,
        validators=[validate_file_size],
    )
    id_document_back = models.FileField(
        upload_to=unique_upload_path("id_documents"),
        blank=True,
        null=True,
        validators=[validate_file_size],
    )
    id_status = models.CharField(
        max_length=20, choices=IDStatus.choices, default=IDStatus.NOT_SUBMITTED
    )
    id_reviewed_at = models.DateTimeField(null=True, blank=True)
    id_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="id_reviews",
    )
    id_rejection_reason = models.TextField(blank=True)
    is_online = models.BooleanField(default=False)
    last_location = gis_models.PointField(geography=True, null=True, blank=True)
    last_location_updated_at = models.DateTimeField(null=True, blank=True)
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.FREE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def verified(self):
        """ID approved — the "Verified" badge described in CLAUDE.md."""
        return self.id_status == self.IDStatus.APPROVED

    def __str__(self):
        return f"WorkerProfile<{self.user.phone_number}>"


class CustomerProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="customer_profile"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CustomerProfile<{self.user.phone_number}>"


class Certification(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.CASCADE, related_name="certifications"
    )
    category = models.ForeignKey(
        "services.ServiceCategory",
        on_delete=models.CASCADE,
        related_name="certifications",
    )
    document = models.FileField(
        upload_to=unique_upload_path("certifications"), validators=[validate_file_size]
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certification_reviews",
    )
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("worker", "category")

    def __str__(self):
        return f"{self.worker} — {self.category} ({self.status})"


class Block(models.Model):
    """An account-wide, persistent block between two users, created from a
    job's chat once that job is terminal (see jobs.views.BlockCounterpartView
    and docs/prds/chat-safety.md). Lives here rather than in the jobs app
    because it's fundamentally a User<->User relationship the matching
    engine (jobs.matching) needs to consult independent of any one job.

    Only one row is ever created per pair, regardless of who initiated the
    block — jobs.matching checks both directions (blocker and blocked) when
    excluding candidates, so the block is effectively bidirectional for
    matching purposes without needing a second row.
    """

    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks_received")
    # Audit pointer only — which job's chat triggered this block. Never read
    # by matching logic. SET_NULL so a JobRequest deletion can never be
    # blocked by an old Block row referencing it.
    job = models.ForeignKey(
        "jobs.JobRequest", on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("blocker", "blocked")

    def __str__(self):
        return f"Block({self.blocker_id} -> {self.blocked_id})"


class Address(models.Model):
    """A customer's saved address (e.g. "Home", "Work"), freeform and reusable.

    FK'd to `User` rather than `CustomerProfile` — nothing here is
    role-specific, even though only the customer app exposes CRUD UI for
    it today.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=100)
    address_text = models.CharField(max_length=255)
    location = gis_models.PointField(geography=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.label} — {self.user.phone_number}"


class PhoneOTP(models.Model):
    """A one-time code sent to `phone_number` to verify ownership during onboarding.

    Local dev has no SMS gateway — codes are logged to the console instead
    (see accounts.views).
    """

    phone_number = models.CharField(max_length=20, validators=[phone_number_validator])
    # Hashed the same way the PIN is (Django's make_password/check_password)
    # — the raw code is never stored, so a staff account browsing Django
    # admin can no longer read a live, usable OTP for any phone number.
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["phone_number", "is_used"])]

    def __str__(self):
        return f"OTP for {self.phone_number} ({'used' if self.is_used else 'active'})"
