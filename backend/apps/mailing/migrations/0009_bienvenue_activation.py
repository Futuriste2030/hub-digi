"""Invitation client sans mot de passe : le template bienvenue envoie un lien
d'activation 24h (le client définit lui-même son mot de passe)."""

from django.db import migrations

BOUTON = (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>'
    '<td align="center" bgcolor="#2f7cbe" style="border-radius:4px;">'
    '<a href="{{ url }}" style="display:inline-block;padding:12px 28px;'
    "font-family:Arial,sans-serif;font-size:15px;font-weight:bold;"
    'color:#ffffff;text-decoration:none;">{{ libelle }}</a></td></tr></table>'
)

CORPS = (
    "<p>Bonjour {{ societe }},</p>"
    "<p>Votre espace client est ouvert. Identifiant : <strong>{{ username }}</strong>.</p>"
    "<p>Définissez votre mot de passe (lien valable 24 heures, usage unique) :</p>"
    + BOUTON.replace("{{ url }}", "{{ activation_url }}").replace("{{ libelle }}", "Définir mon mot de passe")
    + BOUTON.replace("{{ url }}", "{{ espace_url }}").replace("{{ libelle }}", "Ouvrir mon espace")
    + "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce mail.</p>"
    + "<p>L'équipe Digi Com & Technologies</p>"
)


def maj_bienvenue(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    MailTemplate.objects.filter(key="bienvenue_espace_client").update(body_html=CORPS)


class Migration(migrations.Migration):
    dependencies = [("mailing", "0008_templates_recrutement")]

    operations = [migrations.RunPython(maj_bienvenue, migrations.RunPython.noop)]
