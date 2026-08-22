from decimal import Decimal

from django.db.models import Avg
from rest_framework import serializers

from accounts.models import User, WorkerProfile
from services.models import ServiceCategory

from .models import CancellationLog, JobOffer, JobRequest, Rating, Report


class CategoryMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug"]


class WorkerPublicSerializer(serializers.ModelSerializer):
    verified = serializers.BooleanField(source="worker_profile.verified", read_only=True)
    rating_average = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "full_name", "photo", "verified", "rating_average"]

    def get_rating_average(self, obj):
        result = Rating.objects.filter(job__worker=obj).aggregate(avg=Avg("stars"))
        return round(result["avg"], 1) if result["avg"] is not None else None


class JobRequestSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    worker = WorkerPublicSerializer(read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    current_offer_responds_by = serializers.SerializerMethodField()

    class Meta:
        model = JobRequest
        fields = [
            "id",
            "category",
            "description",
            "address",
            "latitude",
            "longitude",
            "photo",
            "status",
            "price_range_min",
            "price_range_max",
            "agreed_price",
            "worker_note",
            "worker",
            "current_offer_responds_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None

    def get_current_offer_responds_by(self, obj):
        offer = obj.offers.filter(status=JobOffer.Status.PENDING).first()
        return offer.responds_by if offer else None


class JobRequestCreateSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.filter(is_active=True)
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(required=False, allow_blank=True, default="")
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    photo = serializers.ImageField(required=False, allow_null=True)


class NearbyJobSerializer(serializers.ModelSerializer):
    category = CategoryMiniSerializer(read_only=True)
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = JobRequest
        fields = [
            "id",
            "category",
            "description",
            "price_range_min",
            "price_range_max",
            "distance_km",
            "created_at",
        ]

    def get_distance_km(self, obj):
        distance = getattr(obj, "distance", None)
        return round(distance.km, 1) if distance is not None else None


class JobOfferSerializer(serializers.ModelSerializer):
    job = JobRequestSerializer(read_only=True)

    class Meta:
        model = JobOffer
        fields = ["id", "job", "offered_at", "responds_by"]


class CompleteJobSerializer(serializers.Serializer):
    agreed_price = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0")
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")


class WorkerCancelSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=CancellationLog.Reason.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ReportCreateSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Report.Category.choices)
    details = serializers.CharField(required=False, allow_blank=True, default="")


class RatingCreateSerializer(serializers.Serializer):
    stars = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class WorkerStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerProfile
        fields = ["is_online", "id_status", "subscription_status", "last_location_updated_at"]


class WorkerStatusUpdateSerializer(serializers.Serializer):
    is_online = serializers.BooleanField(required=False)
    latitude = serializers.FloatField(required=False, min_value=-90, max_value=90)
    longitude = serializers.FloatField(required=False, min_value=-180, max_value=180)

    def validate(self, attrs):
        if ("latitude" in attrs) != ("longitude" in attrs):
            raise serializers.ValidationError(
                "Both latitude and longitude are required together."
            )
        return attrs
