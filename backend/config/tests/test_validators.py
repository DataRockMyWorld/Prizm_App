import pytest
from django.core.exceptions import ValidationError

from config.validators import MAX_UPLOAD_SIZE_BYTES, validate_file_size


class _FakeFile:
    def __init__(self, size):
        self.size = size


def test_accepts_a_file_within_the_limit():
    validate_file_size(_FakeFile(MAX_UPLOAD_SIZE_BYTES - 1))  # must not raise


def test_accepts_a_file_exactly_at_the_limit():
    validate_file_size(_FakeFile(MAX_UPLOAD_SIZE_BYTES))  # must not raise


def test_rejects_a_file_over_the_limit():
    with pytest.raises(ValidationError):
        validate_file_size(_FakeFile(MAX_UPLOAD_SIZE_BYTES + 1))
