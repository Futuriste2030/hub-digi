# Nouveau format de numérotation PREFIXE-SLUGCLIENT-JJ-MM-AAAA-ID + numero sur Devis.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0003_fichepaie_lignepaie'),
    ]

    operations = [
        migrations.AddField(
            model_name='devis',
            name='numero',
            field=models.CharField(blank=True, max_length=80, unique=True),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='numero',
            field=models.CharField(blank=True, max_length=80, unique=True),
        ),
        migrations.AlterField(
            model_name='receipt',
            name='numero',
            field=models.CharField(blank=True, max_length=80, unique=True),
        ),
    ]
