from rest_framework import serializers

from .models import Department, Poste


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "nom", "slug"]


class PosteSerializer(serializers.ModelSerializer):
    department_nom = serializers.CharField(source="department.nom", read_only=True)

    class Meta:
        model = Poste
        fields = ["id", "department", "department_nom", "titre", "niveau"]
