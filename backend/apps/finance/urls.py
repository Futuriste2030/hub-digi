from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DevisViewSet, ExpenseViewSet, FichePaieViewSet, InvoiceViewSet, PayWebhookView, ReceiptViewSet

router = DefaultRouter()
router.register("finance/quotes", DevisViewSet, basename="devis")
router.register("finance/invoices", InvoiceViewSet, basename="invoice")
router.register("finance/receipts", ReceiptViewSet, basename="receipt")
router.register("finance/expenses", ExpenseViewSet, basename="expense")
router.register("finance/paie", FichePaieViewSet, basename="fichepaie")

urlpatterns = [
    path("finance/paiements/webhook/", PayWebhookView.as_view(), name="paiement-webhook"),
] + router.urls
