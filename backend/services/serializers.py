from rest_framework import serializers

from .models import ServiceCategory


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "estimate_min", "estimate_max"]
