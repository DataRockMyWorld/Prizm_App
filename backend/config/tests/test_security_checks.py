import pytest
from django.core.exceptions import ImproperlyConfigured

from config.security_checks import check_no_insecure_defaults, find_insecure_defaults

INSECURE_VALUES = {
    "SECRET_KEY": "django-insecure-dev-only-change-me",
    "AWS_ACCESS_KEY_ID": "minioadmin",
    "AWS_SECRET_ACCESS_KEY": "minioadmin",
}

REAL_VALUES = {
    "SECRET_KEY": "a-real-randomly-generated-secret",
    "AWS_ACCESS_KEY_ID": "AKIAREALLOOKINGKEY",
    "AWS_SECRET_ACCESS_KEY": "a-real-rotated-secret",
}


def test_find_insecure_defaults_flags_every_matching_value():
    assert find_insecure_defaults(INSECURE_VALUES) == [
        "SECRET_KEY",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
    ]


def test_find_insecure_defaults_ignores_real_values():
    assert find_insecure_defaults(REAL_VALUES) == []


def test_find_insecure_defaults_flags_only_the_ones_still_insecure():
    mixed = {**REAL_VALUES, "SECRET_KEY": INSECURE_VALUES["SECRET_KEY"]}
    assert find_insecure_defaults(mixed) == ["SECRET_KEY"]


def test_check_raises_when_debug_is_false_and_a_default_is_insecure():
    with pytest.raises(ImproperlyConfigured, match="SECRET_KEY"):
        check_no_insecure_defaults(debug=False, values=INSECURE_VALUES)


def test_check_is_a_noop_under_debug_true_even_with_insecure_defaults():
    check_no_insecure_defaults(debug=True, values=INSECURE_VALUES)  # must not raise


def test_check_is_a_noop_when_debug_is_false_but_values_are_real():
    check_no_insecure_defaults(debug=False, values=REAL_VALUES)  # must not raise
