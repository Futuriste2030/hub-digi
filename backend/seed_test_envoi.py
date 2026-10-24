"""Seed de test — envoi réel d'une facture (client fictif + fournitures).

Crée un client fictif, son compte utilisateur, et une facture de fournitures
d'équipements digital à 50 000 FCFA, prête à être envoyée par mail.

Usage (depuis backend/) :
    python seed_test_envoi.py
    python seed_test_envoi.py --email destinataire@exemple.ml
    python seed_test_envoi.py --envoyer     # + déclenchement de l'envoi réel
"""

import argparse
import os
import re

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.conf import settings

from apps.accounts.models import User
from apps.clients.models import Client
from apps.finance.models import Invoice, InvoiceLigne
from apps.ligdicash.liens import lien_paiement_facture, paiement_en_ligne_actif

SOCIETE = "Bureau d'Etudes BAT-INFO SARL"
CONTACT = "Awa Diallo"
EMAIL_PAR_DEFAUT = "abdoulaye208.mac@gmail.com"
PASSWORD = "Client123!"

# 4 lignes de fournitures d'équipements digital -> 50 000 FCFA
LIGNES = [
    ("Ordinateur portable 15,6\" Core i5 / 16 Go RAM / 512 Go SSD", 37000),
    ("Souris sans fil ergonomique", 4000),
    ("Cle USB 64 Go", 3000),
    ("Casque audio avec reduction de bruit", 6000),
]

parser = argparse.ArgumentParser()
parser.add_argument("--email", default=EMAIL_PAR_DEFAUT, help="Email du client fictif (destinataire de l'envoi).")
parser.add_argument("--envoyer", action="store_true", help="Declencher l'envoi du mail de facture.")
args = parser.parse_args()

total = sum(montant for _, montant in LIGNES)

# ----------------------------------------------------------------- client ---
client, created = Client.objects.get_or_create(
    nom_societe=SOCIETE,
    defaults={
        "contact": CONTACT,
        "email": args.email,
        "phone": "+223 76 12 34 56",
        "adresse": "Cocody, Abidjan - Cote d'Ivoire",
        "statut": Client.STATUT_CLIENT,
    },
)
client.email = args.email
client.statut = Client.STATUT_CLIENT
client.save()
print(f"Client   : {client.nom_societe} ({client.slug} / code {client.code})")
print(f"  contact: {client.contact} <{client.email}>")

user, created = User.objects.get_or_create(
    email=args.email,
    defaults={"username": "batinfo", "role": "client", "client": client},
)
user.role = "client"
user.client = client
user.is_active = True
user.set_password(PASSWORD)
user.save()
print(f"  compte: {user.email} / {PASSWORD}")

# ---------------------------------------------------------------- facture ---
# On réutilise la dernière facture du client (le numero est genere par le
# modele : il ne contient pas de mot-cle, le filtre doit porter sur le client).
facture = (
    Invoice.objects.filter(client=client, type_doc=Invoice.TYPE_FACTURE)
    .exclude(statut=Invoice.STATUT_PAYEE)
    .order_by("-cree_le")
    .first()
)
if facture is None:
    facture = Invoice.objects.create(
        client=client,
        type_doc=Invoice.TYPE_FACTURE,
        statut=Invoice.STATUT_ENVOYEE,
    )
    print(f"Facture  : {facture.numero} — {total} XOF")
else:
    print(f"Facture  : {facture.numero} (reutilisee)")

facture.lignes.all().delete()
for description, montant in LIGNES:
    InvoiceLigne.objects.create(
        invoice=facture, description=description, quantite=1, montant=montant)
facture.statut = Invoice.STATUT_ENVOYEE
facture.save()

print("  lignes :")
for ligne in facture.lignes.all():
    print(f"    - {ligne.description} : {ligne.montant:,.0f} F".replace(",", " "))
print(f"  total  : {facture.total:,.0f} F".replace(",", " "), "| solde", facture.solde)

# ------------------------------------------------------------------ envoi ---
if args.envoyer:
    from apps.mailing.services import send_templated_mail

    mdp = (settings.EMAIL_HOST_PASSWORD or "")
    if mdp and re.search(r"(?i)change-me|mot-de-passe|changeme|placeholder", mdp):
        print("")
        print("  !! Mot de passe SMTP non defini (backend/.env -> EMAIL_HOST_PASSWORD).")
        print("     Renseigne-le puis relance : python seed_test_envoi.py --envoyer")
        print("     L'envoi partira alors reellement (le serveur digicom.ml est joignable).")
        print("")

    mail = send_templated_mail(
        "facture_disponible", client.email,
        {"societe": client.nom_societe, "numero": facture.numero,
         "total": f"{float(facture.total):,.0f}".replace(",", " "),
         "espace_url": f"{settings.FRONTEND_URL}/espace/{client.slug}/{client.code}",
         "lien_paiement": lien_paiement_facture(facture.numero)},
        department_slug="finance", client=client,
    )
    if mail is None:
        print("ENVOI   : aucun mail cree (template absent/inactif ou destinataire vide).")
    else:
        print(f"ENVOI   : id={mail.pk} | destinataire={mail.to} | statut={mail.statut}")
        if mail.erreur:
            print(f"  ERREUR : {mail.erreur[:300]}")

print("")
print("=" * 70)
print(f"  Frontend : {settings.FRONTEND_URL}")
if paiement_en_ligne_actif():
    print(f"  Lien de paiement :")
    print(f"  {lien_paiement_facture(facture.numero)}")
print("=" * 70)
