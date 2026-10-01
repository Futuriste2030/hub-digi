"""Seed Phases 2-3 : identités mail, employé, contrat, campagne, tracker, ticket, réunion (idempotent)."""

import os
from datetime import date, timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User
from apps.clients.models import Client
from apps.com.models import Campaign
from apps.departments.models import Department
from apps.juridique.models import Contract
from apps.mailing.models import EmailIdentity
from apps.projects_dev.models import Project
from apps.rh.models import Employee
from apps.secretariat_tickets.models import Reunion, Ticket

ADRESSES = {
    "Administration": "admin@digicom.ml", "Communication": "com@digicom.ml",
    "Développement": "dev@digicom.ml", "Finance": "finance@digicom.ml",
    "RH": "rh@digicom.ml", "Juridique": "juridique@digicom.ml",
}
for nom, addr in ADRESSES.items():
    dept = Department.objects.get(nom=nom)
    EmailIdentity.objects.get_or_create(department=dept, defaults={"from_address": addr})
print(f"Identités mail : {EmailIdentity.objects.count()}")

membre = User.objects.get(email="s.traore@digicom.ml")
emp, _ = Employee.objects.get_or_create(user=membre, defaults={"fonction": "Dev Back", "solde_conges": 30})
print(f"Employé : {emp} (solde {emp.solde_conges}j)")

client = Client.objects.get(nom_societe="Orange Mali")
Contract.objects.get_or_create(titre="Contrat-cadre Orange", defaults={"type": "client", "client": client,
                                                                        "date_fin": date.today() + timedelta(days=200)})
Campaign.objects.get_or_create(client=client, titre="Lancement fibre", defaults={"canal": "Facebook", "budget": 500000})
p1 = Project.objects.get(titre="Site vitrine Orange")
Ticket.objects.get_or_create(numero="seed", defaults={"client": client, "project": p1, "sujet": "seed",
                                                      "message": "seed", "priorite": "basse"})
Ticket.objects.filter(numero="seed").delete()  # évite de polluer la numérotation TICK-
Reunion.objects.get_or_create(titre="Point hebdo", date=date.today(),
                              defaults={"lieu": "Bamako", "ordre_du_jour": "Avancement projets"})
print("Seed phases 2-3 OK")
