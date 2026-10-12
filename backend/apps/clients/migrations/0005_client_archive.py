# Statut Archivé : masque le client des listes sans effacer son historique.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0004_client_est_interne'),
    ]

    operations = [
        migrations.AlterField(
            model_name='client',
            name='statut',
            field=models.CharField(choices=[('prospect', 'Prospect'), ('client', 'Client'), ('archive', 'Archivé')], default='prospect', max_length=10),
        ),
    ]
