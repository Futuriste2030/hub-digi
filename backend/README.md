# HUB DIGI — Backend (Django DRF)

Stack SPEC §2 adaptée projet : Django 5 + DRF + SimpleJWT + SQLite (pas de PostgreSQL).
Pas de venv : dépendances installées globalement. Pas de Redis requis :
Celery tourne en mode eager (synchrone) par défaut.

## Démarrage

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # Windows : copy .env.example .env
python manage.py migrate
python seed_phase1.py  # départements + superuser admin@digicom.ml / Admin123!
python seed_users.py  # aligne les 9 comptes rôles (mdp HubDigi2026! sauf existants)
python seed_projets.py  # users démo + projets/tâches/jalons
python seed_phase23.py  # identités mail + employé + contrat
python manage.py runserver
```

- API : http://localhost:8000/api/v1/
- Doc OpenAPI : http://localhost:8000/api/docs/
- Admin : http://localhost:8000/admin/

Comptes (base vierge : `seed_phase1.py` + `seed_users.py`) : `admin@digicom.ml / Admin123!`,
tous les autres rôles (`a.diarra`, `m.kone`, `s.traore`, `a.diallo`, `f.diarra`,
`k.sow`, `m.cisse`) en `@digicom.ml / HubDigi2026!`.
Tests auto : `test.admin@digicom.ml / Test12345!` (ne pas activer sa 2FA).

## Endpoints Phase 1

```
POST /api/v1/auth/login/  {email, password} -> {access, refresh} (JWT: role, department_id, poste_id, client_id)
POST /api/v1/auth/refresh/
POST /api/v1/auth/otp/setup/ (connecté, renvoie otpauth_url pour QR)
POST /api/v1/auth/otp/confirm/ {code} -> active la 2FA
POST /api/v1/auth/otp/verify/ {temp_token, code} -> JWT (2e étape login si 2FA)
DELETE /api/v1/auth/otp/disable/
GET /api/v1/auth/otp/status/
POST /api/v1/auth/password/reset/ {email} -> mail template reset_password (lien 24h)
POST /api/v1/auth/password/reset/confirm/ {uid, token, new_password}
POST /api/v1/auth/password/change/ {current_password, new_password, code?} (connecté)
GET  /api/v1/users/me/
GET/POST /api/v1/users/ (super_admin) ; GET /api/v1/users/mini/ (selects)
GET  /api/v1/departments/ /api/v1/postes/
GET/POST /api/v1/clients/ (slug auto, ?slug=) + GET /api/v1/clients/:id/overview/ (fiche 360° réelle)
GET/POST /api/v1/projects/ (écriture : super_admin + chef_dev, client = lecture seule)
GET/POST /api/v1/tasks/ /api/v1/milestones/ (?project_id, ?statut)
GET /api/v1/projects/:id/tasks/ /milestones/
GET/POST /api/v1/bugs/ + :id/convertir/ ; GET/POST /api/v1/tracker-keys/ ; POST /api/v1/bugs/report/ (public)
GET /api/v1/portal/dashboard/ (client : ses données ; super_admin : ?client= pour aperçu)
GET /api/v1/dashboard/super-admin/ /dashboard/perso/ /dashboard/series/
GET /api/v1/settings/entreprise/ + PATCH (super_admin)
```

## Endpoints Phases 2-3

```
# Finance
GET/POST /api/v1/finance/quotes/ + :id/valider/ (client, -> facture) + :id/rejeter/
GET/POST /api/v1/finance/invoices/ + :id/pdf/ + :id/payer/ (reçu auto) + :id/envoyer/
GET/POST /api/v1/finance/receipts/ + :id/pdf/ ; GET/POST /api/v1/finance/expenses/
GET/POST /api/v1/finance/paie/ + :id/ajouter_ligne/ + :id/lignes/:numero/ (PATCH) + :id/cloturer/ + :id/cachet/ (POST/DELETE)
Dashboard : ca_paye (brut), depenses_total, ca_net (encaissé affiché) ; séries +depenses/mois
# Tickets + secrétariat
GET/POST /api/v1/tickets/ + :id/qualify/ + :id/request_approval/ + :id/approve/ + :id/reply/
+ :id/messages/ + :id/approvals/ + :id/clore/ + :id/rouvrir/ + :id/rejeter/
GET/POST /api/v1/secretariat/courriers/ (statut, contenu)
GET/POST /api/v1/secretariat/reunions/ (participants, ODJ, PV)
POST /api/v1/secretariat/reunions/:id/decider/ + .../decisions/:dec_id/convertir/ {project_id}
# Mailing
POST /api/v1/mailing/send/ {to, subject, body_html, client?, ticket?, project?} ; GET /api/v1/mailing/sent/ (scopé client)
GET /api/v1/mailing/templates/ (modèles) ; MailTemplate éditables en admin
# RH
GET/POST /api/v1/rh/employees/ /api/v1/rh/leaves/ + leaves/:id/validate/ {decision, commentaire}
GET/POST /api/v1/rh/recruitments/ ; POST /api/v1/rh/candidatures/ (webhook X-Hub-Token, throttle)
# Juridique / Com / Bugs / Transverse
GET/POST /api/v1/juridique/contracts/ (contenu) /api/v1/juridique/disputes/
GET/POST /api/v1/com/campaigns/ /api/v1/com/calendar/ /api/v1/com/medias/ (type, url, statut) /api/v1/com/communiques/
GET /static/tracker.js (script <10 Ko à coller chez les clients web)
GET /api/v1/notifications/ (ses notifs)
GET /api/v1/chat/conversations/ (dernier message + non-lus par interlocuteur)
GET /api/v1/chat/messages/?avec= ; POST /api/v1/chat/send/ ; POST /api/v1/chat/lus/
```

## Paiement en ligne — LigdiCash (payin avec redirection)

App `apps/ligdicash`. Les clés (`LIGDICASH_API_KEY`, `LIGDICASH_API_TOKEN`) ne
sortent JAMAIS du backend. Actif quand `PAYMENT_ENABLED=1` **et**
`LIGDICASH_ENABLED=1` (backend/.env).

```
POST /api/v1/finance/paiements/ligdicash/initier/        {facture_id} -> {transaction_id, pay_url}
POST /api/v1/finance/paiements/ligdicash/initier-lien/    {facture, sig} (public, lien signé)
GET  /api/v1/finance/paiements/ligdicash/facture/<numero>/?sig=...   (public : page de paiement)
GET  /api/v1/finance/paiements/ligdicash/recu/<numero>/?sig=...      (public : vérification reçu)
GET  /api/v1/finance/paiements/ligdicash/retour/<txn>/?sig=...       (public : page de retour)
GET  /api/v1/finance/paiements/ligdicash/<txn>/statut/               (authentifié)
POST /api/v1/finance/paiements/ligdicash/callback/                   (public : callback LigdiCash)
```

- **Lien unique et signé par facture** : `/paiement/facture/<numero>?sig=…`
  (HMAC sur le SECRET_KEY). Il est figé dans le QR de la facture PDF, dans le
  mail `facture_disponible` / `relance_facture`, dans le message WhatsApp et
  dans le bouton « copier le lien de paiement ». Le reçu reçoit son propre
  lien de vérification `/paiement/recu/<numero>` (QR du reçu).
- Le lien est **stable** ; le montant est **TOUJOURS recalculé par le serveur**
  (le client ne peut pas altérer le QR).
- Le callback LigdiCash est **re-vérifié** via `/confirm` avec le token de
  création stocké : le payload reçu n'est jamais cru. Le double POST de
  LigdiCash est dédupliqué sur le statut en base.
- Un montant encaissé différent du montant figé n'est **pas** encaissé
  automatiquement : l'anomalie est tracée (`PayinTransaction.erreur`).

Test réel (crée une facture, ne paie jamais) :

```bash
python manage.py ligdicash_test                    # facture fictive 100 XOF
python manage.py ligdicash_test --facture FACTURE-SLUG-JJ-MM-AAAA-ID
```

En dev, `LIGDICASH_CALLBACK_URL` doit être joignable depuis Internet (tunnel)
sinon aucun callback ne remonte : le statut se lit alors via `/statut/`.

> ⚠️ La signature des liens dérive du `DJANGO_SECRET_KEY` : le faire tourner
> invalide les QR déjà imprimés (les liens signés deviennent refusés).

**Durée de vie de la page de paiement** : la page LigdiCash servie par
`pay_url` cesse de répondre **~16 min après la création de la facture**
(mesuré) — elle renvoie alors une 404. Deux garde-fous côté HUB DIGI :

- `FENETRE_REPRISE` (15 min) : une tentative en cours plus ancienne n'est pas
  réutilisée — une nouvelle facture LigdiCash est créée ;
- `page_paiement_valide()` : le `pay_url` est réellement ouvert avant d'être
  renvoyé au client. S'il sert une 404, la transaction est marquée
  `notcompleted` et une nouvelle facture est créée (2 essais), sinon le client
  est envoyé vers une page morte.

Diagnostic :

```bash
python manage.py verif_paiement           # contrôle les pay_url stockés
python manage.py verif_paiement --creer   # + crée une facture test (aucun paiement)
```

### Validation d'intégration LigdiCash (équipe LigdiCash)

**Traçabilité des callbacks** — chaque POST reçu sur le callback est journalisé
(corps brut, en-têtes, IP, réponse) dans `CallbackLigdiCash`, y compris les
sondes envoyées avant toute transaction réelle. La réponse est **toujours en
200** : un 4xx ferait retryer LigdiCash et ferait échouer la validation.

```bash
python manage.py callbacks_ligdicash                # les 20 derniers, lisibles
python manage.py callbacks_ligdicash --dernier 5
python manage.py callbacks_ligdicash --transaction PAI-20261020-XXXXXX
python manage.py callbacks_ligdicash --format json  # sortie brute à coller
```

**Lien de paiement de test** :

```bash
python manage.py lien_test_ligdicash --montant 10
python manage.py lien_test_ligdicash --montant 100
```

Le lien affiché est celui du QR de la facture (public, signé, **stable**) :
chaque ouverture crée une facture LigdiCash neuve, donc le lien reste
valable même des le lendemain.

> ⚠️ **Minimum opérateur** : notre application n'impose aucun minimum (elle
> refuse seulement un montant ≤ 0), mais **Orange Mali refuse en dessous de
> 100 F CFA** (table des opérateurs LigdiCash). Un paiement de 10 F CFA sera
> donc refusé par l'opérateur, pas par l'application.

### Régénérer les PDF (QR « PAYEZ ICI » + lien)

Les PDF sont produits à la volée par l'API : ce sont les envois (mails) et les
documents déjà imprimés qui restent sur l'ancienne version.

```bash
python manage.py regenerer_pdfs             # tous les PDF -> media/factures + media/recus
python manage.py regenerer_pdfs --envoyer   # + renvoi du mail facture_disponible
python manage.py regenerer_pdfs --numero FACTURE-... --statut envoyee
```

### Tester le paiement derrière ngrok (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-ngrok.ps1   # depuis la racine
powershell -ExecutionPolicy Bypass -File .\scripts\dev-ngrok.ps1 -Stop
```

Le script fait tout : lit l'authtoken ngrok (config globale), démarre le tunnel,
réécrit `backend/.env` + `frontend/.env` avec l'URL publique, relance Django et
Vite. Les valeurs PROD de `backend/.env` sont sauvegardées dans
`backend/.env.prod.bak`.

**Un seul tunnel, une seule origine.** ngrok Free n'accorde qu'UN domaine par
compte : impossible d'exposer l'API et le SPA sur deux tunnels (ils se marchent
dessus). Le tunnel pointe donc sur Vite (5199) et Vite relaie Django via
`server.proxy` (`frontend/vite.config.js`). Conséquences :

- SPA et API partagent la même origine → pas de CORS, pas de CSRF en dev.
- `VITE_API_URL=/api/v1` (chemin relatif) au lieu d'une URL absolue.
- `FRONTEND_URL`, `LIGDICASH_STORE_URL` et `LIGDICASH_CALLBACK_URL` pointent
  tous vers l'URL publique du tunnel.

Points d'attention :

- `DJANGO_DEBUG=1` en dev : sinon `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE`
  bloquent les cookies sur `http://localhost`.
- `EMAIL_BACKEND=console` en dev (le SMTP du VPS n'a pas de vrai mot de passe).
- Le premier accès navigateur au tunnel affiche la page d'avertissement ngrok
  (« Visit Site ») ; les appels XHR portent l'en-tête `ngrok-skip-browser-warning`
  pour la contourner (`frontend/src/api/client.js`).
- Vérifier la réception du callback sur http://127.0.0.1:4040 (requêtes).
- Smoke test sans navigateur, sans payer :
  `python manage.py ligdicash_test` (facture fictive de 100 XOF).

## Attestations de formation

Document officiel (PDF **A4 paysage**) délivré à un stagiaire : cadre double,
cachet + signature superposés, et **QR de traçabilité** qui encode le lien
public de vérification. Le lien est signé (HMAC, contexte « attestation » —
distinct du paiement) : `/attestation/<numero>?sig=…`.

- `AttestationFormation` : une par inscription (`OneToOne`), numéro figé
  `ATT-2026-0012`, mention libre, date de délivrance.
- `InscriptionFormation.STATUT_TERMINEE` : nouveau statut — **seules les
  inscriptions terminées sont éligibles** (défaut ; `confirmee` acceptée en
  option via `?statuts=`).
- `Formation` : `date_debut`, `date_fin`, `lieu` (imprimés sur le document).
- `SiteSettings` : `cachet_formation`, `signature_formation`,
  `signataire_formation` (à saisir dans l'admin Django).

```bash
POST /api/v1/formations/inscriptions/{id}/attestation/     -> délivre (ou retourne)
POST /api/v1/formations/catalogue/{id}/attestations/       -> génération par formation
GET  /api/v1/formations/catalogue/{id}/attestations/zip/   -> ZIP des PDF
GET  /api/v1/formations/attestations/{id}/pdf/              -> PDF (A4 paysage)
GET  /api/v1/formations/attestations/                      -> liste
GET  /api/v1/formations/verification/{numero}/?sig=…       -> VÉRIFICATION PUBLIQUE
```

Rôles autorisés à délivrer : `super_admin`, `admin`, `chef_finance`,
`membre_finance`. La vérification publique est ouverte à tous (comme le reçu) :
la signature fait foi, et la page affiche l'attestation **enregistrée** dans
le HUB (source de vérité, pas une capture).

Jeu d'essai :

```bash
python seed_attestations_demo.py
```

## Templates mail (charte DIGI COM, layout central `apps/mailing/layout.py`)

`bienvenue_espace_client`, `facture_disponible` (auto à l'envoi), `relance_facture` (auto J+),
`recu_disponible` (auto au paiement), `reponse_ticket` (auto à la réponse),
`validation_visuel`, `reset_password`, `conge_rappel_j3` (auto tâche),
`reunion_convocation`, `reunion_pv_diffusion`.
Éditables en admin. Header marine `#0b182b`, accent par cas, bouton `#2f7cbe`, footer marine.

Comptes démo : `m.kone@digicom.ml / Dev12345!` (chef dev), `s.traore@digicom.ml / Dev12345!`
(membre dev), `contact@orangemali.ml / Client123!` (client).

Frontend (port 5199) déjà autorisé en CORS (voir `CORS_ALLOWED_ORIGINS`).
