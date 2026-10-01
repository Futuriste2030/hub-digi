from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    HubTokenObtainPairView, OtpConfirmView, OtpDisableView, OtpSetupView, OtpStatusView, OtpVerifyView,
    PasswordChangeView, PasswordResetConfirmView, PasswordResetRequestView, UserMiniView, UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", HubTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/otp/setup/", OtpSetupView.as_view(), name="otp-setup"),
    path("auth/otp/confirm/", OtpConfirmView.as_view(), name="otp-confirm"),
    path("auth/otp/verify/", OtpVerifyView.as_view(), name="otp-verify"),
    path("auth/otp/disable/", OtpDisableView.as_view(), name="otp-disable"),
    path("auth/otp/status/", OtpStatusView.as_view(), name="otp-status"),
    path("auth/password/reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("users/mini/", UserMiniView.as_view(), name="user-mini"),
    path("", include(router.urls)),
]
