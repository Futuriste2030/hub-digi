# Retrait du type Fournisseur (deux cas : client ou employé).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('juridique', '0003_contrat_employe_partie'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contract',
            name='type',
            field=models.CharField(choices=[('client', 'Client'), ('employe', 'Employé')], default='client', max_length=20),
        ),
    ]
