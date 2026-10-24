"""Backfill des références techniques des paiements LigdiCash déjà en base.

`/confirm` est la source de vérité : on relit chaque transaction et on
ré-enregistre operator_name, customer, oreference, request_id et la réponse
brute. Utile après une évolution du modèle ou pour rattraper une transaction
dont le callback n'a pas été traité.

Usage : python manage.py backfill_paiements
"""

from django.core.management.base import BaseCommand

from apps.ligdicash import services
from apps.ligdicash.models import PayinTransaction


class Command(BaseCommand):
    help = "Relit /confirm et complete les references des transactions LigdiCash."

    def add_arguments(self, parser):
        parser.add_argument("--statut", default="", help="Limiter a un statut (pending, completed...).")
        parser.add_argument("--seulement-vides", action="store_true",
                            help="Ne traiter que les transactions sans request_id.")

    def handle(self, *args, **options):
        qs = PayinTransaction.objects.all()
        if options["statut"]:
            qs = qs.filter(statut=options["statut"])
        if options["seulement_vides"]:
            qs = qs.filter(request_id="")

        for t in qs.order_by("cree_le"):
            if not t.ligdicash_token:
                self.stdout.write(f"{t.transaction_id} : pas de token de creation, ignore.")
                continue
            try:
                detail = services.confirmer(t.ligdicash_token)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"{t.transaction_id} : /confirm impossible ({e})."))
                continue
            if detail.get("response_code") != "00":
                self.stdout.write(self.style.WARNING(
                    f"{t.transaction_id} : /confirm refuse ({detail.get('response_text')})."))
                continue
            services.appliquer_statut(t, detail.get("status") or t.statut, detail)
            t.refresh_from_db()
            self.stdout.write(
                f"{t.transaction_id} | {t.statut} | operateur={t.operator_name or '-'} "
                f"| payeur={t.customer or '-'} | oreference={t.ref_operateur or '-'} "
                f"| request_id={t.request_id or '-'}")
