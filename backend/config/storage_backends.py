import uuid

from django.conf import settings
from django.utils.deconstruct import deconstructible
from storages.backends.s3 import S3Storage


class PubliclyAccessibleS3Storage(S3Storage):
    """S3Storage that signs against the Docker-internal MinIO endpoint (needed
    for the backend to actually read/write objects) but returns URLs rewritten
    to a client-reachable endpoint, since callers (the mobile apps, a browser)
    can't resolve Docker service hostnames like `minio`.
    """

    def url(self, name, parameters=None, expire=None, http_method=None):
        url = super().url(name, parameters=parameters, expire=expire, http_method=http_method)
        internal = settings.AWS_S3_ENDPOINT_URL
        public = getattr(settings, "AWS_S3_PUBLIC_ENDPOINT_URL", None)
        if public and internal and url.startswith(internal):
            url = public + url[len(internal):]
        return url


@deconstructible
class unique_upload_path:
    """FileField upload_to that gives every upload a random name instead of
    the client-supplied one. Every mobile upload call
    (packages/api/src/*.ts) sends a fixed generic filename (e.g.
    "photo.jpg") regardless of which user or job it belongs to, and our S3
    storage overwrites same-named objects by default — so without this,
    every user's profile photo (and every job photo, ID document, etc.)
    silently overwrote every other one at the same object key. A plain
    closure isn't migration-serializable, hence the @deconstructible class
    instead of a factory function. """

    def __init__(self, prefix):
        self.prefix = prefix

    def __call__(self, instance, filename):
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        return f"{self.prefix}/{uuid.uuid4().hex}.{ext}"
