"""Chronomètre : dans combien de temps la page de paiement LigdiCash expire-t-elle ?

Crée une facture LigdiCash (aucun paiement), puis teste la page toutes les
60 s et journalise les changements d'état. Sert à dimensionner la fenêtre de
reprise (FENETRE_REPRISE côté HUB DIGI) et à surveiller une évolution du
comportement LigdiCash.

Usage : python manage.py chrono_page [minutes]
"""

import re
import time
import urllib.request
from datetime import datetime

from django.core.management.base import BaseCommand

from apps.finance.models import Invoice
from apps.ligdicash import services

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


def etat(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as rep:
            html = rep.read().decode("utf-8", "replace")
        txt = re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html)).lower()
        return "404" if ("incorrecte" in txt or "not found" in txt) else "OK"
    except Exception as e:
        return f"ERREUR {e}"


class Command(BaseCommand):
    help = "Mesure la durée de vie de la page de paiement LigdiCash."

    def add_arguments(self, parser):
        parser.add_argument("--minutes", type=int, default=30, help="Durée du suivi (minutes).")

    def handle(self, *args, **options):
        minutes = options["minutes"]
        invoice = next((i for i in Invoice.objects.all() if i.solde > 0), Invoice.objects.first())
        if invoice is None:
            self.stdout.write(self.style.ERROR("Aucune facture."))
            return
        token, pay_url = services.creer_facture(invoice, "PAI-CHRONO-1", invoice.solde)
        self.stdout.write(f"pay_url : {pay_url}")
        self.stdout.write(f"invoice : {invoice.numero} — {invoice.solde} XOF")

        t0 = time.time()
        precedent = None
        for i in range(minutes + 1):
            e = etat(pay_url)
            if e != precedent:
                self.stdout.write(f"[{datetime.now():%H:%M:%S}] +{int(time.time() - t0) // 60} min -> {e}")
                precedent = e
            if i < minutes:
                time.sleep(60)
