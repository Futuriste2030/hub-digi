from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (AttestationPubliqueView, AttestationViewSet, FormationViewSet,
                    InscriptionViewSet, ParticipantViewSet)

router = DefaultRouter()
router.register("formations/catalogue", FormationViewSet, basename="formation")
router.register("formations/inscriptions", InscriptionViewSet, basename="formation-inscription")
router.register("formations/participants", ParticipantViewSet, basename="formation-participant")
router.register("formations/attestations", AttestationViewSet, basename="formation-attestation")

urlpatterns = [
    # Vérification publique (cible du QR de l'attestation). Chemin distinct du
    # router pour éviter toute collision avec /formations/attestations/{id}/.
    path("formations/verification/<str:numero>/", AttestationPubliqueView.as_view(),
         name="formation-attestation-publique"),
] + router.urls
