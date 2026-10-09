# Facturation persistée (devise/taux/conditions/pied) + tous les champs
# texte vidables depuis /parametres (09/10/2026).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_sitesettings_cachet_secretariat'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='devise',
            field=models.CharField(blank=True, default='F CFA', max_length=20),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='taux_tva',
            field=models.IntegerField(default=0, help_text='TVA société en % (0 par défaut : pas de TVA au Mali).'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='conditions',
            field=models.TextField(blank=True, default='Paiement à 30 jours date de facture. Passé ce délai, pénalités de 1,5 % par mois de retard.'),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='pied',
            field=models.TextField(blank=True, default='Digi Com & Technologies — NIF 081234567A — RCCM ML-BKO-2021-B-1234 — Merci de votre confiance.'),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='raison',
            field=models.CharField(blank=True, default='Digi Com & Technologies', max_length=255),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='nif',
            field=models.CharField(blank=True, default='081234567A', max_length=50),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='rccm',
            field=models.CharField(blank=True, default='ML-BKO-2021-B-1234', max_length=50),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='adresse',
            field=models.CharField(blank=True, default='Sotuba ACI-2000, Bamako', max_length=255),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='phone',
            field=models.CharField(blank=True, default='(+223) 70 16 33 86', max_length=50),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='email',
            field=models.EmailField(blank=True, default='contact@digicom.ml', max_length=254),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='delai_paiement',
            field=models.CharField(blank=True, default='30 jours', max_length=50),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='signataire',
            field=models.CharField(blank=True, default='La Direction Financière', max_length=100),
        ),
    ]
