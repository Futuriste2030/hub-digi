"""Seed de démonstration — attestations de formation.

Crée une formation avec plusieurs stagiaires (statuts variés) et délivre les
attestations aux participants « terminées ». Sert à contrôler le rendu du PDF
et la page de vérification publique.

Usage (depuis backend/) :
    python seed_attestations_demo.py
    python seed_attestations_demo.py --nombre 8
"""

import argparse
import os
from datetime import date, timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.finance.models import Invoice, InvoiceLigne
from apps.formations.liens import lien_verification_attestation
from apps.formations.models import (AttestationFormation, Formation,
                                     InscriptionFormation, ParticipantFormation)
from apps.formations.services import generer_attestations_formation

PRENOMS = [
    ("Aïcha Traoré Diallo", "aicha.traore@exemple.ml"),
    ("Modibo Keïta", "modibo.keita@exemple.ml"),
    ("Fatoumata Diarra", "fatoumata.diarra@exemple.ml"),
    ("Sekou Diarra", "sekou.diarra@exemple.ml"),
    ("Néné Koné", "nene.kone@exemple.ml"),
    ("Bakary Traoré", "bakary.traore@exemple.ml"),
    ("Adama Coulibaly", "adama.coulibaly@exemple.ml"),
    ("Mariam Camara", "mariam.camara@exemple.ml"),
]

parser = argparse.ArgumentParser()
parser.add_argument("--nombre", type=int, default=6, help="Nombre de stagiaires.")
args = parser.parse_args()

formation, _ = Formation.objects.get_or_create(
    slug="demo-attestation",
    defaults={
        "titre": "Développement Web Full-Stack avec React et Django",
        "prix": 250000,
        "duree": "120 heures (3 mois)",
        "date_debut": date.today() - timedelta(days=30),
        "date_fin": date.today() - timedelta(days=5),
        "lieu": "Digi Com Academy, Bamako",
    },
)

# Les 3 premiers sont « terminés » (éligibles), les suivants ont des statuts variés.
statuts = [
    InscriptionFormation.STATUT_TERMINEE,
    InscriptionFormation.STATUT_TERMINEE,
    InscriptionFormation.STATUT_TERMINEE,
    InscriptionFormation.STATUT_CONFIRMEE,
    InscriptionFormation.STATUT_RECUE,
    InscriptionFormation.STATUT_ANNULEE,
]

for i in range(min(args.nombre, len(PRENOMS))):
    nom, email = PRENOMS[i]
    participant, _ = ParticipantFormation.objects.get_or_create(
        email=email, defaults={"full_name": nom, "phone": f"+223 76 1{i} 22 33 44"})
    inscription, _ = InscriptionFormation.objects.get_or_create(
        formation=formation, participant=participant)
    inscription.statut = statuts[i]
    inscription.save()
    # Facture brouillon, comme le fait le webhook du site vitrine : sans elle,
    # les boutons WhatsApp / Encaisser / PDF restent inactifs.
    if not inscription.factures.exists():
        facture = Invoice.objects.create(
            client=None, inscription=inscription, statut=Invoice.STATUT_BROUILLON)
        InvoiceLigne.objects.create(
            invoice=facture, description=f"Formation : {formation.titre}",
            quantite=1, montant=formation.prix)

recap = generer_attestations_formation(
    formation, mention="Session de démonstration — contrôle du design.")

delivrees = recap["creees"] + recap["existantes"]
print(f"Formation  : {formation.titre}")
print(f"Stagiaires : {formation.inscriptions.count()} "
      f"({formation.inscriptions.filter(statut=InscriptionFormation.STATUT_TERMINEE).count()} terminés)")
print(f"Attestations créées : {len(recap['creees'])} "
      f"(déjà délivrées : {len(recap['existantes'])})")
for attestation in delivrees:
    print(f"  {attestation.numero} — {attestation.inscription.participant.full_name}")
    print(f"    {lien_verification_attestation(attestation.numero)}")
if delivrees:
    print(f"PDF : media/attestations/{delivrees[0].numero}.pdf "
          "(généré par le panneau Formations > Attestations)")
