from rest_framework.routers import DefaultRouter

from .views import FormationViewSet, InscriptionViewSet, ParticipantViewSet

router = DefaultRouter()
router.register("formations/catalogue", FormationViewSet, basename="formation")
router.register("formations/inscriptions", InscriptionViewSet, basename="formation-inscription")
router.register("formations/participants", ParticipantViewSet, basename="formation-participant")

urlpatterns = router.urls
