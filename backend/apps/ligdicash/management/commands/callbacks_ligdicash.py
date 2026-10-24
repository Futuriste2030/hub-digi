"""Traceabilite des callbacks LigdiCash — affiche le contenu brut des POST recus.

C'est la piece demandee par l'equipe LigdiCash lors de la validation :
« le contenu des requetes effectivement recues (logs, enregistrement en base
de donnees ou tout autre mecanisme de traceabilite) ».

Chaque POST sur le callback est journalise dans CallbackLigdiCash (corps
brut, en-tetes, IP, reponse renvoyee) — y compris les sondes envoyees avant
toute transaction reelle.

Usage :
    python manage.py callbacks_ligdicash                  # les 20 derniers
    python manage.py callbacks_ligdicash --dernier 5     # les 5 derniers
    python manage.py callbacks_ligdicash --transaction PAI-20261020-XXXX
    python manage.py callbacks_ligdicash --format json    # sortie brute a coller
"""

import json

from django.core.management.base import BaseCommand

from apps.ligdicash.models import CallbackLigdiCash


class Command(BaseCommand):
    help = "Affiche les callbacks LigdiCash recus (corps brut + reponse)."

    def add_arguments(self, parser):
        parser.add_argument("--dernier", type=int, default=20, help="Nombre de callbacks a afficher.")
        parser.add_argument("--transaction", default="", help="Filtrer sur un transaction_id.")
        parser.add_argument("--format", choices=["texte", "json"], default="texte",
                            help="json = sortie brute, a coller dans un mail.")

    def handle(self, *args, **options):
        qs = CallbackLigdiCash.objects.all()
        if options["transaction"]:
            qs = qs.filter(transaction_id=options["transaction"])
        qs = qs.order_by("-recu_le")[: options["dernier"]]
        logs = list(qs)

        if options["format"] == "json":
            self.stdout.write(json.dumps([
                {
                    "recu_le": l.recu_le.isoformat(),
                    "source_ip": l.source_ip,
                    "content_type": l.content_type,
                    "entetes": l.entetes,
                    "corps_brut": l.corps_brut,
                    "payload": l.payload,
                    "transaction_id": l.transaction_id,
                    "statut_reponse": l.statut_reponse,
                    "reponse": l.reponse,
                } for l in logs
            ], ensure_ascii=False, indent=2))
            return

        if not logs:
            self.stdout.write(self.style.WARNING("Aucun callback recu pour l'instant."))
            return

        for l in reversed(logs):
            self.stdout.write("=" * 72)
            self.stdout.write(f"Recu le      : {l.recu_le:%Y-%m-%d %H:%M:%S %Z}")
            self.stdout.write(f"IP           : {l.source_ip or '-'}")
            self.stdout.write(f"Content-Type : {l.content_type or '-'}")
            self.stdout.write(f"Transaction  : {l.transaction_id or '(aucune identifiee)'}")
            self.stdout.write(f"Reponse      : HTTP {l.statut_reponse} {l.reponse}")
            if l.entetes:
                self.stdout.write("En-tetes     :")
                for k, v in l.entetes.items():
                    self.stdout.write(f"    {k}: {v}")
            self.stdout.write("Corps recu   :")
            self.stdout.write(l.corps_brut or "(vide)")
            self.stdout.write("")
