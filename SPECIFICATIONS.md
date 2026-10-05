# HUB DIGI - Digi Com & Technologies
## Cahier des spécifications - Référence développement

**Version:** 1.3 - 05/10/2026 (client interne sans espace + pointage QR RH)
**v1.2 - 02/10/2026 (push web + biométrie, déploiement Docker hub.digicom.ml :8002)**
**v1.1 - 30/09/2026** (veille de mise en ligne sur `hub.digicom.ml`)
**v1.0 - 10/09/2026 :** socle initial.
**MAJ 15/09/2026 :** portail client `/espace/:slug/:code` ; 2FA TOTP + QR Profil ; chat temps différé + pastille tickets + cloche `/notifications/` ; reset accès client depuis la fiche (manuel).
**MAJ 05/10/2026 :** client interne `est_interne` (Digi Com elle-même gérée dans le hub : aucun compte `role=client`, aucun `/espace`, login + portail refusés côté backend, case à cocher + détection auto « digicom » dans `/clients/nouveau`, badge Interne liste/fiche) ; pointage RH par QR dynamique post-login (fenêtre 08h00–17h00 heure serveur, géofencing 150 m, retard après 08h15, rapports mensuels auto + employé du mois + primes).
**MAJ 30/09/2026 :** module Fournisseurs/Achats (fiches + BDC/BDL/factures ACHAT/paiements + reçus PDF, sélecteur Non payée/Acompte/Payée — c'est Digi Com qui paie, pas de lien de paiement) ; références serveur séquentielles (`references.py` + `CompteurReference` : `BDC/BDL/ACHAT/RECU-F-SLUG-AAAA-NNNN`) ; Décharges Secrétariat (scan compressé serveur JPEG 1600px q70) ; courriers : mention « sortant » retirée du document, cachet Secrétariat dédié (`cachet_secretariat`, signature manuscrite après impression) ; tous les modèles visibles dans `/admin/` (traces en lecture seule) ; notifs bugs (cloche Chef Dév + Super Admin, + admin et mail `dev@` si critique, `gravite` transmissible) ; footer = statut API réel (ping `/settings/entreprise/`) ; domaine unique `hub.digicom.ml` (front + API + tracker) ; `.env` backend prod (SMTP système, tokens) ; SMTP par identité : champs réglables dans `/admin/` mais envoi via compte unique `.env` (connexion dynamique SPEC §8 non implémentée, `smtp_password` en clair — fernet non implémenté).
**Stack imposée:** Frontend `React JS` + Backend `Django DRF` + `SQLite` ( abandon PostgreSQL : choix projet, `db.sqlite3`)
**Dossier:** `HUB DIGI/`
**Usage:** Document de référence tout au long du développement. Ne pas coder une feature hors de ce doc sans MAJ.

---

## 1. Vision globale

Hub interne multi-départements + portail client.

- **HUB (front + API, même domaine):** `hub.digicom.ml` (React) + `hub.digicom.ml/api/v1/` (Django DRF)
- **Portail client:** `hub.digicom.ml/espace/:slug` (même codebase, route guardée `role=client`)
- **Tracker:** `hub.digicom.ml/static/tracker.js` (script externe à coller chez clients web ; l'endpoint de report suit le domaine du `src`)

Objectifs:
- [x] Super Admin crée comptes et assigne `Département + Poste`
- [x] Chaque département a son espace + features spécifiques
- [x] Super Admin a accès à tout
- [x] Client voit factures, projets, deadlines, reçus, tickets sans appeler
- [x] Factures / reçus PDF générés automatiquement
- [ ] Traçabilité totale (audit log) — modèle `AuditLog` présent et visible `/admin/` (lecture seule), écriture auto non branchée

---

## 2. Stack technique

**Backend - Django DRF (réel au 30/09/2026):**
- Django 5 + DRF + SimpleJWT (access/refresh) + 2FA (django-otp)
- SQLite (`db.sqlite3`, choix projet — pas de PostgreSQL)
- Celery en mode eager (synchrone, sans Redis ni Beat actif)
- django-filter, drf-spectacular (doc OpenAPI sur `/api/docs/`), corsheaders
- ReportLab (PDF, charte marine + cachets), `smtp_password` en clair (fernet NON implémenté)
- Stockage médias: local `media/` (pense sauvegardes VPS : `db.sqlite3` + `media/`)

**Frontend - React JS (réel):**
- React 19 + Vite (port 5199) + React Router + Axios direct (pas de React Query)
- TailwindCSS + composants maison (`src/components/ui/`)
- Zustand (auth + session), `VITE_API_URL` (variable de build)
- Routes guardées par rôle (`RequireRole`) + footer = statut API réel (ping `/settings/entreprise/` toutes les 60 s)

**Apps Django (découpage réel):**
```
accounts, departments, clients, projects_dev, com, finance, fournisseurs, rh, juridique, secretariat_tickets, mailing, bugtracker, portal_client, core (audit, notifs, dashboard)
```

**Apps React (réel, pages à plat):**
```
src/pages/ (Clients, FicheClient, Projets, Factures, Fournisseurs, Courriers, Decharges, Recrutement, EspaceClient…), src/components/, src/hooks/, src/api/, src/data/, src/lib/acces.js (matrice rôles)
```

---

## 3. Rôles & Permissions

| Rôle | Scope | Peut |
|------|-------|------|
| `super_admin` | Tout | Créer/désactiver users, assigner Dept+Poste, config mails, voir logs, valider tout |
| `admin` (Administration/Secrétariat) | Transverse hors technique/finance | Dashboard global, clients, congés (validation), boîte tickets, courriers, réunions/PV, e-mails — PAS d'internes Dév/Com/Finance/Juridique |
| `chef_com` / `membre_com` | Com | Campagnes, calendrier, médias de ses clients |
| `chef_dev` / `membre_dev` | Dév | Projets, tâches, bugs, déploiements |
| `chef_rh` / `membre_rh` | RH | Employés, congés, recrutement |
| `chef_juridique` / `membre_juridique` | Juridique | Contrats, litiges, échéances |
| `chef_finance` / `membre_finance` | Finance | Devis, factures, reçus, dépenses |
| `client` | Son compte uniquement | Ses projets, factures, tickets, bugs de ses projets |

Règles:
- [x] `Poste` rattaché à `Department`. Ex: Dév -> Chef Projet, Dev Front, Dev Back, Stagiaire
- [x] Permission granulaire: `Chef` valide/assigne, `Membre` exécute
- [x] Un membre Com ne voit que Com (+ Fiche Client), pas Finance/RH sauf si Super Admin
- [x] JWT contient `role, department_id, poste_id` pour guards React (`RequireRole` + sidebar filtrée par `src/lib/acces.js`) ; backend DRF : permissions par rôle + filtres auto — le backend ne fait jamais confiance au frontend

**Matrice onglets × rôles (sidebar filtrée + routes guardées) :**

| Onglet (route) | `super_admin` | `admin` | Chef dept | Membre dept | `client` |
|----------------|---------------|---------|-----------|-------------|----------|
| Tableau de bord `/` | ✅ global | ✅ global | ✅ son dept | ✅ son dept | ❌ (a `/espace`) |
| Clients `/clients` (liste + 360°, onglets filtrés par dept) | ✅ | ✅ | ✅ lecture | ✅ lecture | ❌ |
| Com `/com/*` | ✅ | ❌ | ✅ si Com | ✅ si Com | ❌ (valide visuels via `/espace/:slug`) |
| Dév `/projets`, `/dev/*` (crayons réservés chef) | ✅ | ❌ | ✅ si Dév | ✅ si Dév | ❌ (suit ses projets via `/espace/:slug`) |
| Finance `/finance/*`, `/factures`, `/devis/*`, `/recus/*` | ✅ | ❌ | ✅ si Finance | ✅ si Finance | ❌ (ses factures via `/espace/:slug`) |
| Fournisseurs `/finance/fournisseurs` (BDC/BDL/factures ACHAT/reçus, sélecteur Non payée/Acompte/Payée) | ✅ | ❌ | ✅ si Finance | ✅ si Finance | ❌ |
| RH Employés/Recrutement | ✅ | ❌ | ✅ si RH | ✅ si RH | ❌ |
| RH Congés `/rh/conges` (Mes demandes tous, À valider RH/admin) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Juridique `/juridique/*` | ✅ | ❌ | ✅ si Juridique | ✅ si Juridique | ❌ |
| Tickets `/tickets` (qualifier/répondre = admin, aval = chef assigné) | ✅ | ✅ (boîte) | ✅ (ses assignés + avals) | ✅ (ses assignés, lecture) | ❌ (ses tickets via `/espace/:slug`) |
| Courriers `/secretariat/courriers` (papier à en-tête + cachet Secrétariat, impression/PDF navigateur) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Décharges `/secretariat/decharges` (scans compressés serveur) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Réunions `/secretariat/reunions` | ✅ | ✅ | ❌ | ❌ | ❌ |
| E-mails `/mails` (identité de son dept) | ✅ | ✅ | ✅ | ✅ | ❌ (historique via `/espace/:slug`) |
| Paramètres `/parametres` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Espace client `/espace/:slug` (portail séparé, hors sidebar, `/espace-client` redirige vers `/espace`) | ✅ (aperçu par slug) | ❌ | ❌ | ❌ | ✅ (ses données : `where client_id = me.client_id`) |

**Identifiants espace client :**
- [x] À la création du client, génération `username + mot de passe` affichés en fiche (aucun envoi auto : l'opérateur transmet via le template « Bienvenue espace client » + lien `/espace/:slug/:code`, reset via `POST /clients/:id/reset-password/` + `send-access/`)

Mécanisme:
- [x] Frontend : `session {role, department, poste, client_id}` (JWT décodé, store Zustand) -> Sidebar masque les sections interdites + `RequireRole` redirige toute URL directe interdite -> garde-fou, pas sécurité réelle
- [x] Backend : permissions DRF par rôle + filtres auto (`?client_id` = son compte si `role=client`) — le backend ne fait jamais confiance au frontend

---

## 4. Concept central: Fiche Client 360° (Onglets par client)

Obligatoire pour **Communication ET Développement** (même pattern partout).

Route React: `/clients/:id`
Route API: `/api/v1/clients/:id/overview/`

Onglets (fiche 360° `/clients/:id` + `overview/` réelle):
- [x] **Aperçu:** infos société, contacts, statut prospect/client, slug + code portail
- [x] **Projets Dév:** liste projets, % avancement, deadline, bugs ouverts
- [x] **Com:** campagnes liées, calendrier éditorial filtré client, assets à valider
- [x] **Finance:** devis, factures, reçus PDF, solde impayés, bouton relancer
- [x] **Juridique:** contrats signés, échéances, documents
- [x] **Tickets & Mails:** historique tickets + mails envoyés/reçus
- [x] **Documents:** tous fichiers liés

> Tout modèle métier a FK `client`. Les vues Dept filtrent par `?client_id=`.

---

## 5. Features par département

### 5.1 Super Admin (`/admin`)
- [x] CRUD users + assign Dept/Poste + reset password + disable (`/parametres/utilisateurs`)
- [x] Journal d'audit visible `/admin/` (lecture seule) ; matrices de permissions documentées (`src/data/permissions.js`, `src/lib/acces.js`)
- [x] Config EmailIdentity par département (admin Django + seeds) ; cachets/en-tête société dans `/parametres`
- [x] Dashboard KPI: CA, projets en retard, tickets ouverts, effectif, bugs
- [x] Gestion Départements/Postes
- [x] Tous les modèles métier visibles dans `/admin/` (traces en lecture seule)

### 5.2 Administration / Secrétariat (`/secretariat`)
- [x] **Boîte tickets entrants** (voir §7 workflow avec aval)
- [x] Courriers entrants/sortants numérotés (`COUR-AAAA-NNNN`, workflow brouillon→envoyé/reçu→traité→archivé, papier à en-tête officiel + cachet `cachet_secretariat` importé en Paramètres, **sans** mention « sortant » sur le document, signature manuscrite après impression, bouton Imprimer/PDF navigateur)
- [x] Décharges (30/09/2026) : registre `DCH-AAAA-NNNN` (provenance, objet, montant optionnel, date de réception, commentaire) + scan uploadé **compressé serveur** (JPEG 1600px q70, poids affiché) ; page `/secretariat/decharges`, suppression super_admin/admin
- [x] Réunions + PV + décisions -> tâches assignées (workflow ci-dessous)
- [x] Archivage global, validation niveau 1 (congés, factures brouillon, contrats)

**Workflow Réunions (backend Django, mails + notifs) :**
Statuts: `Planifiée -> PV en rédaction -> Clôturée`.

1. [ ] Création (`POST /secretariat/reunions/`) -> **convocation auto** : mail à chaque participant (date, heure, lieu + ODJ du moment, via `admin@digicom.ml`) + notif in-app. Toute modification date/lieu/participants renvoie une mise à jour
2. [ ] **Ordre du jour = avant la réunion** : ajoutable uniquement au statut `Planifiée` (au fil de la préparation). Dès le passage en `PV en rédaction` (réunion tenue), l'ODJ est **figé** — il fige ce qui a été convoqué
3. [ ] **PV = après la réunion** : rédigeable uniquement en `PV en rédaction`. **Décisions** actées à ce stade (responsable + échéance obligatoires)
4. [ ] Décision -> **tâche Kanban assignée** (`POST /reunions/:id/decisions/:id/convert/` `{project_id}`), responsable repris comme assigné, lien retour vers la réunion
5. [ ] Clôture (`Clôturée`) -> **diffusion auto du PV** par mail aux participants + verrou total (ODJ, PV, décisions en lecture seule)

### 5.3 Communication (`/com`)
- [x] Vue par client (onglet Com de la Fiche 360°)
- [x] Calendrier éditorial: date, canal (FB, Insta, TikTok, LinkedIn), statut, client lié
- [x] Campagnes: budget, objectifs, visuels, stats
- [x] Bibliothèque médias par client (fichier ou lien externe 0 octet VPS)
- [x] Demandes de validation client (visible côté portal client)

### 5.4 Développement (`/dev`)
- [x] Projets: client FK, type (`site_web`, `app_web`, `app_mobile`, `autre`), statut, deadline, jalons, % auto depuis tâches
- [x] **Suivi transmis au client** (écrit côté agence dans ProjetDetail, section « Suivi client », visible dans `/espace/:slug`) : jalons = grandes étapes de validation convenues (pas les tâches Kanban internes), livrables = fichiers finalisés remis au client
- [x] Kanban tâches/sprints: à faire / en cours / review / done, assigné, temps passé
- [x] Liens repo, envs (prod/staging), notes de déploiement
- [x] Si `type in [site_web, app_web]` -> `PROJECT_KEY` (`digi_pub_xxx`) + snippet tracker `hub.digicom.ml/static/tracker.js` (voir §9)
- [x] Bugs remontés visibles dans l'espace projet

### 5.5 RH (`/rh`)
- [x] Fiches employés liées à `User`, contrats de travail, documents
- [x] Congés/absences (workflow backend — voir détail ci-dessous)
- [x] Recrutement: offres gérées côté site vitrine (webhook -> HUB, voir WEBHOOK-CARRIERE.md), HUB statue : Reçue -> Entretien -> Retenue/Rejetée
- [x] Pointage QR dynamique (05/10/2026, app `rh` : `SitePointage`, `QRToken`, `Pointage`, `Prime`) — voir détail ci-dessous
- [ ] Évaluations annuelles, trombinoscope

**Pointage QR (horaires verrouillés 08h00–17h00, heure serveur `Africa/Bamako`) :**

1. [x] Login (+ 2FA si active) -> `GET /rh/pointage/statut/` : si un pointage est dû **et** heure serveur dans [08h00, 17h30] (17h00 + 30 min de marge sortie pour scanner le départ) -> écran `/pointage` (« Scannez avec votre appareil mobile » + QR dynamique + icône caméra en bas). Hors plage -> login normal, aucun écran.
2. [x] Desktop affiche le QR dynamique (`POST /rh/pointage/qr/` : payload signé HMAC `TimestampSigner`, TTL 60 s, usage unique via `QRToken`, renouvelé toutes les 10 s, aucun bouton de contournement). Le mobile (même compte) vise le QR via la caméra (`html5-qrcode`) -> GPS du mobile + `POST /rh/pointage/scan/`.
3. [x] Vérifications serveur : signature + expiry + anti-rejeu (nonce brûlé) + appartenance employé + distance haversine ≤ `rayon_m` (**150 m** des coordonnées entreprise saisies dans `SitePointage`) + plage 08h00–17h30. Type auto : `arrivee` (retard après 08h00 + 15 min = **08h15**) puis `depart` dès 12h00 (anticipé avant 17h00, normal après). Un pointage/jour/employé.
4. [x] Liste RH `/rh/pointage` (+ entrée sidebar « Pointer » `/pointage` pour tous les internes, ex. départ 17h00) ; tous modèles visibles `/admin/` (pointages/QR en lecture seule).
7. [x] Congé validé couvrant le jour -> login normal, aucun écran (ni QR, ni scan).
8. [x] Scan refusé pour position -> `TentativePointage` conservée (employé, jour, type, GPS, distance) ; section « Scans refusés » dans `/rh/pointage` avec boutons **Valider / Rejeter** (`PATCH /rh/tentatives/:id/valider|rejeter/`, super_admin/admin : ex. intempéries) ; Valider crée le pointage (mêmes règles d'horaires, GPS dispensé).
5. [x] Rapport mensuel auto `GET /rh/pointage/rapport/?mois=` (présents, retards, départs anticipés, congés validés **exclus** des absences et des jours dus, absences vs jours ouvrés lun–ven, heures, score /100 = présence 40 + ponctualité 30 + heures 20 + assiduité 10) + PDF `rapport/pdf/` (charte marine).
6. [x] Employé du mois auto (meilleur score, départage : retards puis heures) + `Prime` créée (montant `SitePointage.prime_montant`, défaut 25 000 F) `validee=False` -> `PATCH /rh/primes/:id/valider/` (chef_rh/admin/super_admin). Page `/rh/rapports`.

**Workflow Congés (backend Django, Celery + mails) :**
Statuts: `en_attente -> valide | refuse` (+ `annule` par le demandeur tant que non validé).

1. [ ] Chaque user connecté (tout rôle/département) a un bouton **"Demander un congé"** dans son espace (`/rh/conges` + rappel dashboard) -> `POST /api/v1/rh/leaves/` `{du, au, motif}` -> congé créé `en_attente`, solde **non** décompté, notif in-app + mail à la RH
2. [ ] La RH reçoit la demande côté `/rh/conges` (file `en_attente` + pastille + toast) et **accepte ou refuse** -> `PATCH /api/v1/rh/leaves/:id/validate/` `{decision, commentaire}` (permission `chef_rh` ou `admin`/`super_admin`, commentaire obligatoire si refus)
3. [ ] Si **validé** : solde congés décompté, statut employé actualisé (`En congé` sur la période), dates visibles des deux côtés — l'employé voit sa demande passer à `Validé` avec les dates dans `Mon espace -> Mes congés`, la RH voit la date dans la fiche employé / trombinoscope / liste congés
4. [ ] Si **refusé** : motif du refus visible côté employé, solde inchangé
5. [ ] **Rappel mail J-3** : tâche Celery Beat quotidienne — tout congé `valide` dont `du = J+3` -> mail auto à l'employé + RH via identité `rh@digicom.ml` (template `conge_rappel_j3`), + notif in-app
6. [ ] Traçabilité : AuditLog (demandeur, valideur, décision, date) sur chaque transition

### 5.6 Juridique (`/juridique`)
- [x] Contrats (client/employé): rédaction depuis modèle, version, signature, PDF
- [x] PDF contrat conforme à l'aperçu (parseur HTML robuste : titres h1-h6, listes, citations, gras/italique, aucune balise brute ; ligne cible · date · statut), bloc signature électronique salariée si signée
- [x] Signature électronique salariée (02/10/2026) : `signature_employe_nom/le/hash` (empreinte du contenu scellée), `POST /juridique/contracts/:id/signer/` réservé au salarié lié (nom + « Lu et approuvé »), `GET /juridique/contracts/mes/` + carte « Mes contrats » dans Profil, notif Chef Juridique + Super Admin, badge dans l'aperçu ; toute modification titre/contenu par le Juridique invalide la signature (à re-signer)
- [ ] Alertes échéances/renouvellements (Celery Beat J-30/J-7 — Beat non actif)
- [x] Litiges: statut, pièces jointes
- [x] Bibliothèque clauses/modèles

### 5.7 Finance (`/finance`)
- [x] Devis -> Facture (brouillon -> validée -> envoyée -> payée/partielle/impayée)
- [x] Génération PDF auto (ReportLab, charte marine + cachet) + numérotation `FACTURE-SLUG-JJ-MM-AAAA-ID`, `RECU-…`
- [x] Reçu auto créé au paiement
- [x] Dépenses par département, paie employés (fiches + cachet, clôture)
- [x] Moyens: espèces, virement, Mobile Money (champ ref transaction)
- [x] Rapports CA (brut/encaissé/dépenses), séries mensuelles
- [ ] Relances auto impayés, export CSV
- [ ] Paiement en ligne (liens `pay.digicom.ml` en attente de l'API de paiement — logique conservée, non branchée)
- [x] Fournisseurs/Achats (30/09/2026, app `fournisseurs`) : fiches `Fournisseur` + bons de commande `BDC-SLUG-AAAA-NNNN` (brouillon→validée→envoyée, lignes) + bons de livraison `BDL-SLUG-AAAA-NNNN` (2 choix : depuis commande avec reprise auto des restes, ou saisie libre ; validation = imputation quantités → partiellement_livrée/livrée) + conversion commande→facture `ACHAT-SLUG-AAAA-NNNN` (reçue→validée→payée/partielle, lien BDC tracé) + paiements avec reçu `RECU-F-SLUG-AAAA-NNNN` ; paiement = sélecteur **Non payée / Acompte / Payée** (c'est Digi Com qui paie, pas de lien de paiement, montant contrôlé ≤ solde, déduit du solde dû) ; références serveur séquentielles (`references.py` + `CompteurReference`, atomique, par année) ; fiche 360° `/finance/fournisseurs/:id` (onglets Commandes/Livraisons/Factures & Reçus, PDF : BDC/BDL/facture/reçu) ; guard `ROLES_FINANCE`, suppression chef_finance/super_admin bloquée si liens

---

## 6. Portail Client (`/espace/:slug/:code`)

Guard `role=client`. Client ne voit que `where client_id = me.client_id`.
URL personnalisée : `/espace` (son portail) et `/espace/:slug/:code` (slug société + code unique
4 chiffres, ex. `/espace/orange-mali/4821`, affiché en fiche 360° à côté du nom + lien copier).
Un client ouvrant une autre adresse est ramené sur la sienne ; `super_admin` prévisualise via slug + code.
`/espace-client` historique redirige vers `/espace`.

- [x] Dashboard: projets en cours + deadline + %, factures impayées, tickets ouverts
- [x] Mes Projets & Services: jalons, livrables téléchargeables, bugs signalés (`BUG-xxx` + statut)
- [x] Mes devis: Valider (converti en facture + notif admin) / Rejeter (signalé refusé + notif admin)
- [x] Mes Factures/Reçus: liste + PDF download
- [ ] Bouton Payer / demander proforma (en attente API de paiement)
- [x] Créer Ticket: choisir projet concerné -> ref auto `TICK-2026-xxxx`
- [x] Valider visuels Com / laisser commentaire projet
- [x] Historique mails reçus du hub

---

## 7. Workflow Tickets + Secrétariat (avec aval)

Endpoints: `/api/v1/tickets/`

Statuts: `nouveau -> qualifie -> en_attente_aval -> approuve -> repondu -> clos` (+ `rejete`)

1. [x] Client POST ticket (projet FK optionnel, catégorie, priorité, message, PJ)
2. [x] Ticket arrive en `nouveau` dans Boîte Secrétariat avec réf projet/client auto
3. [x] Secrétariat qualifie (catégorie, priorité, dept assigné: dev/com/finance/...)
4. [x] Bouton "Demander aval" -> crée `TicketApproval` + notif au Chef dept
5. [x] Chef dept approuve / modifie réponse proposée (commentaire interne séparé du message client)
6. [x] Secrétariat seule clique "Répondre au client" (template mail via identité dept concernée ou admin)
7. [ ] SLA: ex 24h réponse, 72h résolution. Dépassement -> alerte Super Admin + Chef (Beat non actif)
8. [x] Traçabilité: qui a qualifié, qui a donné aval, texte final envoyé (messages internes vs client + historique statuts)

Modèles: `Ticket, TicketMessage (interne vs client flag), TicketApproval`

---

## 8. Mailing multi-expéditeurs depuis chaque espace

Exigence: tout user peut envoyer un mail depuis son espace, avec l'adresse de son département.

Identités:
- Super Admin + Administration -> `admin@digicom.ml`
- Communication -> `com@digicom.ml`
- Développement -> `dev@digicom.ml`
- Finance -> `finance@digicom.ml`
- RH -> `rh@digicom.ml`
- Juridique -> `juridique@digicom.ml`

Implémentation Django (réel au 30/09/2026):
- [x] Modèle `EmailIdentity(department FK unique, smtp_host, smtp_port, smtp_user, smtp_password, from_address, signature, use_tls)` — réglages par département dans `/admin/` ; **connexion dynamique `get_connection()` NON implémentée** : tous les envois partent via le compte SMTP unique du `.env`, seul le `from` affiché varie par département ; `smtp_password` en clair (fernet NON implémenté)
- [x] Envoi en Celery (eager en dev = synchrone, jamais en sync request côté code métier)
- [x] Permission: `peut envoyer via identité de son dept uniquement` (frontend : « Chaque membre écrit via l'adresse de son département »). Super Admin bypass.
- [x] Table `SentMail(from_identity, to, subject, body_html, client FK, ticket FK, project FK, status, error)` -> visible dans Fiche Client onglet Mails
- [x] Templates par usage (éditables `/admin/`) : facture disponible, relance, réponse ticket, validation visuel, bienvenue espace client, reset password, convocation/diffusion réunion, rappel congé
- [ ] Infra: SPF+DKIM+DMARC à valider côté DNS avant prod
- [x] Frontend: page `/mails` (identité de son dept affichée) + bouton "Envoyer mail" dans chaque espace (client/projet/facture/ticket) avec select template + aperçu

---

## 9. Bug Tracker via script.js auto-généré

Uniquement si projet Dév `type=site_web|app_web`.

Génération:
- [x] À la création projet web -> `ProjectTrackerKey(public_key=digi_pub_xxx)` + snippet `hub.digicom.ml/static/tracker.js` affiché avec bouton copier (l'endpoint de report suit le domaine du `src`)
```html
<script src="https://hub.digicom.ml/static/tracker.js" data-key="digi_pub_xxx"></script>
```

`tracker.js` (vanilla, ~3 Ko):
- [x] Auto-capture `window.onerror` + `unhandledrejection`: message, stack (tronquée), page URL, userAgent, viewport
- [x] Widget manuel "Signaler un bug": bouton flottant, description + email optionnel
- [x] POST `POST /api/v1/bugs/report/` {key, message, stack, url, meta, gravite?} avec throttle `bugs` (30/min) ; clé invalide -> 403

Backend `bugtracker`:
- [x] Modèle `BugReport(numero=BUG-YYYY-#### auto, project FK, titre, description, gravité (transmissible, repli `moyenne`), statut: nouveau/confirmé/en_cours/corrigé/rejeté, assigné, meta_json)`
- [x] Visible dans `/dev/projets/:id` onglet Bugs + dans portal client (ses bugs + statut)
- [x] Notif à chaque bug : in-app (cloche) Chef Dév + Super Admin, + Administration et mail `dev@` si critique (30/09/2026)
- [x] Bouton "Convertir en tâche" -> crée Task liée

Sécurité/V1 scope:
- [x] Clé publique exposable, `allowed_origins` stockée par projet (contrôle d'origine non enforced — à durcir)
- [ ] Mention consentement à ajouter côté site client
- [x] V1: erreurs JS + feedback manuel. V2: source-maps, screenshots, perf.

---

## 10. Features transversales obligatoires

- [x] Auth JWT + refresh rotation + 2FA optionnelle + reset password (lien 24 h)
- [ ] AuditLog auto sur create/update/delete sensibles (modèle + admin lecture seule présents, écriture non branchée)
- [x] Notifications in-app (cloche `/notifications/`, tickets + bugs + congés) ; mails : factures/reçus/tickets/réunions/congés via templates ; rappels auto J-3/J+7 et SLA en attente (Beat non actif)
- [x] Push web (02/10/2026, app `push`, logique existante inchangée) : signal `post_save` sur `Notification` → tâche `envoyer_push_async` (VAPID auto-généré en base `VapidConfig`, abonnements `PushSubscription`, 404/410 purgés) ; endpoints `/push/vapid-key/`, `/push/subscribe/`, `/push/test/` ; service worker `push-sw.js` + activation dans Profil (iPhone : ajout écran d'accueil requis)
- [x] Biométrie/passkeys (02/10/2026, app `webauthn`, `webauthn==3.0.1`, additif au mdp) : `PasskeyCredential` (clé publique seule) + `PasskeyChallenge` à usage unique 10 min (multi-workers) ; `POST /auth/webauthn/register/*` (connecté, `PLATFORM` + vérification préférée), `POST /auth/webauthn/login/*` (public, JWT directs ou 202 OTP si TOTP) ; UI Profil (activer/retirer) + bouton Login « Se connecter avec biométrie », fallback mdp toujours présent
- [x] Upload fichiers avec validation extension/taille (images 10 Mo, cachets 2 Mo) + compression serveur des scans de décharges
- [ ] Recherche globale cross-entités (recherche par page + filtres `?search` partout)
- [x] Génération PDF unifiée ReportLab (header Digi Com & Technologies, footer, numérotation, cachets) ; courriers via impression navigateur
- [x] Pagination, filtres `?client_id & ?status & ?search` partout
- [x] Docs API auto via drf-spectacular `/api/docs/`
- [x] Footer = statut API réel (ping `/settings/entreprise/` toutes les 60 s)
- [x] Tous les modèles métier visibles dans `/admin/` (traces en lecture seule)

---

## 11. Modèles de données (résumé)

```
Department(id, nom, slug)
Poste(id, department FK, titre, niveau: chef/membre)
User(id, email, password, role, department FK null, poste FK null, client FK null si role=client, is_active)
Client(id, nom_societe, slug, code, contact, email, phone, adresse, statut, est_interne)
Project(id, client FK, titre, type, statut, deadline, progression%, repo_url, tracker_key)
ProjectTrackerKey(id, project FK, public_key, allowed_origins)
Task(id, project FK, titre, statut, assigné FK User, temps_passe)
Campaign(id, client FK, titre, canal, date_pub, statut, budget)
Invoice(id, client FK, project FK null, numero unique, statut, total, solde, pdf)
Receipt(id, invoice FK, numero unique, montant, moyen, ref_transaction, pdf)
Fournisseur(id, nom_societe, categorie, contact, statut)
BonCommande(id, fournisseur FK, numero BDC-SLUG-AAAA-NNNN, objet, statut, livraison_prevue)
LigneBonCommande(id, commande FK, description, quantite, quantite_livree, montant)
BonLivraison(id, fournisseur FK, commande FK null, numero BDL-SLUG-AAAA-NNNN, statut, date_livraison)
FactureFournisseur(id, fournisseur FK, commande FK null, numero ACHAT-SLUG-AAAA-NNNN, statut, echeance)
PaiementFournisseur(id, facture FK, numero RECU-F-SLUG-AAAA-NNNN, montant, moyen)
CompteurReference(prefixe, annee, dernier)
Ticket(id, numero unique, client FK, project FK null, dept_assigne, statut, priorite)
TicketMessage(id, ticket FK, auteur, is_internal bool, message)
TicketApproval(id, ticket FK, demandeur, valideur, decision, commentaire)
Contract(id, client FK ou employé, type, fichier, date_fin, statut)
Decharge(id, reference DCH-AAAA-NNNN, provenance, objet, montant, date_recue, image compressée, poids_ko)
Leave(id, employé, du, au, statut, valideur)
SitePointage(id, nom, latitude, longitude, rayon_m=150, heure_arrivee=08:00, heure_depart=17:00, tolerance_retard_min=15, prime_montant=25000, actif)
QRToken(id, employe FK, nonce unique, expire_le, utilise)
Pointage(id, employe FK, date unique/employe, heure_arrivee, statut_arrivee, heure_depart, statut_depart, lat/lng, distance_m)
Prime(id, employe FK, mois AAAA-MM unique/employe, montant, motif, validee)
TentativePointage(id, employe FK, date, type arrivee/depart, lat/lng, distance_m, statut en_attente/validee/rejetee, valideur)
Candidature(id, offre_reference, offre_titre, nom, email, source site/manuelle, statut)
EmailIdentity(id, department FK unique, from_address, smtp_* (connexion dynamique NON branchée))
SentMail(id, identity FK, to, subject, client FK null, ...)
BugReport(id, numero unique, project FK, gravité, statut, meta_json)
SiteSettings(singleton, raison, cachet_finance/juridique/secretariat, signatures)
AuditLog, Notification
```

---

## 12. Endpoints API DRF v1 (à implémenter)

```
GET/POST /api/v1/auth/login/ refresh/ me/ + otp/ (setup/confirm/verify/disable/status) + webauthn/ (register/begin|complete, login/begin|complete, credentials/) + password/ (reset, reset/confirm, change)
/api/v1/users/ (+ /mini/, /:id/reset-password/, /:id/send-access/) departments/ postes/
/api/v1/clients/ :id/overview/
/api/v1/projects/ :id/tasks/ :id/bugs/ :id/milestones/ + /tasks/ /milestones/ /tracker-keys/ /bugs/ + :id/convertir/
/api/v1/com/campaigns/ calendar/ medias/ communiques/
/api/v1/finance/quotes/ (:id/valider/ :id/rejeter/) invoices/ (:id/pdf/ :id/payer/ :id/envoyer/) receipts/ (:id/pdf/) expenses/ paie/ (:id/ajouter_ligne/, lignes, cloturer, cachet)
/api/v1/fournisseurs/ :id/overview/ + fournisseurs-factures/ (valider/payer/pdf) + fournisseurs-paiements/ (pdf) + fournisseurs-commandes/ (valider/envoyer/convertir/pdf) + fournisseurs-livraisons/ (valider/pdf)
/api/v1/rh/employees/ leaves/ leaves/:id/validate/ recruitments/ + candidatures/ (webhook public X-Hub-Token, throttle) + pointage/statut/ pointage/qr/ pointage/scan/ pointages/ pointage/rapport/ (+ /pdf/) primes/ (:id/valider/) tentatives/ (:id/valider|rejeter/)
/api/v1/juridique/contracts/ (:id/pdf/) disputes/
/api/v1/tickets/ (:id/qualify/ :id/request-approval/ :id/approve/ :id/reply/ :id/messages/ :id/approvals/ :id/clore/ :id/rouvrir/ :id/rejeter/) approvals/
/api/v1/secretariat/courriers/ reunions/ (:id/decider/, decisions/:id/convertir/) decharges/
/api/v1/mailing/send/ sent/ templates/ + /settings/entreprise/ (GET/PATCH super_admin)
/api/v1/bugs/report/ (public, throttled) + /bugs/ /tracker-keys/
/api/v1/notifications/ + push/ (vapid-key/, subscribe/, test/) + /chat/conversations/ /chat/messages/?avec= /chat/send/ /chat/lus/
/api/v1/dashboard/super-admin/ /dashboard/perso/ /dashboard/series/ + /portal/dashboard/ (client)
/api/docs/ (OpenAPI) + /static/tracker.js + /admin/ (tous modèles, traces lecture seule)
```

---

## 13. Roadmap MVP (état 30/09/2026)

**Phase 1 - Base :**
- [x] Auth + Rôles + Departments/Postes + CRUD Clients + Fiche 360°
- [x] Projets Dév + Tâches Kanban + Portal client

**Phase 2 - Argent + Support :**
- [x] Finance devis/factures/reçus PDF + envoi mail + visible client (+ Fournisseurs/Achats au-delà du MVP)
- [x] Tickets workflow Secrétariat + aval + mailing multi-identités (connexion dynamique SMTP exclue)

**Phase 3 - Complet :**
- [x] RH + Juridique + Com calendrier/campagnes + Bug tracker.js V1 + KPI + notifs
- [ ] Relances/SLA/échéances auto (Celery Beat non actif), évaluations + trombinoscope, export CSV, recherche globale, AuditLog auto

**Après mise en ligne :** API de paiement (liens `pay.digicom.ml`), SMTP dynamique par identité + fernet, SPF/DKIM/DMARC, durcissement origine tracker, mention consentement trackers clients.

---

## 14. Conventions

- Numérotation réelle: `FACTURE/DEVIS-SLUG-JJ-MM-AAAA-ID`, `RECU-…`, `TICK-AAAA-NNNN`, `BUG-AAAA-NNNN`, `BDC/BDL/ACHAT/RECU-F-SLUG-AAAA-NNNN` (compteur atomique/an), `COUR-AAAA-NNNN`, `DCH-AAAA-NNNN`
- Langue UI: FR. Dates: `DD/MM/YYYY`. Devise: XOF (F CFA)
- Branches: `main` (déploiement direct). Commits conventionnels.
- Ne jamais exposer clé SMTP ou `private_key` tracker au frontend. `.env` jamais commité (`.gitignore`).

---

## 15. Mise en ligne `hub.digicom.ml` (01/10/2026)

- Domaine unique : front React + API `/api/v1/` + `/static/tracker.js` + `/admin/` derrière nginx (TLS), proxy vers gunicorn + build Vite servi en statique
- `backend/.env` (transfert **scp** chiffré, jamais git/mail) : `DEBUG=0`, `ALLOWED_HOSTS=hub.digicom.ml`, `CORS=https://hub.digicom.ml`, `FRONTEND_URL=https://hub.digicom.ml`, SMTP système (`digicom.ml:465`), `CAREER_WEBHOOK_TOKEN` = même valeur que `HUB_WEBHOOK_TOKEN` côté site vitrine, droits `600 www-data`
- `frontend/.env` de build : `VITE_API_URL=https://hub.digicom.ml/api/v1` au `npm run build` de prod
- Base : `migrate` + seeds dans l'ordre (`seed_phase1` départements + superuser, `seed_users` 9 comptes, `seed_projets`, `seed_phase23` identités mail) ; sauvegardes : `db.sqlite3` + `media/`
- Webhook Carrière : tester `POST /api/v1/rh/candidatures/` au curl (201 puis `doublon`), puis dépôt réel → badge « Site web » dans `/rh/recrutement` ; retry : action admin + commande `renvoyer_candidatures` (cron 15 min)
- Premier lancement **sans** paiement en ligne (logique conservée, non branchée)

---
*Fin SPEC v1.1 (30/09/2026) - Mettre à jour ce fichier à chaque décision structurante.*
