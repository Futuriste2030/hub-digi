"""Recherche globale transverse (§5 SPEC Jira) : un seul champ, SQLite icontains, sans moteur externe.

GET /api/v1/search/?q= (minimum 2 caracteres). Resultats groupes par type,
limites a 8 par entite, avec id/type/titre/reference/url interne uniquement.
Permissions : memes querysets filtres que les modules, jamais de requete brute.
Role client exclu (liste vide).
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def _interne(user):
    return getattr(user, "role", None) != "client"


def _norme(s):
    import unicodedata

    return "".join(c for c in unicodedata.normalize("NFKD", str(s).lower())
                   if not unicodedata.combining(c))


# Raccourcis de navigation : taper « projets », « factures », « congés »…
# propose la page, même sans objet correspondant (filtrés par rôle).
NAVIGATION = [
    ({"tableau de bord", "dashboard", "pilotage"}, "Tableau de bord", "/dashboard", "*"),
    ({"clients", "client", "prospects"}, "Clients", "/clients", "*"),
    ({"projets", "projet"}, "Projets", "/projets", "dev"),
    ({"taches", "tâches", "kanban"}, "Tâches Kanban", "/dev/taches", "dev"),
    ({"backlog", "sprints", "sprint"}, "Backlog & Sprints", "/dev/backlog", "dev"),
    ({"bugs", "bug", "tracker"}, "Bugs", "/dev/bugs", "dev"),
    ({"calendrier", "éditorial", "editorial"}, "Calendrier éditorial", "/com/calendrier", "com"),
    ({"campagnes", "campagne"}, "Campagnes", "/com/campagnes", "com"),
    ({"medias", "médias", "bibliotheque"}, "Médias", "/com/medias", "com"),
    ({"tickets", "ticket", "support"}, "Tickets", "/tickets", "*"),
    ({"factures", "facture", "impayes"}, "Factures", "/factures", "finance"),
    ({"devis"}, "Devis", "/finance/devis", "finance"),
    ({"recus", "reçus", "recu"}, "Reçus", "/finance/recus", "finance"),
    ({"depenses", "dépenses"}, "Dépenses", "/finance/depenses", "finance"),
    ({"fournisseurs", "achats"}, "Fournisseurs", "/finance/fournisseurs", "finance"),
    ({"paie", "salaires"}, "Paie", "/finance/paie", "finance"),
    ({"contrats", "contrat"}, "Contrats", "/juridique/contrats", "juridique"),
    ({"litiges", "litige"}, "Litiges", "/juridique/litiges", "juridique"),
    ({"courriers", "courrier"}, "Courriers", "/secretariat/courriers", "secretariat"),
    ({"offres", "offre", "lettres", "lettre", "attestations", "documents"}, "Offres & lettres", "/secretariat/documents", "secretariat"),
    ({"decharges", "décharges"}, "Décharges", "/secretariat/decharges", "secretariat"),
    ({"reunions", "réunions", "pv"}, "Réunions", "/secretariat/reunions", "secretariat"),
    ({"employes", "employés"}, "Employés", "/rh/employes", "rh"),
    ({"conges", "congés", "absences"}, "Congés", "/rh/conges", "*"),
    ({"recrutement", "candidatures", "carriere"}, "Recrutement", "/rh/recrutement", "rh"),
    ({"pointage", "pointer", "qr"}, "Pointer", "/pointage", "*"),
    ({"mails", "mail", "email"}, "E-mails", "/mails", "*"),
    ({"chat", "messages"}, "Chat interne", "/chat", "*"),
    ({"profil", "compte"}, "Mon profil", "/profil", "*"),
    ({"parametres", "paramètres", "utilisateurs"}, "Paramètres", "/parametres", "super"),
]

_PERIMETRE = {
    "*": None,  # tous internes (client déjà exclu)
    "dev": {"super_admin", "chef_dev", "membre_dev"},
    "com": {"super_admin", "chef_com", "membre_com"},
    "finance": {"super_admin", "chef_finance", "membre_finance"},
    "juridique": {"super_admin", "chef_juridique", "membre_juridique"},
    "secretariat": {"super_admin", "admin"},
    "rh": {"super_admin", "admin", "chef_rh", "membre_rh"},
    "super": {"super_admin"},
}


def _navigations(q, role):
    nq = _norme(q)
    trouvees = []
    for mots, titre, url, perimetre in NAVIGATION:
        roles = _PERIMETRE[perimetre]
        if roles is not None and role not in roles:
            continue
        if any(nq in _norme(m) or _norme(m) in nq for m in mots):
            trouvees.append({"id": url, "type": "navigation", "titre": titre,
                             "reference": "", "url": url})
        if len(trouvees) >= 8:
            break
    return trouvees


class RechercheGlobaleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"detail": "Recherche de 2 caractères minimum (q=)."}, status=400)
        user = request.user
        if not _interne(user):
            return Response({"groupes": []})
        role = getattr(user, "role", None)
        groupes = []

        # Pages (toujours en premier : « projets » → la page Projets).
        for nav in _navigations(q, role):
            groupes.append(("navigation", nav))

        def peut(*roles):
            return role in roles

        from django.db.models import Q

        # Tâches (référence, titre, e-mail assigné) — dev + super_admin.
        if peut("super_admin", "chef_dev", "membre_dev"):
            from apps.projects_dev.models import Task

            qs = Task.objects.select_related("project")
            for t in qs.filter(Q(reference__icontains=q) | Q(titre__icontains=q)
                              | Q(assigne__email__icontains=q))[:8]:
                groupes.append(("tache", t))
        # Bugs (numéro, titre, description) — dev + super_admin.
        if peut("super_admin", "chef_dev", "membre_dev"):
            from apps.bugtracker.models import BugReport

            for b in BugReport.objects.filter(Q(numero__icontains=q) | Q(titre__icontains=q)
                                              | Q(description__icontains=q))[:8]:
                groupes.append(("bug", b))
        # Projets — dev + super_admin (titre ou nom du client).
        if peut("super_admin", "chef_dev", "membre_dev"):
            from django.db.models import Q

            from apps.projects_dev.models import Project

            for p in Project.objects.select_related("client").filter(
                    Q(titre__icontains=q) | Q(client__nom_societe__icontains=q))[:8]:
                groupes.append(("projet", p))
        # Clients (société, contact, e-mail, téléphone) — tous internes.
        if _interne(user):
            from apps.clients.models import Client

            for c in Client.objects.filter(
                    Q(nom_societe__icontains=q) | Q(contact__icontains=q)
                    | Q(email__icontains=q) | Q(phone__icontains=q))[:8]:
                groupes.append(("client", c))
        # Tickets (numéro, sujet, message, catégorie) — tous internes.
        if _interne(user):
            from apps.secretariat_tickets.models import Ticket

            for t in Ticket.objects.filter(
                    Q(numero__icontains=q) | Q(sujet__icontains=q)
                    | Q(message__icontains=q) | Q(categorie__icontains=q))[:8]:
                groupes.append(("ticket", t))
        # Devis (numéro, objet, client) / factures (numéro, client) — finance + super_admin.
        if peut("super_admin", "chef_finance", "membre_finance"):
            from apps.finance.models import Devis, Invoice

            for d in Devis.objects.filter(
                    Q(numero__icontains=q) | Q(objet__icontains=q)
                    | Q(client__nom_societe__icontains=q))[:8]:
                groupes.append(("devis", d))
            for f in Invoice.objects.filter(
                    Q(numero__icontains=q) | Q(client__nom_societe__icontains=q))[:8]:
                groupes.append(("facture", f))
        # Courriers (référence, objet, expéditeur, destinataire) — secrétariat.
        if peut("super_admin", "admin"):
            from apps.secretariat_tickets.models import Courrier, DocumentSecretariat

            for c in Courrier.objects.filter(
                    Q(reference__icontains=q) | Q(objet__icontains=q)
                    | Q(expediteur__icontains=q) | Q(destinataire__icontains=q))[:8]:
                groupes.append(("courrier", c))
            for d in DocumentSecretariat.objects.filter(
                    Q(reference__icontains=q) | Q(titre__icontains=q)
                    | Q(destinataire__icontains=q))[:8]:
                groupes.append(("document-secretariat", d))
        # Campagnes (titre, objectifs, client) — com + super_admin.
        if peut("super_admin", "chef_com", "membre_com"):
            from apps.com.models import Campaign

            for c in Campaign.objects.filter(
                    Q(titre__icontains=q) | Q(objectifs__icontains=q)
                    | Q(client__nom_societe__icontains=q))[:8]:
                groupes.append(("campagne", c))
        # Employés (nom, e-mail, fonction) — RH + super_admin.
        if peut("super_admin", "admin", "chef_rh", "membre_rh"):
            from apps.rh.models import Employee

            for e in Employee.objects.select_related("user").filter(
                    Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q)
                    | Q(user__email__icontains=q) | Q(fonction__icontains=q))[:8]:
                groupes.append(("employe", e))
        # Congés (motif) — RH voit tout, chacun voit les siens.
        if _interne(user):
            from apps.rh.models import Leave

            if peut("super_admin", "admin", "chef_rh", "membre_rh"):
                conges = Leave.objects.filter(motif__icontains=q)
            else:
                conges = Leave.objects.filter(motif__icontains=q, employe__user=user)
            for lv in conges.select_related("employe__user")[:8]:
                groupes.append(("conge", lv))

        par_type = {}
        for type_, obj in groupes:
            # Entrées navigation : déjà des fiches prêtes.
            fiche = obj if isinstance(obj, dict) else _fiche(type_, obj)
            par_type.setdefault(type_, []).append(fiche)
        return Response({"groupes": [{"type": k, "resultats": v[:8]} for k, v in par_type.items()]})


def _fiche(type_, obj):
    if type_ == "tache":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": getattr(obj, "reference", ""), "url": f"/projets/{obj.project_id}"}
    if type_ == "bug":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": getattr(obj, "numero", ""), "url": "/dev/bugs"}
    if type_ == "projet":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": "", "url": f"/projets/{obj.id}"}
    if type_ == "client":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "nom_societe", str(obj)),
                "reference": "", "url": f"/clients/{obj.id}"}
    if type_ == "ticket":
        return {"id": obj.id, "type": type_, "titre": f"{getattr(obj, 'numero', '')} — {getattr(obj, 'sujet', '')}",
                "reference": getattr(obj, "numero", ""), "url": "/tickets"}
    if type_ == "campagne":
        return {"id": obj.id, "type": type_, "titre": obj.titre,
                "reference": "", "url": "/com/campagnes"}
    if type_ == "employe":
        u = getattr(obj, "user", None)
        nom = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip() or getattr(u, "email", "")
        return {"id": obj.id, "type": type_, "titre": f"{nom} · {obj.fonction or ''}".strip(),
                "reference": "", "url": "/rh/employes"}
    if type_ == "conge":
        return {"id": obj.id, "type": type_, "titre": f"Congé {obj.du_jour} → {obj.au_jour} : {obj.motif or ''}",
                "reference": "", "url": "/rh/conges"}
    if type_ == "devis":
        return {"id": obj.id, "type": type_, "titre": f"{getattr(obj, 'numero', '')} — {getattr(obj, 'objet', '')}",
                "reference": getattr(obj, "numero", ""), "url": "/finance/devis"}
    if type_ == "facture":
        return {"id": obj.id, "type": type_, "titre": getattr(obj, "numero", str(obj)),
                "reference": getattr(obj, "numero", ""), "url": f"/factures/{getattr(obj, 'numero', obj.id)}"}
    if type_ == "document-secretariat":
        return {"id": obj.id, "type": type_, "titre": f"{getattr(obj, 'reference', '')} — {getattr(obj, 'titre', '')}",
                "reference": getattr(obj, "reference", ""), "url": "/secretariat/documents"}
    return {"id": obj.id, "type": type_, "titre": getattr(obj, "reference", str(obj)),
            "reference": getattr(obj, "reference", ""), "url": "/secretariat/courriers"}
