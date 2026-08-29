"""Shared upload validators — no field in the app (ID documents,
certifications, profile/job photos) had any server-side size limit before
this, so any authenticated user could upload an arbitrarily large file."""

from django.core.exceptions import ValidationError

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def validate_file_size(file):
    if file.size > MAX_UPLOAD_SIZE_BYTES:
        max_mb = MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        actual_mb = file.size / (1024 * 1024)
        raise ValidationError(f"File too large ({actual_mb:.1f}MB) — max {max_mb}MB.")
