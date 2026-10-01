"""Seed Phase 1 (suite) : users démo par rôle + projets/tâches/jalons (idempotent)."""

import os
from datetime import date, timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User
from apps.clients.models import Client
from apps.departments.models import Department, Poste
from apps.projects_dev.models import Milestone, Project, Task


def user(email, username, password, role, dept_nom=None):
    dept = Department.objects.filter(nom=dept_nom).first() if dept_nom else None
    poste = Poste.objects.filter(department=dept, niveau="chef").first() if dept else None
    if role.startswith("membre") and dept:
        poste = Poste.objects.filter(department=dept, niveau="membre").first() or poste
    u, created = User.objects.get_or_create(
        email=email,
        defaults={"username": username, "role": role, "department": dept, "poste": poste},
    )
    if created:
        u.set_password(password)
        u.save()
    return u


chef_dev = user("m.kone@digicom.ml", "moussadev", "Dev12345!", "chef_dev", "Développement")
user("s.traore@digicom.ml", "sekoudev", "Dev12345!", "membre_dev", "Développement")
client_orange = Client.objects.get(nom_societe="Orange Mali")
user_client, created = User.objects.get_or_create(
    email="contact@orangemali.ml",
    defaults={"username": "orangeclient", "role": "client", "client": client_orange},
)
if created:
    user_client.set_password("Client123!")
    user_client.save()
print("Users démo OK")

p1, _ = Project.objects.get_or_create(
    client=client_orange, titre="Site vitrine Orange",
    defaults={"type": "site_web", "statut": "en_cours", "deadline": date.today() + timedelta(days=30)},
)
p2, _ = Project.objects.get_or_create(
    client=client_orange, titre="App Djama Pay",
    defaults={"type": "app_mobile", "statut": "a_faire", "deadline": date.today() + timedelta(days=90)},
)
for titre, statut in [("Maquette homepage", "done"), ("Intégration catalogue", "en_cours"), ("Tunnel paiement", "a_faire")]:
    Task.objects.get_or_create(project=p1, titre=titre, defaults={"statut": statut, "assigne": chef_dev})
for titre, statut in [("Cadrage", "valide"), ("Design", "en_cours"), ("Mise en ligne", "a_venir")]:
    Milestone.objects.get_or_create(project=p1, titre=titre, defaults={"statut": statut})
print(f"Projets : {Project.objects.count()}, Tâches : {Task.objects.count()}, Jalons : {Milestone.objects.count()}")
print(f"Progression '{p1.titre}' : {p1.progression}%")
