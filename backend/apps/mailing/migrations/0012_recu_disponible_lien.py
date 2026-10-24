"""Ajoute le lien de vérification du reçu au template recu_disponible."""

from django.db import migrations


NOUVEAU_CORPS = (
    "<p>Bonjour {{ societe }},</p>"
    "<p>Paiement bien reçu pour la facture <strong>{{ facture_numero }}</strong> : "
    "<strong>{{ montant }} F</strong>. Votre reçu porte le n° <strong>{{ numero }}</strong>.</p>"
    "<p>Consultez et vérifiez votre reçu ici : "
    "<a href=\"{{ lien_recu }}\">{{ lien_recu }}</a></p>"
)


def maj_template(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    MailTemplate.objects.filter(key="recu_disponible").update(body_html=NOUVEAU_CORPS)


class Migration(migrations.Migration):
    dependencies = [("mailing", "0011_sentmail_piece_jointe_sentmail_piece_jointe_nom_and_more")]
    operations = [migrations.RunPython(maj_template, migrations.RunPython.noop)]