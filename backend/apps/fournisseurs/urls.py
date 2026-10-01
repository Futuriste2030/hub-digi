from rest_framework.routers import DefaultRouter

from .views import (
    BonCommandeViewSet,
    BonLivraisonViewSet,
    FactureFournisseurViewSet,
    FournisseurViewSet,
    PaiementFournisseurViewSet,
)

router = DefaultRouter()
router.register("fournisseurs", FournisseurViewSet, basename="fournisseur")
router.register("fournisseurs-factures", FactureFournisseurViewSet, basename="facture-fournisseur")
router.register("fournisseurs-paiements", PaiementFournisseurViewSet, basename="paiement-fournisseur")
router.register("fournisseurs-commandes", BonCommandeViewSet, basename="bon-commande")
router.register("fournisseurs-livraisons", BonLivraisonViewSet, basename="bon-livraison")

urlpatterns = router.urls
