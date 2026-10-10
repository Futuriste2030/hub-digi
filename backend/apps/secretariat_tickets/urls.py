from rest_framework.routers import DefaultRouter

from .views import CourrierViewSet, DechargeViewSet, DocumentSecretariatViewSet, ReunionViewSet, TicketViewSet

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("secretariat/courriers", CourrierViewSet, basename="courrier")
router.register("secretariat/documents", DocumentSecretariatViewSet, basename="document-secretariat")
router.register("secretariat/reunions", ReunionViewSet, basename="reunion")
router.register("secretariat/decharges", DechargeViewSet, basename="decharge")

urlpatterns = router.urls
