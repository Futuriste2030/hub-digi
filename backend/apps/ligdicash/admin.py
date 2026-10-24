from django.contrib import admin

from .models import PayinTransaction


@admin.register(PayinTransaction)
class PayinTransactionAdmin(admin.ModelAdmin):
    list_display = ("transaction_id", "invoice", "montant", "statut", "operator_name", "cree_le")
    list_filter = ("statut", "devise")
    search_fields = ("transaction_id", "invoice__numero", "ref_operateur", "request_id")
    readonly_fields = (
        "transaction_id", "invoice", "montant", "devise", "ligdicash_token", "pay_url",
        "operator_name", "customer", "ref_operateur", "request_id", "reponse_brute",
        "callback_recu_le", "cree_le", "maj_le",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
