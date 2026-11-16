# Sprint Change Proposal — Réorientation de l'Epic 8 (infrastructure VPS)

- **Date** : 2026-11-15
- **Auteur** : Aurélien (avec l'agent, workflow `bmad-correct-course`, mode batch)
- **Portée** : Modérée (réorganisation du backlog de l'Epic 8 + mise à jour de l'architecture)
- **Statut** : Approuvé par Aurélien le 2026-11-15

---

## 1. Résumé du problème

L'Epic 8 (« Migration VPS (Production) ») a été écrite en avril 2026 avec trois hypothèses :
le staging reste sur Render, la production part sur un VPS Hetzner en Nginx + PM2 + Certbot,
et le développement se fait sur le PC.

Trois de ces hypothèses ne tiennent plus :

1. **Le développement passe sur un VPS** (serveur `vmi3733843`, joint depuis le PC par Tailscale). Les secrets sont gérés par **Doppler**, pas par un `.env`.
2. **Le staging quitte Render** pour un **autre VPS**, public sur **`anta.peraha.com`**. Render Free Tier (512 Mo, 0,1 vCPU, mise en veille, keep-alive cron-job.org) bride les tests (upload 110 Mo, lecteur PDF).
3. **La production passe en Docker Compose + Caddy** (TLS automatique) au lieu de Nginx + PM2 + Certbot. Staging et prod utilisent la même image et le même fichier Compose, ce qui fait du staging une vraie répétition de la prod.

Aucune story 8.x n'est démarrée : le changement ne jette aucun travail.

**Contraintes décidées par le product owner (2026-11-15)** :
- Dev et staging partagent la **même base PostgreSQL Supabase**.
- Stockage en **parité exacte** : le même Cloudflare R2, aucun service ajouté (ni MinIO ni Garage).
- E-mails : **Mailgun** (`mg.anta.peraha.com`), déjà en place depuis la Story 1.4 (`config/mail.ts`, Resend en secours). Aucun outil ajouté (pas de Mailpit).
- Secrets : Doppler, avec un projet `anta` et les configs `dev`, `stg`, puis `prd`.

## 2. Analyse d'impact

### Epics
| Epic | Impact |
|---|---|
| 1–7 | Aucun (code applicatif inchangé) |
| 8 | **Réécrite** : 3 stories → 6 stories, le périmètre s'étend au dev et au staging |
| Phase 2 (FR44–FR61, à découper) | Aucun blocage. Profite d'un staging stable pour les recettes |

### Artefacts
| Artefact | Changement |
|---|---|
| `epics.md` | Epic 8 réécrite (section 4.1) |
| `architecture.md` §6 « Infrastructure et Déploiement » | Render → VPS staging ; Nginx/PM2/Certbot → Docker Compose + Caddy ; Doppler ; environnement de dev VPS |
| `architecture.md` arborescence (`.github/workflows/deploy-*.yml`) et §CI/CD | 3 workflows sélectifs → 1 workflow de build d'image + déploiement par environnement |
| `prd.md` | Aucun (aucune exigence ne cite Render ni Nginx) |
| UX | Aucun |
| `render.yaml` | Supprimé en Story 8.5 |
| `CLAUDE.local.md` (dépôt, non suivi) | À mettre à jour : il interdit aujourd'hui de se connecter aux services distants depuis le VPS |

### Risques techniques introduits par les décisions

**R1 — Base partagée dev/staging (risque principal).** Une migration lancée depuis une branche de dev s'applique tout de suite à la base que le staging utilise. Un `migration:rollback` en dev supprime des colonnes encore lues par le staging. Le staging lance `migration:run --force` à chaque démarrage.
Règles proposées, à écrire dans `CLAUDE.local.md` et dans la Story 8.1 :
- Interdit sur la base partagée : `migration:rollback`, `migration:fresh`, `migration:reset`, `db:wipe`, et les seeders destructifs.
- Migrations rétrocompatibles uniquement (expand/contract) : on ajoute d'abord, on supprime dans une release ultérieure.
- `migration:run` depuis le dev seulement pour une migration destinée à être mergée sur `development`.
- Les tests (`node ace test`) ne tournent jamais contre Supabase. Ils utilisent un Postgres local jetable, comme la CI (`anta_test`). C'est un outil de test, pas un service de l'application : la parité est respectée.

**R2 — Effets réels du dev.** Avec Mailgun et R2 partagés, le dev envoie de vrais e-mails et écrit dans le vrai bucket. Le `ViewTracker` gonfle les statistiques. Ces effets sont acceptés au nom de la parité. Mitigation : `APP_URL` propre à chaque environnement, pour que les liens des e-mails pointent vers le bon hôte.

**R3 — HMR de Vite derrière `tailscale serve`.** Le websocket HMR doit traverser le proxy HTTPS. Cela demande peut-être `hmr.clientPort` ou `hmr.host` dans `vite.config.ts`. À valider dans la Story 8.1.

**R4 — Accès au VPS de staging et au DNS.** Ils dépendent d'éléments que le product owner doit fournir (section 5).

## 3. Approche recommandée

**Ajustement direct** : on réécrit l'Epic 8 sans rollback et sans réduire le MVP.

- **Pourquoi** : aucune story 8.x n'est commencée. Le nouveau découpage suit l'ordre réel des besoins : dev d'abord, ce qui débloque le travail quotidien, puis staging, puis prod.
- **Effort** : 8.1 ≈ 0,5 j ; 8.2 ≈ 1 j ; 8.3 ≈ 0,5–1 j ; 8.4 ≈ 1 j ; 8.5 ≈ 0,25 j ; 8.6 ≈ 1 j, plus le DNS de production.
- **Risque** : faible à moyen. R1 est le seul risque structurel et il est encadré par des règles.
- **Calendrier** : 8.1 à 8.5 avancent en parallèle de la planification Phase 2 (UX → architecture → epics). L'ordre 2026-06-02 (Epic 6 → 7 → mise en ligne → Epic 8) devient : **8.1–8.5 maintenant**, **8.6 = mise en ligne**.

## 4. Propositions de modification détaillées

### 4.1 `epics.md` — Epic 8

**OLD** (intégral, résumé ici) :

> ## Epic 8 : Migration VPS (Production)
> L'application est migrée de Render vers un VPS autonome avec Nginx, PM2, Let's Encrypt et un CI/CD sélectif par chemin […]
> - **Story 8.1 : Provisionnement VPS et configuration serveur** — Hetzner CX21, Nginx reverse proxy, PM2 + `pm2-logrotate`, Certbot, `ecosystem.config.js`, `migration:run --force` sur Supabase.
> - **Story 8.2 : CI/CD sélectif et workflow de production** — `deploy-public.yml`, `deploy-admin.yml`, `deploy-full.yml` déclenchés par chemin depuis `master` ; flux story → `development` → `staging` (Render) → `master` (VPS) ; gate `node ace test`.
> - **Story 8.3 : Décommissionnement Render** — suppression du service, arrêt de cron-job.org, DNS vers le VPS, renouvellement Let's Encrypt.

**NEW** :

```markdown
## Epic 8 : Infrastructure VPS (dev, staging, production)

Le développement, le staging et la production quittent le PC et Render pour des VPS maîtrisés :
dev sur VPS via Tailscale, staging public sur `anta.peraha.com`, production en Docker Compose + Caddy,
secrets centralisés dans Doppler, mêmes services externes partout (Supabase, R2, Mailgun).

### Story 8.1 : Environnement de développement sur VPS (Tailscale + Doppler)

En tant que développeur,
Je veux lancer Anta en mode dev sur le VPS de développement et l'ouvrir depuis mon PC via Tailscale,
Afin de développer sans dépendre de mon poste local ni d'un fichier `.env`.

**Acceptance Criteria:**

**Given** un projet Doppler `anta` avec une config `dev` contenant toutes les variables de `.env.example`
**When** `doppler run -- npm run dev` est exécuté dans le dépôt du VPS (`PORT=3333`, `HOST=127.0.0.1`)
**Then** l'application démarre sans fichier `.env` sur disque
**And** aucun secret n'est écrit dans le dépôt ni dans les fichiers du workspace

**Given** `tailscale serve` expose le port 3333 sur un port HTTPS libre du tailnet (hors 443, 8443 et 10000, déjà pris)
**When** j'ouvre l'URL `https://vmi3733843.tail39fe0e.ts.net:<port>` depuis le PC
**Then** le site public et l'admin fonctionnent
**And** le HMR de Vite se recharge à travers le proxy (`vite.config.ts` ajusté si nécessaire)
**And** l'URL n'est pas joignable hors du tailnet

**Given** la base Supabase est partagée avec le staging
**When** je travaille en dev
**Then** les règles « base partagée » sont documentées dans `CLAUDE.local.md` et dans `docs/` : pas de rollback/fresh/reset/wipe, migrations rétrocompatibles uniquement
**And** `node ace test` tourne contre un Postgres local jetable (Docker, base `anta_test`, mêmes valeurs que la CI), jamais contre Supabase

### Story 8.2 : Conteneurisation de l'application (image + Compose + Caddy)

En tant que développeur,
Je veux une image Docker de production et un fichier Compose avec Caddy,
Afin que staging et production exécutent exactement le même artefact.

**Acceptance Criteria:**

**Given** un `Dockerfile` multi-stage (Node 22 : build `node ace build`, puis image runtime avec `npm ci --omit=dev` dans `build/`)
**When** l'image est construite
**Then** elle démarre avec `node ace migration:run --force && node bin/server.js` et écoute sur `PORT`
**And** elle tourne avec un utilisateur non-root

**Given** un `compose.yaml` (services `app` et `caddy`) et un `Caddyfile` paramétré par domaine
**When** `doppler run -- docker compose up -d` est exécuté sur un hôte
**Then** Caddy sert l'app en HTTPS avec un certificat Let's Encrypt automatique et redirige HTTP → HTTPS (NFR4)
**And** la limite de corps de requête accepte les uploads de 110 Mo (parité avec `bodyparser`)
**And** les logs des conteneurs sont plafonnés (driver `json-file`, `max-size`/`max-file`)

### Story 8.3 : Provisionnement du VPS de staging (`anta.peraha.com`)

En tant que développeur,
Je veux un VPS de staging dédié et public,
Afin de tester et faire la démo de l'application dans des conditions de production.

**Acceptance Criteria:**

**Given** un VPS de staging distinct du VPS de développement, accessible en SSH par clé
**When** il est provisionné (Docker + plugin Compose, pare-feu ouvrant uniquement 22/80/443, mises à jour de sécurité automatiques)
**Then** il est prêt à recevoir l'image de la Story 8.2

**Given** l'enregistrement DNS `anta.peraha.com` pointe vers l'IP du VPS de staging
**When** la stack Compose est démarrée avec la config Doppler `stg` (token de service stocké sur le VPS, hors dépôt)
**Then** `https://anta.peraha.com` sert l'application avec un certificat valide
**And** elle utilise la même base Supabase, le même bucket R2 et Mailgun
**And** `APP_URL=https://anta.peraha.com`

### Story 8.4 : CI/CD de déploiement du staging

En tant que développeur,
Je veux qu'un push sur la branche `staging` déploie automatiquement le VPS de staging,
Afin de conserver le flux actuel (PR `development → staging`) sans Render.

**Acceptance Criteria:**

**Given** une PR `development → staging` est mergée
**When** le workflow `deploy-staging.yml` se déclenche
**Then** les tests (`node ace test`, Postgres de service CI) passent avant tout déploiement (gate)
**And** la suite fonctionnelle est réparée en CI et le `continue-on-error` du step `Run functional tests` de `ci.yml` est retiré (voir `deferred-work.md`, « TICKET — Suite fonctionnelle incompatible avec la CI »), sinon le gate ne couvre que les tests unitaires
**And** l'image est construite et poussée sur GHCR, taggée avec le SHA du commit
**And** le VPS de staging tire l'image et redémarre la stack via SSH (clé de déploiement dédiée, secrets GitHub)
**And** un health check HTTP sur `https://anta.peraha.com` valide le déploiement ; en cas d'échec le workflow est rouge et l'image précédente reste relançable par son tag

### Story 8.5 : Décommissionnement de Render

En tant que développeur,
Je veux supprimer l'environnement Render,
Afin que le VPS de staging soit l'unique staging et que Render ne coûte ni ne trompe plus personne.

**Acceptance Criteria:**

**Given** le staging VPS est validé (Stories 8.3 et 8.4)
**When** le décommissionnement est confirmé
**Then** le service Render `anta-staging` est supprimé et le keep-alive cron-job.org désactivé
**And** `render.yaml` est retiré du dépôt et la documentation (README, `docs/`, skill de déploiement) mise à jour
**And** toute référence à `anta-staging.onrender.com` (liens, `APP_URL`, mémoire projet) est remplacée par `https://anta.peraha.com`

### Story 8.6 : Mise en production sur VPS

En tant que développeur,
Je veux déployer la production sur un VPS avec la même stack que le staging,
Afin que l'application soit en ligne sur un serveur maîtrisé (NFR4, NFR13).

**Acceptance Criteria:**

**Given** un VPS de production provisionné comme en Story 8.3 et le domaine de production configuré
**When** une PR `staging → master` est mergée
**Then** `deploy-production.yml` promeut l'image déjà validée en staging (même tag), sans rebuild
**And** la config Doppler `prd` fournit les variables
**And** le site est accessible en HTTPS sur le domaine de production, avec un comportement identique au staging
```

**Justification** : le découpage suit les besoins réels (dev d'abord, ensuite staging, prod en dernier). Les trois workflows sélectifs par chemin (`deploy-public/admin/full.yml`) disparaissent : avec une image Docker, l'app est reconstruite entièrement de toute façon, et promouvoir la même image du staging vers la prod est plus sûr que de rebuilder.

### 4.2 `architecture.md` — §6 « Infrastructure et Déploiement »

**OLD** : « Phase initiale — Dev/Démo (Render) » (Render Free Tier, auto-deploy `staging`, keep-alive cron-job.org) + « Phase finale — Production (VPS) » (Hetzner CX21, Nginx, PM2 + `pm2-logrotate`, Certbot, GitHub Actions depuis `master`).

**NEW** : un tableau par environnement :

| | Dev | Staging | Production |
|---|---|---|---|
| Hôte | VPS dev (`vmi3733843`) | VPS dédié | VPS dédié |
| Accès | Tailscale (`tailscale serve`, tailnet seulement) | Public `anta.peraha.com` | Domaine de prod (à définir) |
| Exécution | `doppler run -- npm run dev` | Docker Compose (`app` + `caddy`) | Identique au staging |
| TLS | Tailscale | Caddy (Let's Encrypt auto) | Caddy |
| Secrets | Doppler `anta/dev` | Doppler `anta/stg` | Doppler `anta/prd` |
| Base | Supabase (partagée dev/stg) | Supabase (partagée dev/stg) | Supabase (prod) |
| Fichiers / e-mail | R2 / Mailgun | R2 / Mailgun | R2 / Mailgun |
| Déploiement | — | push `staging` → GHCR → SSH | merge `master` → promotion de l'image |

Plus la sous-section « Règles base partagée » (R1). La stratégie de branches reste la même, seule la ligne `staging` change : « connectée au VPS de staging ».

### 4.3 `architecture.md` — arborescence et pipeline CI/CD

**OLD** : `deploy-public.yml` / `deploy-admin.yml` / `deploy-full.yml` (build partiel → rsync → `pm2 reload/restart`).
**NEW** : `deploy-staging.yml` (tests → build image → GHCR → SSH `docker compose pull && up -d` → health check) et `deploy-production.yml` (promotion du tag validé). Ajouter `Dockerfile`, `compose.yaml`, `Caddyfile` à l'arborescence.

### 4.4 `CLAUDE.local.md` (dépôt, non suivi)

**OLD** : « Aucun secret n'est configuré ici : pas de `.env` […] Les cibles distantes du `.env` du PC ne sont pas confirmées comme dédiées au dev : ne pas s'y connecter. »
**NEW** : « Secrets via Doppler (`doppler run -- …`, config `anta/dev`), jamais de `.env` sur disque. La base Supabase est partagée avec le staging : interdits `migration:rollback|fresh|reset`, `db:wipe` et les seeders destructifs ; migrations rétrocompatibles seulement ; `node ace test` uniquement contre le Postgres local `anta_test`. »

## 5. Handoff

- **Classification** : **Modérée**. On réorganise le backlog de l'Epic 8 et on met l'architecture à jour, sans replanification du produit.
- **Destinataires** :
  - SM : met à jour `epics.md` et crée les fichiers de stories 8.1 à 8.6 (`bmad-create-story`).
  - Architecte : applique les modifications 4.2 et 4.3 à `architecture.md`.
  - Dev : implémente, en commençant par la Story 8.1.
- **À fournir par le product owner** :
  1. Fournisseur et accès SSH du VPS de staging.
  2. Où se gère le DNS de `peraha.com`, pour l'enregistrement `anta`.
  3. Accès Doppler sur le VPS de dev : `doppler login` interactif, ou un token de service ajouté dans Settings → Keys.
  4. Plus tard : le domaine de production.
- **Critères de succès** :
  - Dev joignable via Tailscale avec HMR, zéro `.env`.
  - `https://anta.peraha.com` déployé automatiquement depuis `staging` avec un gate de tests.
  - Render supprimé.
  - Prod déployée par promotion de l'image du staging.
