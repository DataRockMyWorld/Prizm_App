from rest_framework.throttling import SimpleRateThrottle


class PhoneScopedThrottle(SimpleRateThrottle):
    """Rate-limits by the phone number in the request body, falling back to IP."""

    def get_cache_key(self, request, view):
        phone_number = request.data.get("phone_number", "")
        ident = phone_number or self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class OTPRequestThrottle(PhoneScopedThrottle):
    scope = "otp_request"


class OTPVerifyThrottle(PhoneScopedThrottle):
    scope = "otp_verify"
