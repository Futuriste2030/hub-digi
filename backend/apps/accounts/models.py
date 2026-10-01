"""User custom — SPEC §3/§11 : role + department FK + poste FK + client FK (si role=client)."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLES = [
        ("super_admin", "Super Admin"),
        ("admin", "Administration"),
        ("chef_com", "Chef Communication"),
        ("membre_com", "Membre Communication"),
        ("chef_dev", "Chef Développement"),
        ("membre_dev", "Membre Développement"),
        ("chef_finance", "Chef Finance"),
        ("membre_finance", "Membre Finance"),
        ("chef_rh", "Chef RH"),
        ("membre_rh", "Membre RH"),
        ("chef_juridique", "Chef Juridique"),
        ("membre_juridique", "Membre Juridique"),
        ("client", "Client"),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLES, default="membre_dev")
    department = models.ForeignKey(
        "departments.Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    poste = models.ForeignKey(
        "departments.Poste", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    client = models.ForeignKey(
        "clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return f"{self.email} ({self.role})"
