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

## Templates mail (charte DIGI COM, layout central `apps/mailing/layout.py`)

`bienvenue_espace_client`, `facture_disponible` (auto à l'envoi), `relance_facture` (auto J+),
`recu_disponible` (auto au paiement), `reponse_ticket` (auto à la réponse),
`validation_visuel`, `reset_password`, `conge_rappel_j3` (auto tâche),
`reunion_convocation`, `reunion_pv_diffusion`.
Éditables en admin. Header marine `#0b182b`, accent par cas, bouton `#2f7cbe`, footer marine.

Comptes démo : `m.kone@digicom.ml / Dev12345!` (chef dev), `s.traore@digicom.ml / Dev12345!`
(membre dev), `contact@orangemali.ml / Client123!` (client).

Frontend (port 5199) déjà autorisé en CORS (voir `CORS_ALLOWED_ORIGINS`).
