from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PasskeyCredential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("credential_id", models.CharField(max_length=255, unique=True)),
                ("cle_publique", models.TextField()),
                ("compteur_signature", models.IntegerField(default=0)),
                ("nom", models.CharField(default="Mon appareil", max_length=100)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
                ("dernier_usage", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="passkeys", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-dernier_usage", "-cree_le"]},
        ),
        migrations.CreateModel(
            name="PasskeyChallenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.CharField(blank=True, max_length=255)),
                ("challenge", models.CharField(max_length=255, unique=True)),
                ("usage", models.CharField(choices=[("reg", "Enregistrement"), ("auth", "Authentification")], max_length=10)),
                ("utilise", models.BooleanField(default=False)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="passkey_challenges", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
