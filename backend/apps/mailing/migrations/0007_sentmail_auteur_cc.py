# Filtrage par user (auteur) + copie CC.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("mailing", "0006_corps_charte"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sentmail",
            name="auteur",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="mails_envoyes", to="accounts.user",
                help_text="Expéditeur connecté (filtrage par user ; super_admin voit tout). NULL = envoi système."),
        ),
        migrations.AddField(
            model_name="sentmail",
            name="cc",
            field=models.TextField(blank=True, help_text="Copie : e-mails pro séparés par des virgules."),
        ),
    ]
