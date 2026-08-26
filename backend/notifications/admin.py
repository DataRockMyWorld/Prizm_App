from django.contrib import admin

from .models import PushToken


@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "token", "updated_at")
    list_filter = ("platform",)
    search_fields = ("user__phone_number", "token")
