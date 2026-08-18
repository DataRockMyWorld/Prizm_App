from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UserChangeForm, UserCreationForm
from .models import Certification, CustomerProfile, PhoneOTP, User, WorkerProfile


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    form = UserChangeForm
    add_form = UserCreationForm

    list_display = ("phone_number", "full_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("phone_number", "full_name")
    ordering = ("phone_number",)

    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        ("Personal info", {"fields": ("full_name", "photo", "role")}),
        (
            "Onboarding",
            {"fields": ("liability_acknowledged_at", "biometric_enabled")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "role", "password1", "password2"),
            },
        ),
    )


@admin.register(WorkerProfile)
class WorkerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "verified", "is_online", "subscription_status")
    list_filter = ("verified", "is_online", "subscription_status")
    search_fields = ("user__phone_number", "user__full_name")


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at")
    search_fields = ("user__phone_number", "user__full_name")


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ("worker", "category", "status", "created_at")
    list_filter = ("status", "category")


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "code", "created_at", "expires_at", "is_used")
    list_filter = ("is_used",)
    search_fields = ("phone_number",)
    readonly_fields = ("phone_number", "code", "created_at", "expires_at", "is_used")
