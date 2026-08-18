from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils import timezone
from django.utils.html import format_html

from .forms import UserChangeForm, UserCreationForm
from .models import Certification, CustomerProfile, PhoneOTP, User, WorkerProfile


def _document_link(file_field):
    if not file_field:
        return "—"
    try:
        url = file_field.url
    except ValueError:
        return "—"
    return format_html('<a href="{}" target="_blank" rel="noopener">View document</a>', url)


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
    list_display = (
        "user",
        "id_status",
        "id_document_preview",
        "id_reviewed_at",
        "id_reviewed_by",
        "is_online",
        "subscription_status",
    )
    list_editable = ("id_status",)
    list_filter = ("id_status", "is_online", "subscription_status")
    search_fields = ("user__phone_number", "user__full_name")
    readonly_fields = ("id_document_preview", "created_at", "updated_at")
    fields = (
        "user",
        "categories",
        "id_document",
        "id_document_preview",
        "id_status",
        "id_reviewed_at",
        "id_reviewed_by",
        "id_rejection_reason",
        "is_online",
        "subscription_status",
        "created_at",
        "updated_at",
    )
    actions = ["approve_id"]

    @admin.display(description="Document")
    def id_document_preview(self, obj):
        return _document_link(obj.id_document)

    @admin.action(description="Approve selected ID documents")
    def approve_id(self, request, queryset):
        pending = queryset.filter(id_status=WorkerProfile.IDStatus.PENDING)
        updated = 0
        for profile in pending:
            profile.id_status = WorkerProfile.IDStatus.APPROVED
            profile.id_reviewed_at = timezone.now()
            profile.id_reviewed_by = request.user
            profile.id_rejection_reason = ""
            profile.save(
                update_fields=[
                    "id_status",
                    "id_reviewed_at",
                    "id_reviewed_by",
                    "id_rejection_reason",
                ]
            )
            updated += 1
        skipped = queryset.count() - updated
        message = f"Approved {updated} ID document(s)."
        if skipped:
            message += f" Skipped {skipped} not in Pending review."
        self.message_user(request, message)

    def save_model(self, request, obj, form, change):
        if "id_status" in form.changed_data and obj.id_status in (
            WorkerProfile.IDStatus.APPROVED,
            WorkerProfile.IDStatus.REJECTED,
        ):
            obj.id_reviewed_at = timezone.now()
            obj.id_reviewed_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at")
    search_fields = ("user__phone_number", "user__full_name")


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = (
        "worker",
        "category",
        "status",
        "document_preview",
        "reviewed_at",
        "reviewed_by",
    )
    list_editable = ("status",)
    list_filter = ("status", "category")
    search_fields = ("worker__user__phone_number", "worker__user__full_name")
    readonly_fields = ("document_preview", "created_at", "updated_at")
    fields = (
        "worker",
        "category",
        "document",
        "document_preview",
        "status",
        "reviewed_at",
        "reviewed_by",
        "rejection_reason",
        "created_at",
        "updated_at",
    )
    actions = ["approve_certification"]

    @admin.display(description="Document")
    def document_preview(self, obj):
        return _document_link(obj.document)

    @admin.action(description="Approve selected certifications")
    def approve_certification(self, request, queryset):
        pending = queryset.filter(status=Certification.Status.PENDING)
        updated = 0
        for certification in pending:
            certification.status = Certification.Status.APPROVED
            certification.reviewed_at = timezone.now()
            certification.reviewed_by = request.user
            certification.rejection_reason = ""
            certification.save(
                update_fields=["status", "reviewed_at", "reviewed_by", "rejection_reason"]
            )
            updated += 1
        skipped = queryset.count() - updated
        message = f"Approved {updated} certification(s)."
        if skipped:
            message += f" Skipped {skipped} not in Pending."
        self.message_user(request, message)

    def save_model(self, request, obj, form, change):
        if "status" in form.changed_data and obj.status in (
            Certification.Status.APPROVED,
            Certification.Status.REJECTED,
        ):
            obj.reviewed_at = timezone.now()
            obj.reviewed_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "code", "created_at", "expires_at", "is_used")
    list_filter = ("is_used",)
    search_fields = ("phone_number",)
    readonly_fields = ("phone_number", "code", "created_at", "expires_at", "is_used")
