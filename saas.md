# HUB DIGI → SaaS multi-entreprises
Plan d'implémentation — à démarrer demain inchallah.

État actuel : hub mono-entreprise (Digi Com), SQLite, Celery eager (Beat inactif),
comptes créés à la main, `.env` en scp, paiement en attente (`pay.digicom.ml`).
Réf : FEATURES.txt v1.4, SPECIFICATIONS.md, docker-compose.yml, Dockerfile.

Principes : migrations additives, backend jamais confiant envers le frontend,
tests à chaque phase, `main` déployée en continu, chaque phase livrable seule.

---

## Phase 0 — Préparation (jour 1 matin)

- [ ] Geler le périmètre v1.4 : tag git `v1.4-mono` (retour arrière possible).
- [ ] Créer la branche `feat/saas` (tout le chantier SaaS passe par là, merge à la fin).
- [ ] Sauvegarde VPS : `db.sqlite3` + `media/` + `backend/.env` (copie datée hors Docker).
- [ ] Choisir le modèle tenant : **recommandé = 1 base partagée, tout scopé par `organisation_id`**
  (simple à opérer ; schéma-par-tenant refusé : trop lourd sous SQLite puis Postgres).
- [ ] Choisir l'adressage : **recommandé = sous-domaine par entreprise**
  (`acme.hub.digicom.ml`, wildcard DNS + nginx), repli = path `/t/:slug`.
- [ ] Ouvrir les comptes : passerelle Mobile Money/carte (finaliser `pay.digicom.ml`),
  SMTP mutualisé, bucket sauvegardes.

## Phase 1 — Socle multi-tenant (le gros morceau)

- [ ] Modèle `Organisation` : nom, slug/sous-domaine unique, logo, couleur, plan, statut
  (`essai | active | suspendue`), quotas (users, projets, stockage Mo), `cree_le`.
- [ ] Ajouter `organisation FK` (nullable d'abord) sur : User, Client, Project, Task, Sprint,
  Invoice, Devis, Ticket, Courrier, Campagne, Employee, SentMail, BugReport, Contrat.
- [ ] Migration de données : tout l'existant → organisation « Digi Com » (slug `digicom`).
- [ ] Rendre la FK non-nullable + index `(organisation_id, ...)` sur les tables chaudes.
- [ ] Middleware tenant : résout l'organisation depuis le sous-domaine (ou `X-Org` / path),
  404 si inconnue ou suspendue ; injecte `request.organisation`.
- [ ] Durcir **tous** les querysets : filtre `organisation` systématique (jamais de requête
  brute — même règle que la recherche globale) ; JWT enrichi (`org_id`) ; tests d'isolation
  (org A ne voit jamais org B : liste, détail, recherche, fichiers `media/`).
- [ ] Fichiers : `media/org_<id>/...` + garde (pas d'accès croisé par URL devinée).
- [ ] Super Admin global (nous) vs Admin d'organisation (client) : rôles séparés ;
  `super_admin` actuel → scoper, nouveau `owner` par organisation.
- [ ] Tests : isolation inter-tenants sur chaque module + CI verte.

## Phase 2 — Base de données & file de tâches (prod SaaS)

- [ ] Migrer SQLite → **PostgreSQL** (dump + import, `db.sqlite3` gardée en repli).
  Volumes Docker : `pgdata` + `media` persistants.
- [ ] **Redis** + Celery worker + **Beat actif** : relances impayés, SLA tickets, rappels J-3,
  échéances contrats, essais qui expirent (tout ce qui est « Beat non actif » en v1.4).
- [ ] Sauvegardes auto quotidiennes Postgres + `media/` (test de restauration mensuel).
- [ ] Quotas appliqués : blocage création au-delà du plan (message + upgrade proposé).

## Phase 3 — Onboarding self-service (inscription en 5 min)

- [ ] Page publique `/inscription` : nom entreprise, nom, e-mail pro, mot de passe, téléphone.
- [ ] Provisioning auto : organisation + sous-domaine + compte `owner` + jeu de démo
  (1 client, 1 projet, 1 facture modèle) + mail de bienvenue (template).
- [ ] Vérification e-mail (lien 24 h, même mécanisme que reset password) avant activation.
- [ ] Essai gratuit 14 jours (statut `essai`, bandeau J-3/J-1, bascule `suspendue` sans paiement).
- [ ] Invitation d'équipe par l'owner (lien d'invitation, rôle + département à l'arrivée).
- [ ] Rate-limit + captcha sur l'inscription (anti-spam), e-mails jetables refusés.

## Phase 4 — Facturation & plans

- [ ] Plans : ex. Solo (1–3 users) / Pro (jusqu'à 20) / Business (illimité + white-label).
  Matrice plan × features (sprints, GitHub, API, stockage) dans `src/data/plans.js` + garde backend.
- [ ] Brancher `pay.digicom.ml` : souscription, renouvellement mensuel/annuel, facture
  d'abonnement PDF auto (ReportLab, comme les factures clients).
- [ ] Webhook paiement → active/suspend l'organisation ; page `/facturation` (plan, factures,
  bouton mettre à jour / résilier) ; e-mails impayé J+3/J+7 + suspension J+15.
- [ ] Essaimage : un owner = une organisation (pas de compte multi-org en V1).

## Phase 5 — White-label & portail

- [ ] Par organisation : logo, couleur primaire, nom affiché (login, sidebar, PDF, mails).
- [ ] Portail client (`/espace`) aux couleurs de l'organisation émettrice.
- [ ] Domaine personnalisé V2 seulement (pas en V1 : juste le sous-domaine).

## Phase 6 — Sécurité & conformité (avant le 1er client payant)

- [ ] Secrets chiffrés (fernet : `smtp_password`, secrets webhook) — plus rien en clair.
- [ ] AuditLog auto branché (create/update/delete/validate + scope organisation).
- [ ] 2FA imposable par organisation ; politique mot de passe (12 car. min pour owners).
- [ ] Durcissement tracker (`allowed_origins` enforced) + consentement cookies côté portail.
- [ ] SPF + DKIM + DMARC sur `digicom.ml` (sinon Gmail = spam).
- [ ] Rate-limits resserrés (login, webhooks, search), en-têtes sécu nginx, `DEBUG=0` vérifié.
- [ ] CGU / CGV / confidentialité / mentions légales publiées + case acceptée à l'inscription.
- [ ] Contrat de sous-traitance données (modèle) + registre des traitements minimal.

## Phase 7 — Ops & support (semaine de lancement)

- [ ] Monitoring : conteneurs, disque, erreurs 5xx, file Celery, certificats TLS (alerte avant expire).
- [ ] Page statut publique (ex. `statut.digicom.ml`) + e-mail d'incident type.
- [ ] Support : file tickets dédiée « SaaS » + doc utilisateur (prise en main 10 min, FAQ).
- [ ] Runbook : restaurer un backup, suspendre/réactiver un tenant, tourner les secrets.
- [ ] 2–3 entreprises pilotes gratuites (1 mois) → retours → correctifs → ouverture payante.

## Après V1 (ne pas faire maintenant)

- Domaine personnalisé par tenant, SSO (Google/Microsoft), API publique + tokens,
  marketplace de modules, multi-langue (EN), applications mobiles, Slack (toujours hors périmètre).

---

## Ordre d'exécution demain

1. Tag `v1.4-mono` + branche `feat/saas` + sauvegarde VPS (Phase 0).
2. Modèle `Organisation` + FK + migration de données (Phase 1, premier tiers).
3. Middleware tenant + scoping d'un module pilote (Clients) + tests d'isolation.
4. Étendre aux autres modules, puis Phase 2.

*Fin saas.md — inchallah on attaque demain.*
