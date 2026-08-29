"""Startup guards against booting a real deployment on dev-only scaffold
defaults (Django's SECRET_KEY placeholder, MinIO's well-known admin
credentials). Kept as a plain function, separate from settings.py, so it's
unit-testable without needing to reload the whole settings module."""

from django.core.exceptions import ImproperlyConfigured

INSECURE_DEFAULTS = {
    "SECRET_KEY": "django-insecure-dev-only-change-me",
    "AWS_ACCESS_KEY_ID": "minioadmin",
    "AWS_SECRET_ACCESS_KEY": "minioadmin",
}


def find_insecure_defaults(values: dict) -> list[str]:
    """Given a dict of {setting_name: current_value}, return the names whose
    value still matches its known-insecure dev default."""
    return [name for name, default in INSECURE_DEFAULTS.items() if values.get(name) == default]


def check_no_insecure_defaults(*, debug: bool, values: dict) -> None:
    """Raise ImproperlyConfigured if `debug` is False and any of `values`
    still equals its insecure dev default. No-op under DEBUG=True, since
    that's exactly where these defaults are meant to be used."""
    if debug:
        return
    still_insecure = find_insecure_defaults(values)
    if still_insecure:
        raise ImproperlyConfigured(
            "Refusing to start with DEBUG=False while these still use their "
            f"insecure local-dev default values: {', '.join(still_insecure)}. "
            "Set real values via environment variables before deploying."
        )
