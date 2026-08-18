from django.contrib import admin

from .models import CancellationLog, JobRequest, Message, Rating, Report


@admin.register(JobRequest)
class JobRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "worker", "category", "status", "created_at")
    list_filter = ("status", "category")
    search_fields = ("customer__phone_number", "worker__phone_number")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("job", "sender", "created_at")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("job", "reporter", "category", "status", "created_at")
    list_filter = ("category", "status")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("job", "stars", "created_at")


@admin.register(CancellationLog)
class CancellationLogAdmin(admin.ModelAdmin):
    list_display = ("job", "worker", "reason", "created_at")
