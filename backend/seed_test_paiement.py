"""Seed de test — super admin + compte client + facture à payer (LigdiCash).

Idempotent : peut être relancé sans dupliquer les comptes.

Usage (depuis backend/) :
    python seed_test_paiement.py
    python seed_test_paiement.py --montant 150000
    python seed_test_paiement.py --password "MonMotDePasse1!"
"""

import argparse
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings

from apps.accounts.models import User
from apps.clients.models import Client
from apps.departments.models import Department, Poste
from apps.finance.models import Invoice, InvoiceLigne
from apps.ligdicash.liens import lien_paiement_facture, paiement_en_ligne_actif

ADMIN_EMAIL = "superadmin@digicom.ml"
ADMIN_USERNAME = "superadmin"
CLIENT_EMAIL = "client.test@digicom.ml"
CLIENT_USERNAME = "clienttest"
SOCIETE = "Client Test SA"
MONTANT_DEFAUT = 150000

parser = argparse.ArgumentParser()
parser.add_argument("--montant", type=int, default=MONTANT_DEFAUT, help="Montant de la facture test (XOF).")
parser.add_argument("--password", default="", help="Mot de passe des deux comptes (defaut : Admin123! / Client123!).")
args = parser.parse_args()

mdp_admin = args.password or "Admin123!"
mdp_client = args.password or "Client123!"

# --------------------------------------------------------------- super admin --
dept, _ = Department.objects.get_or_create(nom="Administration", defaults={"slug": "administration"})
poste, _ = Poste.objects.get_or_create(department=dept, titre="Chef Administration", defaults={"niveau": "chef"})

admin, created = User.objects.get_or_create(
    email=ADMIN_EMAIL,
    defaults={"username": ADMIN_USERNAME, "role": "super_admin", "department": dept, "poste": poste},
)
admin.role = "super_admin"
admin.department = dept
admin.poste = poste
admin.is_staff = True
admin.is_superuser = True
admin.is_active = True
admin.set_password(mdp_admin)
admin.save()
print(f"Super admin  : {ADMIN_EMAIL} / {mdp_admin}" + ("  (cree)" if created else "  (reinitialise)"))

# ------------------------------------------------------------------- client --
client, created = Client.objects.get_or_create(
    nom_societe=SOCIETE,
    defaults={
        "contact": "Awa Diallo",
        "email": CLIENT_EMAIL,
        "phone": "+223 76 00 00 00",
        "adresse": "Bamako, Mali",
        "statut": Client.STATUT_CLIENT,
    },
)
client.statut = Client.STATUT_CLIENT
client.email = CLIENT_EMAIL
client.save()

user_client, created = User.objects.get_or_create(
    email=CLIENT_EMAIL,
    defaults={"username": CLIENT_USERNAME, "role": "client", "client": client},
)
user_client.role = "client"
user_client.client = client
user_client.is_staff = False
user_client.is_superuser = False
user_client.is_active = True
user_client.set_password(mdp_client)
user_client.save()
print(f"Compte client: {CLIENT_EMAIL} / {mdp_client}" + ("  (cree)" if created else "  (reinitialise)"))
print(f"  societe     : {client.nom_societe} (slug {client.slug}, code {client.code})")

# --------------------------------------------------- facture a payer (test) --
facture = (
    Invoice.objects.filter(client=client, numero__contains="TEST-PAIE").order_by("-cree_le").first()
)
if facture is None:
    facture = Invoice.objects.create(
        client=client,
        type_doc=Invoice.TYPE_FACTURE,
        statut=Invoice.STATUT_ENVOYEE,
    )
    InvoiceLigne.objects.create(
        invoice=facture,
        description="Test paiement en ligne - developpement plateforme HUB DIGI",
        quantite=1,
        montant=args.montant,
    )
    print(f"Facture test : {facture.numero} ({args.montant} XOF)")

if facture.solde <= 0:
    print(f"  ATTENTION : facture deja soldee ({facture.solde} XOF) - rien a payer.")

# --------------------------------------------------------------- recapitulatif --
print("")
print("=" * 68)
print(f"  Frontend public : {settings.FRONTEND_URL}")
print(f"  Connexion hub   : {settings.FRONTEND_URL}/login")
print(f"  Espace client   : {settings.FRONTEND_URL}/espace/{client.slug}/{client.code}")
print("")
if paiement_en_ligne_actif():
    lien = lien_paiement_facture(facture.numero)
    print(f"  Lien de paiement (public, sans connexion) :")
    print(f"  {lien}")
else:
    print("  Paiement en ligne DESACTIVE (PAYMENT_ENABLED=1 et LIGDICASH_ENABLED=1 requis).")
print("=" * 68)
