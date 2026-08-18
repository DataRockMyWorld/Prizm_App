from django.contrib import admin

from .models import ServiceCategory


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "estimate_min", "estimate_max", "is_active")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
