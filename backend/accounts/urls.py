from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    CertificationListCreateView,
    ProfileView,
    RegisterView,
    RequestOTPView,
    VerifyOTPView,
    WorkerProfileView,
)

urlpatterns = [
    path("otp/request/", RequestOTPView.as_view(), name="otp-request"),
    path("otp/verify/", VerifyOTPView.as_view(), name="otp-verify"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="login-refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("worker-profile/", WorkerProfileView.as_view(), name="worker-profile"),
    path("certifications/", CertificationListCreateView.as_view(), name="certifications"),
]
