from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

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
    photo = models.ImageField(upload_to="user_photos/", blank=True, null=True)
    liability_acknowledged_at = models.DateTimeField(null=True, blank=True)
    biometric_enabled = models.BooleanField(default=False)

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

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="worker_profile"
    )
    categories = models.ManyToManyField(
        "services.ServiceCategory", related_name="workers", blank=True
    )
    id_document = models.FileField(upload_to="id_documents/", blank=True, null=True)
    verified = models.BooleanField(default=False)
    is_online = models.BooleanField(default=False)
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.FREE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    document = models.FileField(upload_to="certifications/")
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("worker", "category")

    def __str__(self):
        return f"{self.worker} — {self.category} ({self.status})"


class PhoneOTP(models.Model):
    """A one-time code sent to `phone_number` to verify ownership during onboarding.

    Local dev has no SMS gateway — codes are logged to the console instead
    (see accounts.views).
    """

    phone_number = models.CharField(max_length=20, validators=[phone_number_validator])
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["phone_number", "is_used"])]

    def __str__(self):
        return f"OTP for {self.phone_number} ({'used' if self.is_used else 'active'})"
