"""Aligne les users backend sur les rôles du frontend (idempotent, mdp seedés à la création)."""

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User
from apps.departments.models import Department, Poste

MDP_DEFAUT = "HubDigi2026!"

COMPTES = [
    ("admin@digicom.ml", "superadmin", "Super", "Admin", "super_admin", None),
    ("a.diarra@digicom.ml", "aicha", "Aïcha", "Diarra", "admin", "Administration"),
    ("m.kone@digicom.ml", "moussadev", "Moussa", "Koné", "chef_dev", "Développement"),
    ("s.traore@digicom.ml", "sekoudev", "Sékou", "Traoré", "membre_dev", "Développement"),
    ("a.diallo@digicom.ml", "awacom", "Awa", "Diallo", "membre_com", "Communication"),
    ("f.diarra@digicom.ml", "fatoumata", "Fatoumata", "Diarra", "chef_finance", "Finance"),
    ("k.sow@digicom.ml", "kadiatou", "Kadidiatou", "Sow", "chef_rh", "RH"),
    ("m.cisse@digicom.ml", "mariam", "Mariam", "Cissé", "chef_juridique", "Juridique"),
]

for email, username, prenom, nom, role, dept_nom in COMPTES:
    dept = Department.objects.filter(nom=dept_nom).first() if dept_nom else None
    niveau = "chef" if role.startswith("chef") else ("membre" if role.startswith("membre") else None)
    poste = Poste.objects.filter(department=dept, niveau=niveau).first() if (dept and niveau) else None
    user, created = User.objects.get_or_create(
        email=email,
        defaults={"username": username, "first_name": prenom, "last_name": nom,
                  "role": role, "department": dept, "poste": poste},
    )
    if created:
        user.set_password(MDP_DEFAUT)
        user.save()
        print(f"créé {email} / {MDP_DEFAUT}")
    else:
        print(f"existant {email} ({user.role}) — mdp inchangé")
