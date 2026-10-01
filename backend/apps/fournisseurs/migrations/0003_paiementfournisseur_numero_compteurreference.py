# References fournisseurs : compteur + numero recu (backfill des existants).

from django.db import migrations, models


def backfill_numeros(apps, schema_editor):
    Paiement = apps.get_model("fournisseurs", "PaiementFournisseur")
    from apps.fournisseurs.references import generer_reference

    for p in Paiement.objects.filter(numero="").select_related("facture__fournisseur"):
        p.numero = generer_reference("RECU-F", p.facture.fournisseur.nom_societe)
        p.save(update_fields=["numero"])


class Migration(migrations.Migration):

    dependencies = [
        ('fournisseurs', '0002_boncommande_facturefournisseur_commande_bonlivraison_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='paiementfournisseur',
            name='numero',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.CreateModel(
            name='CompteurReference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prefixe', models.CharField(max_length=10)),
                ('annee', models.IntegerField()),
                ('dernier', models.IntegerField(default=0)),
            ],
            options={
                'unique_together': {('prefixe', 'annee')},
            },
        ),
        migrations.RunPython(backfill_numeros, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='paiementfournisseur',
            name='numero',
            field=models.CharField(blank=True, max_length=80, unique=True),
        ),
    ]
