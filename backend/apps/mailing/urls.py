from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MailSendView, MailTemplateViewSet, SentMailViewSet

router = DefaultRouter()
router.register("mailing/sent", SentMailViewSet, basename="sentmail")
router.register("mailing/templates", MailTemplateViewSet, basename="mailtemplate")

urlpatterns = [path("mailing/send/", MailSendView.as_view(), name="mail-send")] + router.urls
