# TVA désactivée par défaut sur les factures (pas de TVA au Mali).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_numeros_documents'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='tva_active',
            field=models.BooleanField(default=False, help_text='TVA 18 % applicable (désactivée par défaut : pas de TVA au Mali)'),
        ),
    ]
