"""Site de pointage par défaut (Bamako placeholder) si aucun site actif.

À ajuster impérativement avec les vraies coordonnées dans /admin/ :
au-delà de 150 m, les scans sont rejetés (anti-fraude GPS).
"""

from django.db import migrations


def creer_site_defaut(apps, schema_editor):
    SitePointage = apps.get_model("rh", "SitePointage")
    if SitePointage.objects.filter(actif=True).exists():
        return
    SitePointage.objects.create(
        nom="Siège Digi Com",
        latitude="12.639200",
        longitude="-8.002900",
        rayon_m=150,
        heure_arrivee="08:00:00",
        heure_depart="17:00:00",
        tolerance_retard_min=15,
        prime_montant=25000,
        actif=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("rh", "0003_sitepointage_prime_montant_prime"),
    ]

    operations = [
        migrations.RunPython(creer_site_defaut, migrations.RunPython.noop),
    ]
