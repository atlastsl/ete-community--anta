# Rétrospective — Déploiement Anta sur Render

**Date :** 2026-06-01
**Contexte :** Premier déploiement d'Anta (AdonisJS 6 + Inertia/React + Tuyau) sur Render (environnement staging/démo), branche `staging`.
**Résultat :** ✅ Service live sur https://anta-staging.onrender.com après une série de blocages enchaînés.

Ce document recense **chaque problème rencontré**, sa **cause racine** et le **fix appliqué**, pour ne pas les reproduire et pour préparer la migration VPS (Epic 8).

---

## Vue d'ensemble

Le déploiement a buté sur **3 catégories** de problèmes :

1. **Connexion base de données** (Supabase pooler) — en amont, lors des tests locaux
2. **Configuration Git / GitHub** — push et protections de branches
3. **Build & runtime Render** — la séquence principale (4 blocages successifs)
4. **DNS / Mailgun** — conflit CNAME

---

## 1. Connexion base de données (Supabase pooler)

### 1.1 — Échec d'authentification PostgreSQL

- **Symptôme :** `error: password authentication failed for user "postgres"`
- **Cause racine :** plusieurs facteurs cumulés :
  - Mauvais credentials au départ (confusion entre deux projets Supabase : `xlnapruogryelteuorxx` en `ca-central-1` vs le bon `mwodekowvpiamdodtdlj` en `us-east-1`).
  - La "Connection string" du dashboard Supabase affiche `[YOUR-PASSWORD]` comme **placeholder littéral** — le vrai mot de passe n'est montré **qu'une seule fois** au moment du reset.
  - Délai de propagation du nouveau mot de passe au pooler (~30 s à 5 min).
- **Fix :** reset du mot de passe dans le dashboard, copie immédiate, attente de propagation. Bon projet : `mwodekowvpiamdodtdlj`, host `aws-1-us-east-1.pooler.supabase.com`, user `postgres.mwodekowvpiamdodtdlj`.

### 1.2 — Circuit breaker du pooler

- **Symptôme :** `error: (ECIRCUITBREAKER) too many authentication failures, new connections are temporarily blocked`
- **Cause racine :** trop de tentatives d'auth échouées rapprochées → blocage temporaire (5-15 min) par le pooler Supabase.
- **Fix :** ne pas marteler les tentatives. Attendre que le blocage se lève, puis retenter une seule fois.

### 1.3 — SSL requis par le pooler

- **Symptôme :** connexion refusée sans SSL ; mais aussi risque de **casser le CI** (PostgreSQL container sans SSL).
- **Cause racine :** le pooler Supabase exige TLS. La config initiale forçait `ssl: { rejectUnauthorized: false }` **inconditionnellement** — ce qui aurait fait échouer le CI (Postgres container sans SSL → `The server does not support SSL connections`).
- **Fix :** gating via variable d'environnement dans `config/database.ts` :
  ```ts
  ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : false
  ```
  `DB_SSL=true` sur Render/Supabase, absent (= false) en CI/local sans SSL.

---

## 2. Configuration Git / GitHub

### 2.1 — Échec du push (certificat SSL)

- **Symptôme :** `fatal: unable to access ... SSL certificate problem: unable to get local issuer certificate`
- **Cause racine :** réseau d'entreprise (ULAVAL) avec inspection SSL — le bundle de CA de Git ne reconnaît pas le certificat du proxy.
- **Fix :** utiliser le backend SSL natif de Windows (magasin de certificats système, qui contient les CA d'entreprise) :
  ```bash
  git config http.sslBackend schannel
  ```

### 2.2 — Protections de branches impossibles (repo privé)

- **Symptôme :** `HTTP 403 — Upgrade to GitHub Pro or make this repository public to enable this feature.`
- **Cause racine :** les règles de protection de branches sur repo **privé** nécessitent GitHub Pro/Team.
- **Fix :** repo rendu **public** (après scan de sécurité confirmant zéro secret dans l'historique — `.env` jamais commité, clés absentes).

### 2.3 — Deadlock de self-approval (dev solo)

- **Symptôme :** une protection "1 review obligatoire" sur `master` bloquerait définitivement un dev solo (impossible d'approuver sa propre PR).
- **Cause racine :** GitHub interdit d'approuver sa propre Pull Request.
- **Fix :** protection en **PR obligatoire sans review** (`required_approving_review_count: 0`) + gate CI `Lint & Test`. À passer à 1 review le jour où il y a des collaborateurs.

---

## 3. Build & runtime Render — la séquence principale

> ⚠️ **Leçon transversale (la plus importante) :** Render **ne re-synchronise PAS `render.yaml`** après la création du service. Les `buildCommand`, `startCommand` et variables d'env sont **copiés une fois** dans les réglages du service ; les modifier dans le fichier versionné n'a **aucun effet** tant qu'on ne les édite pas **manuellement dans le dashboard** (le "Manual Sync" du Blueprint ne suffit pas non plus). **Seuls les fichiers du repo lus par les outils** (`.npmrc`, `.adonisjs/`) sont pris en compte automatiquement.

### 3.1 — `@poppinss/ts-exec` introuvable

- **Symptôme :**
  ```
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@poppinss/ts-exec' imported from /opt/render/project/src/ace.js
  ```
  (`added 638 packages` au lieu de ~800)
- **Cause racine :** Render fixe `NODE_ENV=production`, donc `npm install` **saute les `devDependencies`**. Or `node ace build` (assembler, `tsc`, `vite`, `@poppinss/ts-exec`) en a besoin.
- **Fix tenté (sans effet) :** modifier `buildCommand` en `npm install --include=dev` dans `render.yaml` → ignoré (cf. leçon transversale).
- **Fix qui fonctionne :** un fichier **`.npmrc`** committé à la racine :
  ```
  include=dev
  ```
  npm le lit quelle que soit la commande de build et installe les devDeps malgré `NODE_ENV=production` (`include` l'emporte sur le `omit=dev` induit par NODE_ENV). Résultat : `added 807 packages`. ✅

### 3.2 — vite : registry Tuyau introuvable

- **Symptôme :**
  ```
  Error: [vite:load-fallback] Could not load .adonisjs/client//registry
  (imported by inertia/client.ts): ENOENT: no such file or directory
  ```
- **Cause racine :** en Story 1.8, le dossier `.adonisjs/` (codegen) avait été **gitignoré et dé-tracké**. Or le **registry Tuyau** (`.adonisjs/client/registry`, importé par `inertia/client.ts` via `@generated/registry`) **n'est pas régénéré de façon fiable par `node ace build`** sur un clone frais. En local il existait seulement parce que les runs `dev`/`test` l'avaient généré.
- **Fix :** **re-committer `.adonisjs/`** (et `database/schema.ts`) — revert du gitignore de la Story 1.8. **Ne jamais re-gitignorer `.adonisjs`.**

### 3.3 — Build OK mais devDeps : confirmation du `.npmrc`

- Après 3.1 et 3.2, le build a franchi : `npm install` (807 packages) → codegen → **vite build** (844 modules) → `tsc` → `Build successful 🎉`.

### 3.4 — `Missing manifest file` au runtime (erreur 500)

- **Symptôme :** le serveur **démarre** (`started HTTP server on 0.0.0.0:10000`) mais chaque requête renvoie 500 :
  ```
  EdgeError: Missing manifest file. Make sure to first create a build
  at build/resources/views/inertia_layout.edge:20  (@vite(['inertia/app.tsx']))
  ```
- **Cause racine :** le serveur était lancé avec `node build/bin/server.js` **depuis la racine** (`src/`). Du coup AdonisJS cherchait le manifest Vite dans `public/assets/.vite/manifest.json` (racine) au lieu de `build/public/assets/.vite/manifest.json`. AdonisJS attend que le serveur tourne **depuis `build/`**.
- **Fix :** `startCommand` lançant le serveur depuis `build/` :
  ```
  node ace migration:run --force && cd build && node bin/server.js
  ```
  Comme `render.yaml` n'est pas re-synchronisé, ce changement a dû être fait **manuellement dans le dashboard Render** (Settings → Build & Deploy → Start Command). C'est cette édition manuelle qui a débloqué le déploiement : `Your service is live 🎉`.

---

## 4. DNS / Mailgun — conflit CNAME

- **Symptôme anticipé :** vouloir ajouter un CNAME `anta` → `anta-staging.onrender.com` alors qu'un TXT SPF Mailgun existe déjà au **même nom** `anta`.
- **Cause racine :** règle DNS (RFC 1034) — **un CNAME doit être le seul enregistrement à son nom**, il ne peut coexister avec aucun autre type (ici le TXT SPF `v=spf1 include:mailgun.org`).
- **Fix :** déplacer Mailgun sur un **sous-domaine dédié** (`mg.anta.peraha.com`) pour libérer le nom `anta` pour le CNAME du site. Config app mise à jour en conséquence :
  - `MAIL_MAILER=mailgun` (Mailgun devient principal)
  - `MAIL_FROM_ADDRESS=contact@mg.anta.peraha.com`
  - `MAILGUN_DOMAIN=mg.anta.peraha.com`

---

## Leçons apprises (à retenir)

1. **Render ignore `render.yaml` après création du service.** Pour changer build/start command ou variables d'env d'un service existant → **éditer dans le dashboard**. Privilégier les fixes par **fichiers de repo** quand c'est possible (`.npmrc`).
2. **`NODE_ENV=production` + `node ace build` = piège.** Toujours committer un `.npmrc` avec `include=dev` pour les plateformes PaaS qui forcent `production`.
3. **Committer `.adonisjs/`** (et `database/schema.ts`) pour AdonisJS + Tuyau. Le codegen n'est pas régénéré de façon fiable au build sur clone frais.
4. **Lancer le serveur AdonisJS depuis `build/`** en production (`cd build && node bin/server.js`), sinon le manifest Vite est introuvable.
5. **Supabase pooler :** `DB_SSL=true`, user `postgres.PROJECT_REF`, host régional. Reset password = délai de propagation ; ne pas marteler (circuit breaker).
6. **Un CNAME ne coexiste avec rien** au même nom — séparer site et domaine mail sur des (sous-)domaines distincts.
7. **Patch P2 de la revue de code** (variables mail en `.optional()`) : c'est ce qui a permis de basculer Resend ↔ Mailgun sans casser le boot. Les configs optionnelles paient.

---

## Implications pour l'Epic 8 (migration VPS)

Sur VPS, plusieurs de ces problèmes disparaissent ou changent de nature :

- **devDeps / NODE_ENV :** on contrôle l'environnement → `npm ci` puis build explicite ; le `.npmrc include=dev` reste utile mais on maîtrise l'ordre.
- **`.adonisjs/` committé :** reste valable (ou régénérer au build dans le pipeline).
- **Serveur depuis `build/` :** identique — PM2 doit pointer sur `build/bin/server.js` avec le bon cwd (`cd build`).
- **Manifest Vite :** même contrainte de répertoire de travail.
- **DB SSL :** dépend du Postgres cible (Supabase = SSL ; Postgres local sur le VPS = potentiellement sans SSL → `DB_SSL` gère les deux).
- **Migrations dans le startCommand :** à découpler (cf. finding D2 de la revue, reporté en Epic 8) — utiliser un step de déploiement dédié plutôt que de bloquer le boot/restart.

---

## Référence — séquence de fixes (commits)

| Commit | Fix |
|--------|-----|
| `config/database.ts` (DB_SSL) | Gating SSL Supabase/CI |
| `632ab77` | buildCommand `--include=dev` (render.yaml, non appliqué par Render) |
| `1f6abff` | `.npmrc include=dev` (le fix devDeps qui marche) |
| `67e683b` | Commit `.adonisjs/` + `schema.ts` (registry Tuyau) |
| `57ab5e5` | startCommand `cd build && node bin/server.js` (manifest Vite) |
| `f65d6ec` | Mailgun principal sur `mg.anta.peraha.com` |
