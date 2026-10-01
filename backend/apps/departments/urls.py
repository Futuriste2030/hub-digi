from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, PosteViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("postes", PosteViewSet, basename="poste")

urlpatterns = router.urls
