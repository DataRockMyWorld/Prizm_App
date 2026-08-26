from django.contrib.gis.geos import Point
from django.core import signing
from django.db.models import Avg
from django.utils import timezone
from rest_framework import serializers

from jobs.models import JobRequest, Rating
from services.models import ServiceCategory

from .models import (
    Address,
    Certification,
    CustomerProfile,
    User,
    WorkerProfile,
    phone_number_validator,
)

OTP_TOKEN_SALT = "accounts.phone-otp"
OTP_TOKEN_MAX_AGE = 60 * 10  # 10 minutes — must stay consistent with views.py


class OTPRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(validators=[phone_number_validator])


class OTPVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(validators=[phone_number_validator])
    code = serializers.CharField(min_length=6, max_length=6)


class RegisterSerializer(serializers.Serializer):
    otp_token = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=User.Role.choices)
    pin = serializers.CharField(min_length=4, max_length=6, write_only=True)

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("PIN must be numeric.")
        return value

    def validate(self, attrs):
        signer = signing.TimestampSigner(salt=OTP_TOKEN_SALT)
        try:
            phone_number = signer.unsign(attrs["otp_token"], max_age=OTP_TOKEN_MAX_AGE)
        except signing.SignatureExpired as exc:
            raise serializers.ValidationError(
                {"otp_token": "Verification expired, please request a new OTP."}
            ) from exc
        except signing.BadSignature as exc:
            raise serializers.ValidationError(
                {"otp_token": "Invalid verification token."}
            ) from exc

        if User.objects.filter(phone_number=phone_number).exists():
            raise serializers.ValidationError(
                {"phone_number": "An account with this phone number already exists."}
            )

        attrs["phone_number"] = phone_number
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            phone_number=validated_data["phone_number"],
            password=validated_data["pin"],
            role=validated_data["role"],
        )
        if user.role == User.Role.WORKER:
            WorkerProfile.objects.create(user=user)
        else:
            CustomerProfile.objects.create(user=user)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    liability_acknowledged = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "phone_number",
            "role",
            "full_name",
            "photo",
            "liability_acknowledged_at",
            "biometric_enabled",
            "liability_acknowledged",
            "date_joined",
        ]
        read_only_fields = ["phone_number", "role", "liability_acknowledged_at", "date_joined"]

    def update(self, instance, validated_data):
        acknowledged = validated_data.pop("liability_acknowledged", False)
        if acknowledged and not instance.liability_acknowledged_at:
            instance.liability_acknowledged_at = timezone.now()
        return super().update(instance, validated_data)


class WorkerProfileSerializer(serializers.ModelSerializer):
    categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ServiceCategory.objects.filter(is_active=True),
        required=False,
    )
    jobs_completed = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()

    class Meta:
        model = WorkerProfile
        fields = [
            "categories",
            "id_document",
            "id_document_back",
            "id_status",
            "id_rejection_reason",
            "is_online",
            "subscription_status",
            "jobs_completed",
            "rating_average",
        ]
        read_only_fields = [
            "id_status",
            "id_rejection_reason",
            "is_online",
            "subscription_status",
            "jobs_completed",
            "rating_average",
        ]

    def get_jobs_completed(self, obj):
        return JobRequest.objects.filter(
            worker=obj.user, status=JobRequest.Status.COMPLETED
        ).count()

    def get_rating_average(self, obj):
        result = Rating.objects.filter(
            job__worker=obj.user, job__status=JobRequest.Status.COMPLETED
        ).aggregate(avg=Avg("stars"))
        return round(result["avg"], 1) if result["avg"] is not None else None

    def update(self, instance, validated_data):
        # A fresh ID submission (either side — front, back, or both) always
        # goes back to Pending review, clearing any earlier rejection — this
        # is the "ID upload mandatory to go online" gate's entry point (see
        # WorkerProfile.IDStatus).
        submitting_new_document = any(
            validated_data.get(field) for field in ("id_document", "id_document_back")
        )
        instance = super().update(instance, validated_data)
        if submitting_new_document:
            instance.id_status = WorkerProfile.IDStatus.PENDING
            instance.id_reviewed_at = None
            instance.id_reviewed_by = None
            instance.id_rejection_reason = ""
            instance.save(
                update_fields=["id_status", "id_reviewed_at", "id_reviewed_by", "id_rejection_reason"]
            )
        return instance


class CustomerProfileSerializer(serializers.ModelSerializer):
    """Read-only: stats surfaced on the customer Profile screen (no writable fields)."""

    requests_completed = serializers.SerializerMethodField()

    class Meta:
        model = CustomerProfile
        fields = ["requests_completed"]

    def get_requests_completed(self, obj):
        return JobRequest.objects.filter(
            customer=obj.user, status=JobRequest.Status.COMPLETED
        ).count()


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ["id", "category", "document", "status", "rejection_reason", "created_at"]
        read_only_fields = ["id", "status", "rejection_reason", "created_at"]


class AddressSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90, write_only=True)
    longitude = serializers.FloatField(min_value=-180, max_value=180, write_only=True)

    class Meta:
        model = Address
        fields = [
            "id",
            "label",
            "address_text",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["latitude"] = instance.location.y if instance.location else None
        data["longitude"] = instance.location.x if instance.location else None
        return data

    def create(self, validated_data):
        lat = validated_data.pop("latitude")
        lng = validated_data.pop("longitude")
        validated_data["location"] = Point(lng, lat, srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        lat = validated_data.pop("latitude", None)
        lng = validated_data.pop("longitude", None)
        if lat is not None and lng is not None:
            validated_data["location"] = Point(lng, lat, srid=4326)
        return super().update(instance, validated_data)
