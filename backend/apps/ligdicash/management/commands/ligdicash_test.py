"""Test d'intégration LigdiCash — appelle la VRAIE API, sans jamais payer.

Deux modes :

  - `--facture <NUMERO>`  : parcours complet sur une facture réelle de la base
    (crée une PayinTransaction, stocke le token, renvoie le pay_url).
  - sans argument        : facture fictive de 100 XOF, rien n'est écrit en base.

Dans les deux cas : création de facture + relecture de statut via /confirm.
Aucun paiement n'est déclenché : aucun argent n'est déplacé, aucun opérateur
n'est débité. La facture créée reste « pending » dans le dashboard LigdiCash.

Usage :
    python manage.py ligdicash_test
    python manage.py ligdicash_test --facture FACTURE-ORANGE-MALI-16-09-2026-12
"""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.ligdicash import services
from apps.ligdicash.models import PayinTransaction
from apps.ligdicash.signing import signer_transaction


class _LigneFictive:
    def __init__(self, description, quantite, montant):
        self.description = description
        self.quantite = quantite
        self.montant = montant


class _LignesFictives(list):
    def all(self):
        return self


class _FactureFictive:
    """Facture jetable : permet de valider les clés sans toucher à la base."""

    numero = "TEST-LIGDICASH"
    solde = 100
    total = 100
    destinataire_nom = "Test LigdiCash"
    destinataire_email = ""
    client = None
    lignes = _LignesFictives([_LigneFictive("Test d'intégration LigdiCash", 1, 100)])


class Command(BaseCommand):
    help = "Test d'intégration LigdiCash : crée une facture (sans paiement) et relit son statut."

    def add_arguments(self, parser):
        parser.add_argument("--facture", default="", help="Numéro de facture réelle à utiliser.")
        parser.add_argument("--montant", type=int, default=100, help="Montant XOF de la facture fictive.")

    def handle(self, *args, **options):
        if not settings.LIGDICASH_API_KEY or not settings.LIGDICASH_API_TOKEN:
            raise CommandError(
                "Clés absentes : renseigner LIGDICASH_API_KEY et LIGDICASH_API_TOKEN dans backend/.env.")

        numero = (options.get("facture") or "").strip()
        if numero:
            from apps.finance.models import Invoice

            facture = Invoice.objects.filter(numero=numero).first()
            if facture is None:
                raise CommandError(f"Facture introuvable : {numero}")
            self.stdout.write(f"Facture réelle : {facture.numero} — solde {facture.solde} XOF")
        else:
            facture = _FactureFictive()
            facture.solde = options["montant"]
            facture.total = options["montant"]
            facture.lignes = _LignesFictives([_LigneFictive("Test d'intégration LigdiCash", 1, facture.solde)])
            self.stdout.write(f"Facture fictive : {facture.numero} — {facture.solde} XOF")

        transaction_id = f"PAI-TEST-{PayinTransaction.objects.count() + 1:04d}"
        payload = services.construire_payload_facture(facture, transaction_id, facture.solde)

        self.stdout.write("\n--- Requête envoyée ---")
        self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))

        try:
            token, pay_url = services.creer_facture(facture, transaction_id, facture.solde)
        except services.LigdiCashError as e:
            raise CommandError(f"Création refusée : {e.message} (code {e.code}) {e.detail}")

        self.stdout.write(self.style.SUCCESS("\n--- Facture créée ---"))
        self.stdout.write(f"token      : {token}")
        self.stdout.write(f"pay_url    : {pay_url}")
        self.stdout.write(f"à ouvrir  : {pay_url}")
        self.stdout.write("NE PAYEZ PAS cette facture si c'est un test : elle restera 'pending'.")

        try:
            data = services.confirmer(token)
        except services.LigdiCashError as e:
            raise CommandError(f"/confirm injoignable : {e.message} (code {e.code})")

        self.stdout.write(self.style.SUCCESS("\n--- Statut (/confirm) ---"))
        self.stdout.write(json.dumps(data, ensure_ascii=False, indent=2)[:2000])

        if numero:
            transaction = PayinTransaction.objects.create(
                invoice=facture, montant=services.montant_xof(facture.solde),
                statut=PayinTransaction.STATUT_PENDING,
                ligdicash_token=token, pay_url=pay_url)
            self.stdout.write(self.style.SUCCESS(
                f"\nTransaction enregistrée : {transaction.transaction_id} "
                f"(retour : /paiement/retour?txn={transaction.transaction_id}"
                f"&sig={signer_transaction(transaction.transaction_id)})"))
