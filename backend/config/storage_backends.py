from django.conf import settings
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
