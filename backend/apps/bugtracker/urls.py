from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BugReportViewSet, TrackerKeyViewSet, report_bug

router = DefaultRouter()
router.register("bugs", BugReportViewSet, basename="bug")
router.register("tracker-keys", TrackerKeyViewSet, basename="trackerkey")

urlpatterns = [path("bugs/report/", report_bug, name="bug-report")] + router.urls
