from rest_framework.routers import DefaultRouter

from .views import MilestoneViewSet, ProjectViewSet, TaskViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")
router.register("milestones", MilestoneViewSet, basename="milestone")

urlpatterns = router.urls
