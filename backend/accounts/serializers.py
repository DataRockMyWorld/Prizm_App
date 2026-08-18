from django.core import signing
from django.utils import timezone
from rest_framework import serializers

from services.models import ServiceCategory

from .models import Certification, CustomerProfile, User, WorkerProfile, phone_number_validator

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
        ]
        read_only_fields = ["phone_number", "role", "liability_acknowledged_at"]

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

    class Meta:
        model = WorkerProfile
        fields = [
            "categories",
            "id_document",
            "id_status",
            "id_rejection_reason",
            "is_online",
            "subscription_status",
        ]
        read_only_fields = ["id_status", "id_rejection_reason", "is_online", "subscription_status"]

    def update(self, instance, validated_data):
        # A fresh ID submission always goes back to Pending review, clearing
        # any earlier rejection — this is the "ID upload mandatory to go
        # online" gate's entry point (see WorkerProfile.IDStatus).
        submitting_new_document = "id_document" in validated_data and bool(
            validated_data["id_document"]
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


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ["id", "category", "document", "status", "rejection_reason", "created_at"]
        read_only_fields = ["id", "status", "rejection_reason", "created_at"]
