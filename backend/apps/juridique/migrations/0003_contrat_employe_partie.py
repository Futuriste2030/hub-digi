# Contrat lié client OU employé + partie libre sur litige.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('juridique', '0002_contract_contenu'),
        ('rh', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='contract',
            name='employe',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contrats', to='rh.employee'),
        ),
        migrations.AddField(
            model_name='dispute',
            name='partie',
            field=models.CharField(blank=True, help_text='Personne ou entreprise concernée (saisie libre)', max_length=255),
        ),
    ]
