"""Templates recrutement — chaque changement de statut notifie le candidat."""

from django.db import migrations

TEMPLATES = [
    ("candidature_entretien", "Convocation entretien",
     "Entretien : votre candidature chez Digi Com & Technologies",
     "<p>Bonjour {{ nom }},</p>"
     "<p>Après examen de votre dossier, nous avons le plaisir de vous convoquer à un entretien "
     "pour le poste de <strong>{{ poste }}</strong>.</p>"
     "<p>{{ message }}</p>"
     "<p>Merci de confirmer votre présence en répondant à ce mail.</p>"
     "<p>L'équipe RH — Digi Com & Technologies</p>"),
    ("candidature_retenue", "Candidature retenue",
     "Bonne nouvelle : votre candidature est retenue",
     "<p>Bonjour {{ nom }},</p>"
     "<p>À l'issue du processus, votre candidature au poste de <strong>{{ poste }}</strong> "
     "est <strong>retenue</strong>.</p>"
     "<p>{{ message }}</p>"
     "<p>Notre équipe RH vous contactera très vite pour la suite.</p>"
     "<p>L'équipe RH — Digi Com & Technologies</p>"),
    ("candidature_rejetee", "Réponse à votre candidature",
     "Suite de votre candidature chez Digi Com & Technologies",
     "<p>Bonjour {{ nom }},</p>"
     "<p>Nous avons bien étudié votre candidature au poste de <strong>{{ poste }}</strong> "
     "et nous ne pourrons pas y donner suite.</p>"
     "<p>{{ message }}</p>"
     "<p>Nous conservons votre dossier et vous souhaitons pleine réussite.</p>"
     "<p>L'équipe RH — Digi Com & Technologies</p>"),
]


def creer_templates(apps, schema_editor):
    MailTemplate = apps.get_model("mailing", "MailTemplate")
    for key, nom, subject, body in TEMPLATES:
        MailTemplate.objects.update_or_create(key=key, defaults={"nom": nom, "subject": subject, "body_html": body})


class Migration(migrations.Migration):
    dependencies = [("mailing", "0007_sentmail_auteur_cc")]

    operations = [migrations.RunPython(creer_templates, migrations.RunPython.noop)]
