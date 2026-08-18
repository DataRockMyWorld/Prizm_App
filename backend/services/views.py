from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import ServiceCategory
from .serializers import ServiceCategorySerializer


class ServiceCategoryListView(generics.ListAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAuthenticated]
    queryset = ServiceCategory.objects.filter(is_active=True)
