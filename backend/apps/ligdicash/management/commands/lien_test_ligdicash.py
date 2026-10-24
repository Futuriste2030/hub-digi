"""Lien de paiement de test (validation d'integration LigdiCash).

Cree une facture de test du montant demande et affiche le lien de paiement
PUBLIC (celui du QR de la facture) ainsi que l'URL de la page LigdiCash.

Le lien public est stable et reutilisable : a chaque ouverture, une nouvelle
facture LigdiCash est creee cote API (la page LigdiCash expire ~16 min apres
sa creation), donc le lien fonctionne meme des le lendemain.

Usage :
    python manage.py lien_test_ligdicash --montant 10
    python manage.py lien_test_ligdicash --montant 100
    python manage.py lien_test_ligdicash --montant 100 --client test@macom.ml
"""

import argparse

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction

from apps.accounts.models import User
from apps.clients.models import Client
from apps.finance.models import Invoice, InvoiceLigne
from apps.ligdicash.liens import lien_paiement_facture, paiement_en_ligne_actif


class Command(BaseCommand):
    help = "Cree une facture de test et affiche le lien de paiement correspondant."

    def add_arguments(self, parser):
        parser.add_argument("--montant", type=int, default=10,
                            help="Montant en XOF (Orange Mali impose 100 F minimum).")
        parser.add_argument("--client", default="", help="Email du client (cree si inconnu).")
        parser.add_argument("--titre", default="", help="Titre de la formation / libelle de la facture.")

    def handle(self, *args, **options):
        montant = int(options["montant"])
        if montant <= 0:
            self.stdout.write(self.style.ERROR("Montant invalide."))
            return
        if not paiement_en_ligne_actif():
            self.stdout.write(self.style.ERROR(
                "Paiement en ligne desactive : PAYMENT_ENABLED=1 et LIGDICASH_ENABLED=1 requis."))
            return

        email = options["client"] or "test.ligdicash@digicom.ml"
        titre = options["titre"] or f"Test paiement en ligne {montant} F"

        with db_transaction.atomic():
            client, _ = Client.objects.get_or_create(
                nom_societe=f"Test LigdiCash {montant} F",
                defaults={"email": email, "statut": Client.STATUT_CLIENT},
            )
            User.objects.get_or_create(
                email=email,
                defaults={"username": f"testlg{montant}", "role": "client", "client": client},
            )
            facture = Invoice.objects.create(
                client=client,
                type_doc=Invoice.TYPE_FACTURE,
                statut=Invoice.STATUT_ENVOYEE,
            )
            InvoiceLigne.objects.create(
                invoice=facture, description=titre, quantite=1, montant=montant)

        lien = lien_paiement_facture(facture.numero)
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Facture de test : {facture.numero} — {montant} XOF"))
        self.stdout.write("")
        self.stdout.write("  Lien de paiement (PUBLIC, celui du QR de la facture) :")
        self.stdout.write(f"  {lien}")
        self.stdout.write("")
        self.stdout.write("  URL de notification a communiquer a LigdiCash :")
        self.stdout.write(f"  {settings.LIGDICASH_CALLBACK_URL}")
        self.stdout.write("")
        self.stdout.write("  Rappel : Orange Mali a un minimum de 100 F CFA (10 F sera refuse")
        self.stdout.write("  par l'operateur, pas par l'application).")
        self.stdout.write("")
