from django.urls import path

from .views import (
    PasskeyListView,
    PasskeyLoginBeginView,
    PasskeyLoginCompleteView,
    PasskeyRegisterBeginView,
    PasskeyRegisterCompleteView,
)

urlpatterns = [
    path("auth/webauthn/register/begin/", PasskeyRegisterBeginView.as_view(), name="webauthn-register-begin"),
    path("auth/webauthn/register/complete/", PasskeyRegisterCompleteView.as_view(), name="webauthn-register-complete"),
    path("auth/webauthn/login/begin/", PasskeyLoginBeginView.as_view(), name="webauthn-login-begin"),
    path("auth/webauthn/login/complete/", PasskeyLoginCompleteView.as_view(), name="webauthn-login-complete"),
    path("auth/webauthn/credentials/", PasskeyListView.as_view(), name="webauthn-list"),
    path("auth/webauthn/credentials/<int:pk>/", PasskeyListView.as_view(), name="webauthn-delete"),
]
