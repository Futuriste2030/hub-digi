"""Seed Phase 1 : départements + postes + super admin + client démo (idempotent)."""

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User
from apps.clients.models import Client
from apps.departments.models import Department, Poste

DEPTS = ["Administration", "Communication", "Développement", "Finance", "RH", "Juridique"]
for nom in DEPTS:
    dept, _ = Department.objects.get_or_create(nom=nom, defaults={"slug": nom.lower().replace("é", "e")})
    Poste.objects.get_or_create(department=dept, titre=f"Chef {nom}", defaults={"niveau": "chef"})
    Poste.objects.get_or_create(department=dept, titre=f"Membre {nom}", defaults={"niveau": "membre"})
print(f"Départements : {Department.objects.count()}, Postes : {Poste.objects.count()}")

if not User.objects.filter(email="admin@digicom.ml").exists():
    User.objects.create_superuser(
        email="admin@digicom.ml", username="superadmin", password="Admin123!", role="super_admin"
    )
    print("Superuser admin@digicom.ml / Admin123! créé")
else:
    print("Superuser déjà présent")

client, _ = Client.objects.get_or_create(
    nom_societe="Orange Mali",
    defaults={"contact": "Awa Diallo", "email": "contact@orangemali.ml", "statut": "client"},
)
print(f"Client démo : {client}")
