from rest_framework.routers import DefaultRouter

from .views import CourrierViewSet, DechargeViewSet, ReunionViewSet, TicketViewSet

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("secretariat/courriers", CourrierViewSet, basename="courrier")
router.register("secretariat/reunions", ReunionViewSet, basename="reunion")
router.register("secretariat/decharges", DechargeViewSet, basename="decharge")

urlpatterns = router.urls
