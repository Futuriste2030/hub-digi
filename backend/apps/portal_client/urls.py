from django.urls import path

from .views import DashboardClientView

urlpatterns = [
    path("portal/dashboard/", DashboardClientView.as_view(), name="portal-dashboard"),
]
