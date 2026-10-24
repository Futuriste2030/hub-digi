"""Vérifie que les pages de paiement LigdiCash sont bien joignables.

LigdiCash peut exposer une facture via /confirm (statut « pending ») tout en
servant une page 404 au client : le payer_url est alors inutilisable. Cette
commande ouvre réellement chaque URL stockée et affiche ce qui est rendu.

Usage :
    python manage.py verif_paiement              # contrôle les URL en base
    python manage.py verif_paiement --creer      # + crée une facture test (100 XOF)
"""

import re
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand

from apps.finance.models import Invoice
from apps.ligdicash import services
from apps.ligdicash.models import PayinTransaction

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


def texte(html):
    txt = re.sub(r"<script[\s\S]*?</script>", " ", html)
    txt = re.sub(r"<style[\s\S]*?</style>", " ", txt)
    txt = re.sub(r"<[^>]+>", " ", txt)
    return re.sub(r"\s+", " ", txt).strip()


def controler(url):
    """(etat, extrait) — l'état vaut 'OK', '404' ou 'ERREUR'."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as rep:
            txt = texte(rep.read().decode("utf-8", "replace"))
            if "incorrecte" in txt or "not found" in txt:
                return "404", txt[:120]
            return "OK", txt[:120]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}", ""
    except Exception as e:
        return "ERREUR", str(e)[:120]


class Command(BaseCommand):
    help = "Vérifie que les pages de paiement LigdiCash stockées répondent."

    def add_arguments(self, parser):
        parser.add_argument("--creer", action="store_true",
                            help="Créer en plus une facture LigdiCash de test (aucun paiement).")

    def handle(self, *args, **options):
        for t in PayinTransaction.objects.select_related("invoice").all().order_by("cree_le"):
            if not t.pay_url:
                continue
            etat, extrait = controler(t.pay_url)
            couleur = {"OK": self.style.SUCCESS}.get(etat, self.style.ERROR)
            numero = t.invoice.numero if t.invoice_id else "-"
            self.stdout.write(f"{t.transaction_id} | {t.statut} | {couleur(etat)} | {numero}")
            self.stdout.write(f"    {extrait}")

        if options["creer"]:
            invoice = next((i for i in Invoice.objects.all() if i.solde > 0), None)
            if invoice is None:
                self.stdout.write(self.style.WARNING("Aucune facture avec un solde > 0."))
                return
            token, pay_url = services.creer_facture(invoice, "PAI-VERIF-MANUEL", invoice.solde)
            etat, extrait = controler(pay_url)
            self.stdout.write("")
            self.stdout.write(f"Facture de test {invoice.numero} ({invoice.solde} XOF)")
            self.stdout.write(f"  pay_url : {pay_url}")
            self.stdout.write(f"  page    : {etat}")
            self.stdout.write(f"  {extrait}")
