from django.urls import path

from .views import (
    LigdiCashCallbackView,
    LigdiCashFacturePubliqueView,
    LigdiCashInitierLienView,
    LigdiCashInitierView,
    LigdiCashRecuPubliqueView,
    LigdiCashRetourView,
    LigdiCashStatutView,
)

urlpatterns = [
    path("finance/paiements/ligdicash/initier/", LigdiCashInitierView.as_view(), name="ligdicash-initier"),
    path("finance/paiements/ligdicash/initier-lien/", LigdiCashInitierLienView.as_view(), name="ligdicash-initier-lien"),
    path("finance/paiements/ligdicash/callback/", LigdiCashCallbackView.as_view(), name="ligdicash-callback"),
    path("finance/paiements/ligdicash/retour/<str:transaction_id>/", LigdiCashRetourView.as_view(), name="ligdicash-retour"),
    path("finance/paiements/ligdicash/facture/<str:numero>/", LigdiCashFacturePubliqueView.as_view(), name="ligdicash-facture-publique"),
    path("finance/paiements/ligdicash/recu/<str:numero>/", LigdiCashRecuPubliqueView.as_view(), name="ligdicash-recu-publique"),
    path("finance/paiements/ligdicash/<str:transaction_id>/statut/", LigdiCashStatutView.as_view(), name="ligdicash-statut"),
]
