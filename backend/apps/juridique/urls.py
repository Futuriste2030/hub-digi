from rest_framework.routers import DefaultRouter

from .views import ContractViewSet, DisputeViewSet

router = DefaultRouter()
router.register("juridique/contracts", ContractViewSet, basename="contract")
router.register("juridique/disputes", DisputeViewSet, basename="dispute")

urlpatterns = router.urls
