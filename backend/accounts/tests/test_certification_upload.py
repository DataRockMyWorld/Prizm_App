import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from accounts.models import Certification
from accounts.tests.factories import WorkerProfileFactory
from services.tests.factories import ServiceCategoryFactory


def _fake_image(name="cert.jpg"):
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1), color="white").save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


@pytest.mark.django_db
def test_submitting_a_real_image_creates_a_pending_certification(api_client):
    profile = WorkerProfileFactory()
    category = ServiceCategoryFactory()
    api_client.force_authenticate(user=profile.user)

    response = api_client.post(
        "/api/auth/certifications/",
        {"category": category.id, "document": _fake_image()},
        format="multipart",
    )

    assert response.status_code == 201
    cert = Certification.objects.get(pk=response.data["id"])
    assert cert.worker == profile
    assert cert.status == Certification.Status.PENDING


@pytest.mark.django_db
def test_submitting_a_non_image_file_is_rejected(api_client):
    profile = WorkerProfileFactory()
    category = ServiceCategoryFactory()
    api_client.force_authenticate(user=profile.user)
    not_an_image = SimpleUploadedFile(
        "cert.jpg", b"<html>not an image</html>", content_type="image/jpeg"
    )

    response = api_client.post(
        "/api/auth/certifications/",
        {"category": category.id, "document": not_an_image},
        format="multipart",
    )

    assert response.status_code == 400
    assert Certification.objects.count() == 0
