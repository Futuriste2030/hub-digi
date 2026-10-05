from rest_framework import serializers

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    projets_count = serializers.IntegerField(read_only=True)
    tickets_ouverts = serializers.IntegerField(read_only=True)
    factures_impayees = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = ["id", "nom_societe", "slug", "code", "contact", "email", "phone", "adresse", "statut",
                  "est_interne",
                  "projets_count", "tickets_ouverts", "factures_impayees", "cree_le", "maj_le"]
        read_only_fields = ["id", "cree_le", "maj_le"]
