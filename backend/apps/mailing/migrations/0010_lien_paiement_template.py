"""V3 templates : bouton « Payer ma facture » (lien unique signé par facture).

Le lien de paiement est celui de la facture (identique à celui figé dans le QR
imprimé). Le bloc est conditionnel : si le lien n'est pas fourni (paiement en
ligne désactivé), rien ne s'affiche — pas de bouton mort.
"""

from django.db import migrations

BOUTON = (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>'
    '<td align="center" bgcolor="#2f7cbe" style="border-radius:4px;">'
    '<a href="{{ url }}" style="display:inline-block;padding:12px 28px;'
    "font-family:Arial,sans-serif;font-size:15px;font-weight:bold;"
    'color:#ffffff;text-decoration:none;">{{ libelle }}</a></td></tr></table>'
)

BLOUC_PAIEMENT = (
    "{% if lien_paiement %}"
    "<p>Réglez-la en ligne par Mobile Money (Orange, MTN, Moov…) :</p>"
    + BOUTON.replace("{{ url }}", "{{ lien_paiement }}").replace("{{ libelle }}", "Payer ma facture")
    + "{% endif %}"
)

CORPS = {
    "facture_disponible": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Votre facture <strong>{{ numero }}</strong> d'un montant de <strong>{{ total }} F</strong> "
        "est disponible.</p>"
        + BOUTON.replace("{{ url }}", "{{ espace_url }}").replace("{{ libelle }}", "Voir ma facture")
        + BLOUC_PAIEMENT
    ),
    "relance_facture": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Sauf erreur, la facture <strong>{{ numero }}</strong> "
        "(solde : <strong>{{ solde }} F</strong>) reste impayée.</p>"
        + BLOUC_PAIEMENT
        + "<p>Merci de régulariser au plus vite.</p>"
    ),
}


def maj_corps(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    for key, body in CORPS.items():
        MailTemplate.objects.filter(key=key).update(body_html=body)


class Migration(migrations.Migration):
    dependencies = [("mailing", "0009_bienvenue_activation")]

    operations = [migrations.RunPython(maj_corps, migrations.RunPython.noop)]
