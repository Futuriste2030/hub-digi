from rest_framework.routers import DefaultRouter

from .views import DevisViewSet, ExpenseViewSet, FichePaieViewSet, InvoiceViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("finance/quotes", DevisViewSet, basename="devis")
router.register("finance/invoices", InvoiceViewSet, basename="invoice")
router.register("finance/receipts", ReceiptViewSet, basename="receipt")
router.register("finance/expenses", ExpenseViewSet, basename="expense")
router.register("finance/paie", FichePaieViewSet, basename="fichepaie")

urlpatterns = router.urls
