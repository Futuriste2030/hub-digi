# SPEC Jira v1.4 §1-2/§4 : migration additive uniquement.
# Nouveaux champs Task (reference, estimation, priorite, done_at, sprint),
# modele Sprint, champs GitHub Project, LienGit + LivraisonWebhook.
# Retro-remplissage : TASK-AAAA-NNNN dans l'ordre de creation + done_at = maj_le.

from django.db import migrations, models
import django.db.models.deletion


def backfill_tasks(apps, schema_editor):
    Task = apps.get_model("projects_dev", "Task")
    CompteurReference = apps.get_model("fournisseurs", "CompteurReference")
    from collections import defaultdict

    compteurs = defaultdict(int)
    for t in Task.objects.order_by("cree_le", "id"):
        annee = (t.cree_le.year if t.cree_le else 2026)
        if not t.reference:
            compteurs[annee] += 1
            seq = compteurs[annee]
            # Reprend le compteur existant si present pour eviter les collisions futures.
            try:
                c = CompteurReference.objects.get(prefixe="TASK", annee=annee)
                seq = max(seq, c.dernier + 1)
                c.dernier = seq
                c.save(update_fields=["dernier"])
            except CompteurReference.DoesNotExist:
                CompteurReference.objects.create(prefixe="TASK", annee=annee, dernier=seq)
            t.reference = f"TASK-{annee}-{seq:04d}"
        if t.statut == "done" and not t.done_at:
            t.done_at = t.maj_le or t.cree_le
        t.save(update_fields=["reference", "done_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("projects_dev", "0001_initial"),
        ("fournisseurs", "0003_paiementfournisseur_numero_compteurreference"),
        ("bugtracker", "0001_initial"),
    ]

    operations = [
        migrations.AddField(model_name="project", name="github_repo",
                            field=models.CharField(blank=True, help_text="owner/nom, déduit de repo_url si possible", max_length=255)),
        migrations.AddField(model_name="project", name="github_webhook_secret",
                            field=models.CharField(blank=True, max_length=128)),
        migrations.AddField(model_name="project", name="github_auto_statut",
                            field=models.BooleanField(default=False)),
        migrations.CreateModel(
            name="Sprint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nom", models.CharField(max_length=255)),
                ("objectif", models.TextField(blank=True)),
                ("date_debut", models.DateField()),
                ("date_fin", models.DateField()),
                ("statut", models.CharField(choices=[("planifie", "Planifié"), ("actif", "Actif"), ("termine", "Terminé")], default="planifie", max_length=20)),
                ("points_engages", models.IntegerField(default=0)),
                ("points_termines", models.IntegerField(default=0)),
                ("demarre_le", models.DateTimeField(blank=True, null=True)),
                ("termine_le", models.DateTimeField(blank=True, null=True)),
                ("cree_le", models.DateTimeField(auto_now_add=True)),
                ("maj_le", models.DateTimeField(auto_now=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sprints", to="projects_dev.project")),
            ],
            options={"ordering": ["-cree_le"]},
        ),
        migrations.AddField(model_name="task", name="reference",
                            field=models.CharField(blank=True, max_length=20, unique=True)),
        migrations.AddField(model_name="task", name="estimation_points",
                            field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="task", name="estimation_heures",
                            field=models.DecimalField(blank=True, decimal_places=1, max_digits=6, null=True)),
        migrations.AddField(model_name="task", name="priorite",
                            field=models.CharField(choices=[("basse", "Basse"), ("normale", "Normale"), ("haute", "Haute"), ("critique", "Critique")], default="normale", max_length=20)),
        migrations.AddField(model_name="task", name="done_at",
                            field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="task", name="sprint",
                            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="taches", to="projects_dev.sprint")),
        migrations.AddField(model_name="task", name="sprint_added_at",
                            field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="LienGit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("commit", "Commit"), ("pull_request", "Pull request"), ("branche", "Branche")], max_length=20)),
                ("identifiant_externe", models.CharField(max_length=255)),
                ("url", models.URLField(blank=True)),
                ("titre", models.CharField(blank=True, max_length=255)),
                ("auteur_github", models.CharField(blank=True, max_length=255)),
                ("statut_pr", models.CharField(blank=True, choices=[("ouverte", "Ouverte"), ("fusionnee", "Fusionnée"), ("fermee", "Fermée")], max_length=20, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("bug", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="liens_git", to="bugtracker.bugreport")),
                ("task", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="liens_git", to="projects_dev.task")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(model_name="liengit", constraint=models.CheckConstraint(
            check=models.Q(("task__isnull", False), ("bug__isnull", True)) | models.Q(("task__isnull", True), ("bug__isnull", False)),
            name="liengit_task_ou_bug")),
        migrations.AddConstraint(model_name="liengit", constraint=models.UniqueConstraint(
            fields=("task", "type", "identifiant_externe"), name="uniq_lien_task")),
        migrations.AddConstraint(model_name="liengit", constraint=models.UniqueConstraint(
            fields=("bug", "type", "identifiant_externe"), name="uniq_lien_bug")),
        migrations.CreateModel(
            name="LivraisonWebhook",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("delivery_id", models.CharField(max_length=128, unique=True)),
                ("event", models.CharField(max_length=50)),
                ("statut_traitement", models.CharField(default="ok", max_length=20)),
                ("erreur", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="livraisons_webhook", to="projects_dev.project")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(backfill_tasks, migrations.RunPython.noop),
    ]
