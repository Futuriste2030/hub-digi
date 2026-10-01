"""Fournisseurs API — achats : CRUD + cycle commande→livraison→facture→paiement + PDF."""

from django.http import FileResponse
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    BonCommande,
    BonLivraison,
    FactureFournisseur,
    Fournisseur,
    LigneBonCommande,
    LigneBonLivraison,
    LigneFactureFournisseur,
    PaiementFournisseur,
)
from .pdf import (
    pdf_bon_commande,
    pdf_bon_livraison,
    pdf_facture_fournisseur,
    pdf_paiement_fournisseur,
)


class FournisseurSerializer(serializers.ModelSerializer):
    total_achats = serializers.ReadOnlyField()
    total_paye = serializers.ReadOnlyField()
    solde_du = serializers.ReadOnlyField()
    factures_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Fournisseur
        fields = ["id", "nom_societe", "categorie", "contact", "email", "phone",
                  "adresse", "conditions_paiement", "statut",
                  "total_achats", "total_paye", "solde_du", "factures_count",
                  "cree_le", "maj_le"]


class LigneSerializer(serializers.Serializer):
    description = serializers.CharField()
    quantite = serializers.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = serializers.DecimalField(max_digits=12, decimal_places=2)


class FactureFournisseurSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()
    paye = serializers.ReadOnlyField()
    solde = serializers.ReadOnlyField()
    lignes = LigneSerializer(many=True, required=False)
    fournisseur_nom = serializers.CharField(source="fournisseur.nom_societe", read_only=True)
    commande_numero = serializers.CharField(source="commande.numero", read_only=True)

    class Meta:
        model = FactureFournisseur
        fields = ["id", "fournisseur", "fournisseur_nom", "commande", "commande_numero",
                  "numero", "reference_fournisseur",
                  "objet", "statut", "echeance", "fichier",
                  "total", "paye", "solde", "lignes", "cree_le"]
        read_only_fields = ["numero"]

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        facture = FactureFournisseur(**validated_data)
        facture.save()  # génère ACHAT-SLUG-JJ-MM-AAAA-ID
        for l in lignes:
            LigneFactureFournisseur.objects.create(facture=facture, **l)
        return facture


class PaiementFournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaiementFournisseur
        fields = ["id", "facture", "numero", "montant", "moyen", "ref_transaction", "date", "cree_le"]
        read_only_fields = ["numero"]


class BonCommandeSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()
    total_livre = serializers.ReadOnlyField()
    lignes = LigneSerializer(many=True, required=False)
    fournisseur_nom = serializers.CharField(source="fournisseur.nom_societe", read_only=True)

    class Meta:
        model = BonCommande
        fields = ["id", "fournisseur", "fournisseur_nom", "numero", "objet",
                  "statut", "livraison_prevue", "total", "total_livre",
                  "lignes", "cree_le"]
        read_only_fields = ["numero"]

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        commande = BonCommande(**validated_data)
        commande.save()  # génère BDC-SLUG-JJ-MM-AAAA-ID
        for l in lignes:
            LigneBonCommande.objects.create(commande=commande, **l)
        return commande

    def to_representation(self, instance):
        # Lecture enrichie : id + quantités livrées (liaison bons de livraison).
        data = super().to_representation(instance)
        data["lignes"] = [
            {"id": l.id, "description": l.description,
             "quantite": f"{l.quantite}", "quantite_livree": f"{l.quantite_livree}",
             "montant": f"{l.montant}"}
            for l in instance.lignes.all()
        ]
        return data


class LigneLivraisonSerializer(serializers.Serializer):
    description = serializers.CharField()
    quantite = serializers.DecimalField(max_digits=10, decimal_places=2, default=1)
    montant = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    ligne_commande = serializers.PrimaryKeyRelatedField(
        queryset=LigneBonCommande.objects.all(), required=False, allow_null=True)


class BonLivraisonSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()
    lignes = LigneLivraisonSerializer(many=True, required=False)
    fournisseur_nom = serializers.CharField(source="fournisseur.nom_societe", read_only=True)
    commande_numero = serializers.CharField(source="commande.numero", read_only=True)

    class Meta:
        model = BonLivraison
        fields = ["id", "fournisseur", "fournisseur_nom", "commande", "commande_numero",
                  "numero", "statut", "date_livraison", "total", "lignes", "cree_le"]
        read_only_fields = ["numero"]

    def create(self, validated_data):
        lignes = validated_data.pop("lignes", [])
        livraison = BonLivraison(**validated_data)
        livraison.save()  # génère BDL-SLUG-JJ-MM-AAAA-ID
        for l in lignes:
            lc = l.pop("ligne_commande", None)
            kw = dict(l)
            if lc is not None and livraison.commande_id and lc.commande_id == livraison.commande_id:
                kw["ligne_commande"] = lc
            LigneBonLivraison.objects.create(livraison=livraison, **kw)
        return livraison


class FournisseurViewSet(viewsets.ModelViewSet):
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["statut", "categorie"]
    search_fields = ["nom_societe", "contact", "email"]
    ordering = ["nom_societe"]

    def get_queryset(self):
        from django.db.models import Count

        return Fournisseur.objects.annotate(factures_count=Count("factures", distinct=True)).all()

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        obj = self.get_object()
        if obj.factures.exists() or obj.commandes.exists():
            return Response(
                {"detail": "Fournisseur lié à des factures ou commandes : suppression impossible, passez-le inactif."},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """Fiche 360° fournisseur : infos + commandes + livraisons + factures + solde."""
        f = self.get_object()
        factures = FactureFournisseur.objects.filter(fournisseur=f).prefetch_related("lignes", "paiements")
        return Response({
            "fournisseur": FournisseurSerializer(f).data,
            "commandes": BonCommandeSerializer(
                BonCommande.objects.filter(fournisseur=f).prefetch_related("lignes"), many=True).data,
            "livraisons": BonLivraisonSerializer(
                BonLivraison.objects.filter(fournisseur=f).prefetch_related("lignes"), many=True).data,
            "factures": FactureFournisseurSerializer(factures, many=True).data,
            "paiements": PaiementFournisseurSerializer(
                PaiementFournisseur.objects.filter(facture__fournisseur=f), many=True
            ).data,
            "solde_du": float(f.solde_du or 0),
        })


class FactureFournisseurViewSet(viewsets.ModelViewSet):
    queryset = FactureFournisseur.objects.select_related("fournisseur").prefetch_related("lignes", "paiements").all()
    serializer_class = FactureFournisseurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["fournisseur", "statut"]
    search_fields = ["numero", "reference_fournisseur", "objet"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        facture = self.get_object()
        return FileResponse(pdf_facture_fournisseur(facture), as_attachment=True,
                            filename=f"{facture.numero}.pdf")

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        facture = self.get_object()
        if facture.statut not in (FactureFournisseur.STATUT_BROUILLON, FactureFournisseur.STATUT_RECUE):
            return Response({"detail": "Facture déjà validée ou payée."}, status=400)
        facture.statut = FactureFournisseur.STATUT_VALIDEE
        facture.save()
        return Response(FactureFournisseurSerializer(facture).data)

    @action(detail=True, methods=["post"])
    def payer(self, request, pk=None):
        """Enregistre un paiement fournisseur -> statut auto payée/partielle."""
        facture = self.get_object()
        ser = PaiementFournisseurSerializer(data={**request.data, "facture": facture.id})
        ser.is_valid(raise_exception=True)
        paiement = ser.save()
        facture = FactureFournisseur.objects.prefetch_related("lignes", "paiements").get(id=facture.id)
        facture.statut = (
            FactureFournisseur.STATUT_PAYEE if facture.solde <= 0 else FactureFournisseur.STATUT_PARTIELLE
        )
        facture.save()
        return Response(PaiementFournisseurSerializer(paiement).data, status=201)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        obj = self.get_object()
        if obj.paiements.exists():
            return Response({"detail": "Facture avec paiements : suppression impossible."}, status=400)
        return super().destroy(request, *args, **kwargs)


class PaiementFournisseurViewSet(viewsets.ModelViewSet):
    queryset = PaiementFournisseur.objects.select_related("facture").all()
    serializer_class = PaiementFournisseurSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["facture", "moyen"]
    http_method_names = ["get", "post", "delete"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        paiement = self.get_object()
        return FileResponse(pdf_paiement_fournisseur(paiement), as_attachment=True,
                            filename=f"recu-fournisseur-{paiement.pk:06d}.pdf")


class BonCommandeViewSet(viewsets.ModelViewSet):
    queryset = BonCommande.objects.select_related("fournisseur").prefetch_related("lignes").all()
    serializer_class = BonCommandeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["fournisseur", "statut"]
    search_fields = ["numero", "objet"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        commande = self.get_object()
        return FileResponse(pdf_bon_commande(commande), as_attachment=True,
                            filename=f"{commande.numero}.pdf")

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != BonCommande.STATUT_BROUILLON:
            return Response({"detail": "Seul un brouillon peut être validé."}, status=400)
        commande.statut = BonCommande.STATUT_VALIDEE
        commande.save()
        return Response(BonCommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def envoyer(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != BonCommande.STATUT_VALIDEE:
            return Response({"detail": "Validez d'abord le bon de commande."}, status=400)
        commande.statut = BonCommande.STATUT_ENVOYEE
        commande.save()
        return Response(BonCommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def convertir(self, request, pk=None):
        """Convertit la commande (livrée) en facture fournisseur."""
        commande = self.get_object()
        if commande.statut not in (BonCommande.STATUT_LIVREE, BonCommande.STATUT_PARTIELLE,
                                   BonCommande.STATUT_ENVOYEE):
            return Response({"detail": "Commande non livrable en facture (validez + réceptionnez d'abord)."},
                            status=400)
        facture = FactureFournisseur.objects.create(
            fournisseur=commande.fournisseur, commande=commande,
            objet=commande.objet or f"Commande {commande.numero}",
            statut=FactureFournisseur.STATUT_VALIDEE)
        for l in commande.lignes.all():
            LigneFactureFournisseur.objects.create(
                facture=facture, description=l.description,
                quantite=l.quantite, montant=l.montant)
        commande.statut = BonCommande.STATUT_FACTUREE
        commande.save()
        return Response(FactureFournisseurSerializer(facture).data, status=201)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        obj = self.get_object()
        if obj.statut not in (BonCommande.STATUT_BROUILLON, BonCommande.STATUT_ANNULEE):
            return Response({"detail": "Seul un brouillon (ou annulée) peut être supprimé."}, status=400)
        return super().destroy(request, *args, **kwargs)


class BonLivraisonViewSet(viewsets.ModelViewSet):
    queryset = BonLivraison.objects.select_related("fournisseur", "commande").prefetch_related("lignes").all()
    serializer_class = BonLivraisonSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["fournisseur", "statut", "commande"]
    search_fields = ["numero"]

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        livraison = self.get_object()
        return FileResponse(pdf_bon_livraison(livraison), as_attachment=True,
                            filename=f"{livraison.numero}.pdf")

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Valide la réception : impute les quantités sur la commande liée."""
        livraison = self.get_object()
        if livraison.statut != BonLivraison.STATUT_BROUILLON:
            return Response({"detail": "Bon déjà validé."}, status=400)
        livraison.statut = BonLivraison.STATUT_VALIDE
        livraison.save()
        commande = livraison.commande
        if commande:
            for l in livraison.lignes.select_related("ligne_commande").all():
                if l.ligne_commande:
                    lc = l.ligne_commande
                    lc.quantite_livree = (lc.quantite_livree or 0) + (l.quantite or 0)
                    lc.save(update_fields=["quantite_livree"])
            lignes = list(commande.lignes.all())
            if lignes and all((l.quantite_livree or 0) >= (l.quantite or 0) for l in lignes):
                commande.statut = BonCommande.STATUT_LIVREE
            elif any((l.quantite_livree or 0) > 0 for l in lignes):
                commande.statut = BonCommande.STATUT_PARTIELLE
            commande.save()
        return Response(BonLivraisonSerializer(livraison).data)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("super_admin", "chef_finance"):
            return Response({"detail": "Suppression réservée au Chef Finance."}, status=403)
        obj = self.get_object()
        if obj.statut != BonLivraison.STATUT_BROUILLON:
            return Response({"detail": "Seul un brouillon peut être supprimé."}, status=400)
        return super().destroy(request, *args, **kwargs)
