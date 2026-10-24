"""Régénère les PDF (factures + reçus) et, en option, renvoie le mail de facture.

Les PDF HUB DIGI sont produits à la volée par l'API : ce sont les ENVOIS
(mails, WhatsApp) et les fichiers déjà imprimés qui restent sur l'ancienne
version du document. Cette commande reconstruit tous les PDF dans
`media/factures/` et `media/recus/` et peut renvoyer la facture au client.

Usage :
    python manage.py regenerer_pdfs                  # tous les PDF -> media/
    python manage.py regenerer_pdfs --envoyer        # + renvoi du mail facture
    python manage.py regenerer_pdfs --statut envoyee # filtre sur un statut
    python manage.py regenerer_pdfs --numero FACTURE-...   # une seule facture
"""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.finance.models import Invoice, Receipt
from apps.finance.pdf import pdf_facture, pdf_recu


class Command(BaseCommand):
    help = "Régénère les PDF des factures et des reçus, et renvoie le mail de facture."

    def add_arguments(self, parser):
        parser.add_argument("--envoyer", action="store_true",
                            help="Renvoyer le mail 'facture_disponible' (lien de paiement inclus).")
        parser.add_argument("--statut", default="", help="Limiter aux factures de ce statut.")
        parser.add_argument("--numero", default="", help="Limiter à ce numéro de facture.")
        parser.add_argument("--dossier", default="", help="Dossier de sortie (défaut : MEDIA_ROOT).")

    def handle(self, *args, **options):
        racine = Path(options["dossier"] or settings.MEDIA_ROOT)
        dossier_factures = racine / "factures"
        dossier_recus = racine / "recus"
        dossier_factures.mkdir(parents=True, exist_ok=True)
        dossier_recus.mkdir(parents=True, exist_ok=True)

        qs = Invoice.objects.select_related("client").prefetch_related("lignes", "recus").all()
        if options["numero"]:
            qs = qs.filter(numero=options["numero"])
        if options["statut"]:
            qs = qs.filter(statut=options["statut"])

        total = 0
        for facture in qs:
            numero = (facture.numero or f"facture-{facture.pk}").replace("/", "-")
            chemin = dossier_factures / f"{numero}.pdf"
            # On génère d'abord en mémoire : une erreur ne laisse pas un PDF vide.
            contenu = pdf_facture(facture).read()
            chemin.write_bytes(contenu)
            total += 1
            self.stdout.write(f"Facture {facture.numero} -> {chemin}")
            if options["envoyer"]:
                self._renvoyer(facture)

        for recu in Receipt.objects.select_related("invoice").prefetch_related("invoice__lignes").all():
            numero = (recu.numero or f"recu-{recu.pk}").replace("/", "-")
            chemin = dossier_recus / f"{numero}.pdf"
            chemin.write_bytes(pdf_recu(recu).read())
            self.stdout.write(f"Reçu {recu.numero} -> {chemin}")

        self.stdout.write(self.style.SUCCESS(f"{total} facture(s) régénérée(s) dans {dossier_factures}"))

    def _renvoyer(self, facture):
        """Renvoi du mail de facture (statut inchangé) avec le lien de paiement."""
        from apps.ligdicash.liens import lien_paiement_facture
        from apps.mailing.services import send_templated_mail

        if not facture.client or not facture.client.email:
            self.stdout.write(self.style.WARNING(f"  {facture.numero} : pas d'email client, mail non envoyé"))
            return
        url_espace = f"{settings.FRONTEND_URL}/espace"
        if facture.client.slug and facture.client.code:
            url_espace = f"{url_espace}/{facture.client.slug}/{facture.client.code}"
        send_templated_mail(
            "facture_disponible", facture.client.email,
            {"societe": facture.client.nom_societe, "numero": facture.numero,
             "total": f"{float(facture.total):,.0f}".replace(",", " "),
             "espace_url": url_espace,
             "lien_paiement": lien_paiement_facture(facture.numero)},
            department_slug="finance", client=facture.client,
        )
        self.stdout.write(f"  -> mail renvoyé à {facture.client.email}")
