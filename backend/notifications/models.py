from django.conf import settings
from django.db import models


class PushToken(models.Model):
    """An Expo push token for one installed app on one device.

    Unique on `token` rather than `(user, platform)` — a token identifies a
    specific device+app install, so upserting by token (not creating a new
    row per registration call) is what makes re-registering on every app
    foreground idempotent, and what makes a device that logs into a
    different account correctly hand the token over to the new user.
    """

    class Platform(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} — {self.platform} ({self.token[:16]}…)"
