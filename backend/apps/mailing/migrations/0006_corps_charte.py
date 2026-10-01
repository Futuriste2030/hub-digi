"""V2 corps des templates : contenus intérieurs + boutons charte (layout appliqué à l'envoi)."""

from django.db import migrations

BOUTON = (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>'
    '<td align="center" bgcolor="#2f7cbe" style="border-radius:4px;">'
    '<a href="{{ url }}" style="display:inline-block;padding:12px 28px;'
    "font-family:Arial,sans-serif;font-size:15px;font-weight:bold;"
    'color:#ffffff;text-decoration:none;">{{ libelle }}</a></td></tr></table>'
)

CORPS = {
    "bienvenue_espace_client": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Votre espace client est ouvert. Identifiant : <strong>{{ username }}</strong> "
        "(mot de passe transmis séparément).</p>"
        + BOUTON.replace("{{ url }}", "{{ espace_url }}").replace("{{ libelle }}", "Ouvrir mon espace")
        + "<p>L'équipe Digi Com & Technologies</p>"
    ),
    "facture_disponible": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Votre facture <strong>{{ numero }}</strong> d'un montant de <strong>{{ total }} F</strong> "
        "est disponible.</p>"
        + BOUTON.replace("{{ url }}", "{{ espace_url }}").replace("{{ libelle }}", "Voir ma facture")
    ),
    "relance_facture": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Sauf erreur, la facture <strong>{{ numero }}</strong> "
        "(solde : <strong>{{ solde }} F</strong>) reste impayée.</p>"
        "<p>Merci de régulariser au plus vite.</p>"
    ),
    "recu_disponible": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Paiement bien reçu pour la facture <strong>{{ facture_numero }}</strong> : "
        "<strong>{{ montant }} F</strong>.</p>"
        "<p>Votre reçu porte le n° <strong>{{ numero }}</strong>.</p>"
    ),
    "reponse_ticket": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Notre équipe a répondu à votre ticket <strong>{{ numero }}</strong> ({{ sujet }}) :</p>"
        '<p style="border-left:4px solid #4fa3dc;padding-left:12px;color:#14233a;">{{ message }}</p>'
    ),
    "validation_visuel": (
        "<p>Bonjour {{ societe }},</p>"
        "<p>Un nouveau visuel de la campagne <strong>{{ campagne }}</strong> attend votre validation "
        "dans votre espace client.</p>"
        + BOUTON.replace("{{ url }}", "{{ espace_url }}").replace("{{ libelle }}", "Valider le visuel")
    ),
    "reset_password": (
        "<p>Bonjour {{ nom }},</p>"
        "<p>Vous avez demandé la réinitialisation de votre mot de passe (lien valable 24 heures) :</p>"
        + BOUTON.replace("{{ url }}", "{{ reset_url }}").replace("{{ libelle }}", "Réinitialiser mon mot de passe")
        + "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce mail.</p>"
    ),
    "conge_rappel_j3": (
        "<p>Bonjour {{ nom }},</p>"
        "<p>Rappel : votre congé validé du <strong>{{ du }}</strong> au <strong>{{ au }}</strong> "
        "commence dans 3 jours.</p>"
    ),
    "reunion_convocation": (
        "<p>Bonjour,</p>"
        "<p>Vous êtes convié(e) à la réunion <strong>{{ titre }}</strong> le <strong>{{ date }}</strong>"
        " à {{ heure }} — {{ lieu }}.</p>"
        "<p>Ordre du jour : {{ ordre_du_jour }}</p>"
    ),
    "reunion_pv_diffusion": (
        "<p>Bonjour,</p>"
        "<p>Le procès-verbal de la réunion <strong>{{ titre }}</strong> est disponible ci-dessous :</p>"
        "<p>{{ pv }}</p>"
    ),
}


def maj_corps(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    for key, body in CORPS.items():
        MailTemplate.objects.filter(key=key).update(body_html=body)


class Migration(migrations.Migration):
    dependencies = [("mailing", "0005_alter_mailtemplate_body_html")]

    operations = [migrations.RunPython(maj_corps, migrations.RunPython.noop)]
