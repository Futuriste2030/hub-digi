from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LienGitViewSet, MilestoneViewSet, ProjectViewSet, SprintViewSet, TaskViewSet, webhook_github

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")
router.register("milestones", MilestoneViewSet, basename="milestone")
router.register("sprints", SprintViewSet, basename="sprint")
router.register("liens-git", LienGitViewSet, basename="liengit")

sprint_list = SprintViewSet.as_view({"get": "list", "post": "create"})
sprint_detail = SprintViewSet.as_view({"get": "retrieve", "patch": "partial_update",
                                       "put": "update", "delete": "destroy"})

urlpatterns = [
    # Webhook GitHub entrant V1 (public + throttle, secret par projet).
    path("github/webhook/<int:project_id>/", webhook_github, name="github-webhook"),
    # Alias SPEC §2-3 : /api/v1/dev/sprints/... (canonique : /api/v1/sprints/...).
    path("dev/sprints/", sprint_list, name="dev-sprint-list"),
    path("dev/sprints/<int:pk>/", sprint_detail, name="dev-sprint-detail"),
] + router.urls
