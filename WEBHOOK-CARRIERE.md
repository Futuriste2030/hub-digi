# Webhook Carrière → HUB DIGI (option 2 — temps réel)

**Statut :** À faire après (phase backend Django).
**Principe :** le site vitrine envoie chaque candidature au HUB dès son dépôt.
Aucun polling, aucune API payante, pas de scraping.

---

## 1. Côté site vitrine (Django en ligne existant)

À chaque `form_valid()` du formulaire Carrière, poster vers le HUB.
Ne jamais bloquer la réponse visiteur : timeout court + log d'échec.

```python
# settings.py (site vitrine)
HUB_WEBHOOK_URL = "https://hub.digicom.ml/api/v1/rh/candidatures/"
HUB_WEBHOOK_TOKEN = "À-GÉNÉRER-32-caractères-minimum"  # même valeur des deux côtés
```

```python
# views.py (site vitrine) — après enregistrement local
import logging, requests
from django.conf import settings

logger = logging.getLogger(__name__)

def notifier_hub(candidature):
    try:
        r = requests.post(
            settings.HUB_WEBHOOK_URL,
            json={
                "offre_reference": candidature.offre.slug,   # ex. "dev-backend-django"
                "offre_titre": candidature.offre.titre,
                "nom": candidature.nom,
                "email": candidature.email,
                "telephone": candidature.telephone,
                "message": candidature.message,
                "cv_url": candidature.cv.url if candidature.cv else None,
                "depose_le": candidature.cree_le.isoformat(),
            },
            headers={"X-Hub-Token": settings.HUB_WEBHOOK_TOKEN},
            timeout=5,
        )
        r.raise_for_status()
    except Exception as exc:  # visiteur jamais bloqué
        logger.error("Webhook HUB échoué : %s", exc)
```

Retry simple : si échec, marquer `exporte=False` et rejouer via cron Django
ou bouton admin « Renvoyer vers le HUB ».

## 2. Côté HUB (backend Django DRF à construire)

Endpoint : `POST /api/v1/rh/candidatures/`

- Auth : header `X-Hub-Token` comparé à `settings.CAREER_WEBHOOK_TOKEN`
  (comparaison constante, 403 sinon). HTTPS obligatoire.
- Validation : offre (référence ou titre), nom, e-mail valide.
- Déduplication : même `e-mail + offre` → `200 {statut: "doublon"}`,
  pas de double fiche.
- Création : `Candidature(..., source="site", statut="Reçue")`.
- Notification : responsable RH notifié (in-app + e-mail).
- Réponses : `201 {id, statut: "Reçue"}` · `400` payload invalide ·
  `403` token invalide. Throttle : 60 req/min/IP.

```python
# hub/recrutement/views.py (esquisse)
class CandidatureWebhookView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_scope = "webhook"

    def post(self, request):
        if not constant_time_compare(request.headers.get("X-Hub-Token", ""), settings.CAREER_WEBHOOK_TOKEN):
            return Response({"detail": "refusé"}, status=403)
        # valider (serializer), chercher offre, get_or_create par (email, offre)
        # créer avec source="site", notifier RH
        return Response({"id": ..., "statut": "Reçue"}, status=201)
```

## 3. Côté HUB (frontend — déjà prévu)

- Badge source sur chaque candidat : **Site web** / Saisie manuelle.
- Toast + pastille au RH à chaque import.
- Bouton secours « Importer du site » (si webhook en panne).

## 4. Test de bout en bout

```bash
curl -X POST https://hub.digicom.ml/api/v1/rh/candidatures/ \
  -H "Content-Type: application/json" \
  -H "X-Hub-Token: <TOKEN>" \
  -d '{"offre_reference":"dev-backend-django","offre_titre":"Dev Backend Django","nom":"Test Webhook","email":"test@mail.ml","message":"Candidature test"}'
# attendu : 201 + fiche visible dans /rh/recrutement avec badge "Site web"
```

## 5. Checklist de mise en service

- [ ] Générer le token partagé (32+ caractères), stocké côté serveur uniquement
- [ ] HTTPS actif des deux côtés
- [ ] Ajouter `notifier_hub()` au formulaire du site + champ `exporte`
- [ ] Implémenter l'endpoint HUB + serializer + throttle
- [ ] Badge source + toast frontend
- [ ] Test curl puis dépôt réel depuis la page Carrière
- [ ] Journaliser chaque appel (AuditLog) pour traçabilité
