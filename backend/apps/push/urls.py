from django.urls import path

from .views import PushSubscribeView, PushTestView, VapidPublicKeyView

urlpatterns = [
    path("push/vapid-key/", VapidPublicKeyView.as_view(), name="push-vapid-key"),
    path("push/subscribe/", PushSubscribeView.as_view(), name="push-subscribe"),
    path("push/test/", PushTestView.as_view(), name="push-test"),
]
