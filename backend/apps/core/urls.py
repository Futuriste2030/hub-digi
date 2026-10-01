from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationsView, DashboardPersoView, DashboardSuperAdminView, EnvoyerMessageView, FilDiscussionView,
    GroupesChatView, MarquerGroupeLusView, MarquerLusView, MessagesGroupeView, NotificationViewSet, SeriesView,
    SiteSettingsView,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("dashboard/super-admin/", DashboardSuperAdminView.as_view(), name="dashboard-admin"),
    path("dashboard/perso/", DashboardPersoView.as_view(), name="dashboard-perso"),
    path("dashboard/series/", SeriesView.as_view(), name="dashboard-series"),
    path("settings/entreprise/", SiteSettingsView.as_view(), name="settings-entreprise"),
    path("chat/conversations/", ConversationsView.as_view(), name="chat-conversations"),
    path("chat/messages/", FilDiscussionView.as_view(), name="chat-fil"),
    path("chat/send/", EnvoyerMessageView.as_view(), name="chat-send"),
    path("chat/lus/", MarquerLusView.as_view(), name="chat-lus"),
    path("chat/groupes/", GroupesChatView.as_view(), name="chat-groupes"),
    path("chat/groupes/<int:pk>/", GroupesChatView.as_view(), name="chat-groupe-detail"),
    path("chat/groupes/<int:pk>/messages/", MessagesGroupeView.as_view(), name="chat-groupe-messages"),
    path("chat/groupes/<int:pk>/lus/", MarquerGroupeLusView.as_view(), name="chat-groupe-lus"),
] + router.urls
