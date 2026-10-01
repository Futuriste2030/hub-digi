"""Templates par cas d'usage — SPEC §8 + reset password + bienvenue + rappels."""

from django.db import migrations

TEMPLATES = [
    ("bienvenue_espace_client", "Bienvenue espace client",
     "Bienvenue sur votre espace client Digi Com & Technologies",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Votre espace client est ouvert : <a href=\"{{ espace_url }}\">{{ espace_url }}</a></p>"
     "<p>Identifiant : <strong>{{ username }}</strong> (mot de passe transmis séparément).</p>"
     "<p>L'équipe Digi Com & Technologies</p>"),
    ("facture_disponible", "Facture disponible",
     "Votre facture {{ numero }} est disponible",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Votre facture <strong>{{ numero }}</strong> d'un montant de <strong>{{ total }} F</strong> est disponible.</p>"
     "<p>Consultez-la dans votre espace : <a href=\"{{ espace_url }}\">{{ espace_url }}</a></p>"),
    ("relance_facture", "Relance facture impayée",
     "Relance : facture {{ numero }} impayée",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Sauf erreur, la facture <strong>{{ numero }}</strong> (solde : <strong>{{ solde }} F</strong>) reste impayée.</p>"
     "<p>Merci de régulariser au plus vite.</p>"),
    ("recu_disponible", "Reçu de paiement",
     "Votre reçu {{ numero }}",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Paiement bien reçu pour la facture <strong>{{ facture_numero }}</strong> : "
     "<strong>{{ montant }} F</strong>. Votre reçu porte le n° <strong>{{ numero }}</strong>.</p>"),
    ("reponse_ticket", "Réponse ticket",
     "Réponse à votre ticket {{ numero }}",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Notre équipe a répondu à votre ticket <strong>{{ numero }}</strong> ({{ sujet }}) :</p>"
     "<p>{{ message }}</p>"),
    ("validation_visuel", "Visuel à valider",
     "Un visuel attend votre validation",
     "<p>Bonjour {{ societe }},</p>"
     "<p>Un nouveau visuel de la campagne <strong>{{ campagne }}</strong> attend votre validation "
     "dans votre espace client.</p>"),
    ("reset_password", "Réinitialisation mot de passe",
     "Réinitialisation de votre mot de passe HUB DIGI",
     "<p>Bonjour {{ nom }},</p>"
     "<p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez ci-dessous "
     "(lien valable 24 heures) :</p>"
     "<p><a href=\"{{ reset_url }}\">{{ reset_url }}</a></p>"
     "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce mail.</p>"),
    ("conge_rappel_j3", "Rappel congé J-3",
     "Rappel : votre congé commence dans 3 jours",
     "<p>Bonjour {{ nom }},</p>"
     "<p>Rappel : votre congé validé du <strong>{{ du }}</strong> au <strong>{{ au }}</strong> "
     "commence dans 3 jours.</p>"),
    ("reunion_convocation", "Convocation réunion",
     "Convocation : {{ titre }} le {{ date }}",
     "<p>Bonjour,</p>"
     "<p>Vous êtes convié(e) à la réunion <strong>{{ titre }}</strong> le <strong>{{ date }}</strong>"
     " à {{ heure }} — {{ lieu }}.</p>"
     "<p>Ordre du jour : {{ ordre_du_jour }}</p>"),
    ("reunion_pv_diffusion", "Procès-verbal de réunion",
     "PV : {{ titre }}",
     "<p>Bonjour,</p>"
     "<p>Le procès-verbal de la réunion <strong>{{ titre }}</strong> est disponible ci-dessous :</p>"
     "<p>{{ pv }}</p>"),
]


def creer_templates(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    for key, nom, subject, body in TEMPLATES:
        MailTemplate.objects.update_or_create(key=key, defaults={"nom": nom, "subject": subject, "body_html": body})


class Migration(migrations.Migration):
    dependencies = [("mailing", "0003_mailtemplate")]

    operations = [migrations.RunPython(creer_templates, migrations.RunPython.noop)]
