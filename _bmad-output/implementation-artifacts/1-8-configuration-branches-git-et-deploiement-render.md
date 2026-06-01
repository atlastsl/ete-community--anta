# Story 1.8 : Configuration des branches Git et déploiement Render

Status: review

## Story

En tant que développeur,
Je veux un dépôt Git configuré avec trois branches (master, development, staging) et un environnement de test/démo déployé automatiquement sur Render depuis staging,
Afin que l'équipe puisse développer par story, tester localement, puis déployer en un clic vers un environnement partagé.

## Acceptance Criteria

**AC1** — Trois branches Git existent avec `development` par défaut

- **Given** le dépôt Git existe (origin : `https://github.com/atlastsl/ete-community--anta.git`)
- **When** les branches sont créées et poussées
- **Then** trois branches existent localement ET sur le remote : `master` (production), `development` (centralisation), `staging` (test Render)
- **And** `development` est la branche par défaut du dépôt GitHub
- **And** des règles de protection minimales sont en place : `master` exige PR review (interdit push direct), `development` exige succès CI

**AC2** — Workflow Git documenté et appliqué

- **Given** la stratégie de branches est en place
- **When** un développeur démarre une story
- **Then** il crée une branche depuis `development` (convention `feat/X.Y-slug` ou `fix/X.Y-slug`)
- **And** après validation locale, il merge sa branche vers `development` (squash recommandé)
- **And** quand prêt à déployer en test : PR `development → staging`
- **And** quand prêt pour production : PR `staging → master`
- **And** ce workflow est documenté dans `_docs/git-workflow.md`

**AC3** — `render.yaml` Blueprint déclaratif présent

- **Given** Render supporte l'Infrastructure as Code via `render.yaml`
- **When** un fichier `render.yaml` est présent à la racine du dépôt
- **Then** il déclare un service web Node.js nommé `anta-staging`
- **And** `branch: staging`, `buildCommand: npm install && node ace build`, `startCommand: node ace migration:run --force && node build/bin/server.js`
- **And** les variables d'environnement sont listées avec `sync: false` (à remplir manuellement dans le dashboard Render pour les secrets)

**AC4** — CI GitHub Actions opérationnel

- **Given** `.github/workflows/ci.yml` est créé
- **When** une PR est ouverte vers `development`, `staging` ou `master`
- **Then** le workflow exécute : checkout, setup Node 24, `npm ci`, lint, tests (suite unit)
- **And** un service PostgreSQL 16 est démarré en parallèle pour permettre aux tests qui touchent la BDD
- **And** les variables d'env de test (DB locale + R2 stubbed + mail stubbed) sont définies dans le step
- **And** la PR ne peut être mergée que si le workflow CI passe (gate CI activée sur GitHub)

**AC5** — Documentation déploiement Render

- **Given** l'utilisateur veut déployer pour la première fois sur Render
- **When** il consulte `_docs/deployment-render.md`
- **Then** il y trouve : création du compte Render, création du service via Blueprint (`render.yaml`), configuration des secrets (DB Supabase, R2, mail), configuration du cron-job.org pour keep-alive, et procédure de rollback

**AC6** — Tests de validation des fichiers de config

- **Given** la suite de tests est exécutée
- **When** les tests d'infrastructure CI/CD tournent
- **Then** ils valident :
  - `.github/workflows/ci.yml` est un YAML valide et contient les triggers attendus
  - `render.yaml` est un YAML valide et contient les commandes build/start documentées
  - `.gitignore` exclut `.env`, `node_modules`, `build`, `tmp/`, `storage/`

## Tasks / Subtasks

- [x] **Tâche 1 — Créer les branches Git** (AC1) ✅ FAIT (2026-05-31)
  - [x] 1.1 Epic 1 commité en 3 commits sur `master` (chore untrack / feat foundations / docs)
  - [x] 1.2-1.3 Branches `development` et `staging` créées depuis `master`
  - [x] 1.4 Les 3 branches poussées sur origin (fix SSL : `git config http.sslBackend schannel` — réseau ULAVAL)
  - [x] 1.5 Branche par défaut GitHub → `development` (via `gh api`)

- [x] **Tâche 2 — Protections de branches** (AC1) ✅ FAIT (2026-05-31)
  - [x] Repo rendu **public** (choix utilisateur) après scan de sécurité confirmant zéro secret dans l'historique (`.env` jamais tracké, APP_KEY/DB passwords absents)
  - [x] `master` : PR obligatoire (0 review — adapté dev solo, évite le deadlock self-approval) + gate CI `Lint & Test`
  - [x] `development` : PR obligatoire + gate CI `Lint & Test`
  - [ ] ⚠️ À vérifier après la 1ère PR : que le contexte de check s'appelle bien `Lint & Test` (sinon ajuster dans Settings → Branches, sinon les PR resteraient bloquées)

- [x] **Tâche 3 — `render.yaml` Blueprint** (AC3)
  - [x] 3.1 `render.yaml` créé à la racine
  - [x] 3.2 Toutes les variables sensibles listées avec `sync: false` (APP_KEY, DB_PASSWORD, R2_*, RESEND_API_KEY, MAILGUN_API_KEY, SUPER_ADMIN_PASSWORD)
  - [x] 3.3 Plan `free`, region `oregon`, runtime `node`, branch `staging`, healthCheckPath `/`, autoDeploy true

- [x] **Tâche 4 — Workflow CI GitHub Actions** (AC4)
  - [x] 4.1 `.github/workflows/ci.yml` créé
  - [x] 4.2 Triggers : PR vers `development`/`staging`/`master` + push vers `development`/`staging`
  - [x] 4.3 Job `test` : Node 24, service PostgreSQL 16 healthcheck, npm ci, migrate, lint, test unit
  - [x] 4.4 Variables env stub pour R2/mail (fakes utilisés par les tests)
  - [x] 4.5 YAML valide (vérifié par les tests unitaires)

- [x] **Tâche 5 — Documentation déploiement** (AC5)
  - [x] 5.1 `_docs/deployment-render.md` créé (compte Render → Blueprint → secrets → seeder super admin → cron-job.org → rollback)
  - [x] 5.2 `_docs/git-workflow.md` créé (branches, workflow story, déploiement test/prod, conventions de nommage commits)
  - [x] 5.3 `README.md` créé (n'existait pas) avec stack technique, démarrage rapide, liens vers `_docs/` et `_bmad-output/`

- [x] **Tâche 6 — Tests d'infrastructure** (AC6)
  - [x] 6.1 `tests/unit/infrastructure/config_files.spec.ts` créé
  - [x] 6.2 Tests `render.yaml` : YAML valide, service staging, build/start commands, secrets `sync: false` (4 tests)
  - [x] 6.3 Tests `ci.yml` : triggers branches, Node 24, PostgreSQL 16, steps lint/test/migrate (4 tests)
  - [x] 6.4 Tests `.gitignore` : .env, node_modules, build, tmp, .adonisjs, schema.ts, storage (4 tests)
  - [x] 6.5 `yaml@2.x` installé en devDependency
  - [x] 6.6 Tests Documentation : README + git-workflow + deployment-render existent et référencent les bons éléments (3 tests)
  - [x] 6.7 `node ace test --suite unit` — **74/74 tests passent** (15 nouveaux + 59 existants)

- [x] **Tâche 7 — Setup Render** (AC3, AC5) ✅ DÉPLOYÉ ET LIVE (2026-06-01)
  - [x] Service `anta-staging` créé via Blueprint, secrets remplis, **https://anta-staging.onrender.com** live
  - [x] 4 fixes de déploiement appliqués (voir Debug Log / memory) : `.npmrc include=dev`, `.adonisjs` committé, build/start commands corrigés
  - [ ] ⚠️ Mettre à jour `APP_URL` dans Render avec l'URL réelle si pas déjà fait

- [ ] **Tâche 8 — Keep-alive cron-job.org** (AC documenté) — ⚠️ **À FAIRE PAR L'UTILISATEUR**
  - [ ] 8.1-8.3 Compte cron-job.org + job GET `https://anta-staging.onrender.com/` toutes les 14 min (cf. `_docs/deployment-render.md`)

## Dev Notes

### État actuel du repo Git

- **Origin remote** : `https://github.com/atlastsl/ete-community--anta.git`
- **Branche locale unique** : `master`
- **Commits** : 1 seul (`Initial commit` `eff991b`)
- **Modifications non commitées** : massives (toutes les Stories 1.3 → 1.7 — config, code, tests, docs)

### Commits pré-requis (Tâche 1.1)

Avant de créer les branches, il faut committer le travail des stories précédentes. Plutôt qu'un gros commit "WIP all stories", découper proprement :

**Approche recommandée** : faire un commit par story sur `master` (avant la division en branches), avec messages cohérents :

```bash
git add _bmad-output/planning-artifacts/architecture.md _bmad-output/planning-artifacts/epics.md _bmad-output/planning-artifacts/implementation-readiness-report-*.md
git commit -m "docs: update planning artifacts (Render + VPS Epic 8)"

git add config/drive.ts start/env.ts .env.example app/services/file_storage_service.ts tests/unit/services/file_storage_service.spec.ts adonisrc.ts package.json package-lock.json _bmad-output/implementation-artifacts/1-3-*.md
git rm app/services/.gitkeep
git commit -m "feat(story-1.3): Cloudflare R2 storage with FileStorageService"

git add config/mail.ts resources/views/emails/test_email.edge tests/unit/services/mail_config.spec.ts _bmad-output/implementation-artifacts/1-4-*.md
git commit -m "feat(story-1.4): Resend + Mailgun email service"

git add database/seeders/super_admin_seeder.ts tests/unit/seeders/super_admin_seeder.spec.ts _bmad-output/implementation-artifacts/1-5-*.md
git commit -m "feat(story-1.5): SuperAdminSeeder with idempotency"

git add config/database.ts
git commit -m "fix(db): Supabase pooler SSL config"

git add inertia/lib/i18n inertia/locales inertia/app.tsx inertia/admin.tsx tests/unit/i18n _bmad-output/implementation-artifacts/1-6-*.md
git commit -m "feat(story-1.6): react-i18next infrastructure with public/admin instances"

git add inertia/css inertia/layouts inertia/components inertia/lib/utils.ts components.json public/images public/favicon.png resources/views/inertia_layout.edge vite.config.ts tsconfig.json inertia/ssr.tsx tests/unit/design_system _bmad-output/implementation-artifacts/1-7-*.md
git rm inertia/layouts/default.tsx
git commit -m "feat(story-1.7): Tailwind v4 + shadcn/ui design system"
```

⚠️ **Fichiers à NE PAS committer** :
- `.env` (contient secrets) — déjà dans `.gitignore` normalement, vérifier
- `node_modules/`
- `.adonisjs/client/manifest.d.ts` — fichier généré, ignorer si pas déjà fait

⚠️ **Considération** : les fichiers `.claude/settings.local.json` et `database/schema.ts` apparaissent modifiés. Le premier est local à Claude Code (ne pas committer), le second est probablement généré par AdonisJS (à vérifier).

### `render.yaml` — Template complet

```yaml
# render.yaml — Blueprint Render pour Anta (environnement staging/démo)
# Doc : https://render.com/docs/blueprint-spec
services:
  - type: web
    name: anta-staging
    runtime: node
    plan: free                          # 512 MB RAM, sleep après 15 min d'inactivité
    region: oregon                      # ou frankfurt si tu préfères proximité EU
    branch: staging                     # auto-deploy à chaque push sur staging
    buildCommand: npm install && node ace build
    startCommand: node ace migration:run --force && node build/bin/server.js
    healthCheckPath: /                  # Render ping cette URL pour vérifier le démarrage
    autoDeploy: true
    envVars:
      # === Variables non-sensibles ===
      - key: NODE_ENV
        value: production
      - key: TZ
        value: UTC
      - key: PORT
        value: 10000                    # Port standard Render
      - key: HOST
        value: 0.0.0.0
      - key: LOG_LEVEL
        value: info
      - key: APP_NAME
        value: Anta
      - key: VITE_APP_NAME
        value: Anta
      - key: SESSION_DRIVER
        value: cookie
      - key: MAIL_MAILER
        value: resend
      - key: MAIL_FROM_NAME
        value: Anta
      - key: MAIL_FROM_ADDRESS
        value: noreply@anta.community
      - key: MAILGUN_DOMAIN
        value: mg.anta.community

      # === Secrets à remplir manuellement dans le dashboard Render ===
      # sync: false → Render ne les écrase pas et les masque dans l'UI
      - key: APP_KEY
        sync: false                     # node ace generate:key
      - key: APP_URL
        sync: false                     # https://anta-staging.onrender.com (à remplir après 1er deploy)

      - key: DB_HOST
        sync: false
      - key: DB_PORT
        sync: false
      - key: DB_USER
        sync: false
      - key: DB_PASSWORD
        sync: false
      - key: DB_DATABASE
        sync: false

      - key: R2_ENDPOINT
        sync: false
      - key: R2_BUCKET
        sync: false
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false

      - key: RESEND_API_KEY
        sync: false
      - key: MAILGUN_API_KEY
        sync: false

      - key: SUPER_ADMIN_EMAIL
        sync: false
      - key: SUPER_ADMIN_PASSWORD
        sync: false
```

⚠️ **`plan: free`** : 512 MB RAM, l'app s'endort après 15 min sans trafic. Le cron-job.org keep-alive contourne ça.

⚠️ **`region: oregon`** : par défaut. Si tu préfères la latence EU, change pour `frankfurt`. Note : la latence ne sera pas optimale dans tous les cas car Supabase est en `ca-central-1` (Canada) — la BDD est aussi en Amérique du Nord, donc Oregon est cohérent.

⚠️ **`startCommand` avec migrations** : `node ace migration:run --force` est exécuté à chaque deploy. Pour la phase démo c'est OK. En production VPS (Epic 8), il faudra découpler le déploiement du code et l'exécution des migrations (les migrations doivent être idempotentes — ce qu'AdonisJS garantit).

### `.github/workflows/ci.yml` — Template complet

```yaml
name: CI

on:
  pull_request:
    branches: [development, staging, master]
  push:
    branches: [development, staging]

jobs:
  test:
    name: Lint & Test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: anta_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    env:
      # Node
      TZ: UTC
      NODE_ENV: test
      PORT: 3333
      HOST: localhost
      LOG_LEVEL: info

      # App
      APP_KEY: ci-test-app-key-32-chars-minimum-required
      APP_URL: http://localhost:3333
      APP_NAME: Anta
      VITE_APP_NAME: Anta

      # Session
      SESSION_DRIVER: cookie

      # Database (Postgres service ci-dessus)
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_DATABASE: anta_test

      # Cloudflare R2 — stubs (les tests utilisent drive.fake('r2'))
      R2_ENDPOINT: https://placeholder.r2.cloudflarestorage.com
      R2_BUCKET: anta-test
      R2_ACCESS_KEY_ID: placeholder
      R2_SECRET_ACCESS_KEY: placeholder

      # Email — stubs (les tests utilisent mail.fake())
      MAIL_MAILER: resend
      MAIL_FROM_NAME: Anta
      MAIL_FROM_ADDRESS: noreply@anta.community
      RESEND_API_KEY: placeholder
      MAILGUN_API_KEY: placeholder
      MAILGUN_DOMAIN: mg.anta.community

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: node ace migration:run --force

      - name: Lint
        run: npm run lint

      - name: Run unit tests
        run: node ace test --suite unit
```

⚠️ **Pas de `ssl` dans la config DB pour CI** : le PostgreSQL service n'est pas en SSL. Notre `config/database.ts` a `ssl: { rejectUnauthorized: false }` — vérifier que ça ne bloque pas si le serveur n'a pas SSL. Le driver `pg` est tolérant à ça (négocie SSL si dispo, sinon plain). Si problème : conditionner SSL sur une variable d'env type `DB_SSL=true`.

⚠️ **`functional` tests pas inclus** : on lance uniquement `--suite unit`. Les tests fonctionnels (qui démarrent un vrai serveur HTTP) seront ajoutés en Epic 2+.

⚠️ **`SUPER_ADMIN_*` non définies en CI** : OK car elles sont `.optional()` dans `start/env.ts` (Story 1.5).

### `_docs/git-workflow.md` — Template

```markdown
# Workflow Git Anta

## Branches principales

| Branche       | Rôle                                                     | Protection             |
|---------------|----------------------------------------------------------|------------------------|
| `master`      | Production (VPS — Epic 8)                                | PR + 1 review obligatoire |
| `development` | Centralisation des features en cours (branche par défaut) | CI doit passer         |
| `staging`     | Environnement test/démo (connectée à Render auto-deploy) | CI doit passer         |

## Workflow par story

1. `git checkout development && git pull origin development`
2. Créer une branche : `git checkout -b feat/X.Y-slug` (ex. `feat/2-1-admin-layout`)
3. Développer + tester localement
4. Commit + push : `git push -u origin feat/X.Y-slug`
5. Créer une PR `feat/X.Y-slug → development` sur GitHub
6. Une fois CI vert + (review optionnelle), merger
7. Supprimer la branche feature

## Déploiement test (Render)

1. `git checkout staging && git pull origin staging`
2. Créer une PR `development → staging` sur GitHub
3. Une fois CI vert + merge, Render auto-deploy
4. Vérifier l'app sur `https://anta-staging.onrender.com`

## Déploiement production (VPS — Epic 8)

1. Créer une PR `staging → master` sur GitHub
2. Review obligatoire, CI doit passer
3. Une fois mergé, GitHub Actions déclenche le déploiement VPS (workflow à créer en Epic 8)
```

### `_docs/deployment-render.md` — Template

```markdown
# Déploiement Render — Anta

## Prérequis

- Compte GitHub avec accès au repo `atlastsl/ete-community--anta`
- Compte Cloudflare R2 avec bucket créé et credentials
- Compte Resend (et optionnellement Mailgun) avec API key
- Projet Supabase actif avec credentials connection pooler

## Étape 1 — Créer le compte Render

1. Aller sur https://render.com → Sign Up with GitHub
2. Autoriser l'accès au repo `atlastsl/ete-community--anta`

## Étape 2 — Créer le service via Blueprint

1. Dashboard Render → New → Blueprint
2. Sélectionner le repo `ete-community--anta`
3. Render détecte automatiquement `render.yaml` à la racine
4. Cliquer "Apply"

## Étape 3 — Configurer les secrets

Dans le dashboard Render → service `anta-staging` → Environment :

| Variable | Valeur |
|----------|--------|
| `APP_KEY` | Générer via `node ace generate:key` localement |
| `APP_URL` | `https://anta-staging.onrender.com` (à mettre après le 1er deploy) |
| `DB_HOST` | `aws-1-ca-central-1.pooler.supabase.com` |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres.PROJECT_REF` |
| `DB_PASSWORD` | (password Supabase) |
| `DB_DATABASE` | `postgres` |
| `R2_ENDPOINT` | `https://ACCOUNT.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `anta-productions` |
| `R2_ACCESS_KEY_ID` | (credentials R2) |
| `R2_SECRET_ACCESS_KEY` | (credentials R2) |
| `RESEND_API_KEY` | (API key Resend) |
| `MAILGUN_API_KEY` | (API key Mailgun, ou laisser vide si pas configuré) |
| `SUPER_ADMIN_EMAIL` | `admin@anta.community` |
| `SUPER_ADMIN_PASSWORD` | (mot de passe initial — sera changé à la 1ère connexion) |

## Étape 4 — Premier deploy

1. Render lance automatiquement le build après l'apply Blueprint
2. Logs visibles en temps réel dans Events
3. Une fois "Live" : ouvrir l'URL fournie (`https://anta-staging.onrender.com`)
4. Vérifier que la homepage Anta s'affiche

## Étape 5 — Initialiser le super admin

```bash
# Dans Render Dashboard → service → Shell (web)
node ace db:seed --files=./database/seeders/super_admin_seeder.ts
```

## Étape 6 — Keep-alive (cron-job.org)

Render Free Tier endort l'app après 15 min d'inactivité (cold start 30-60s).

1. Créer un compte gratuit sur https://cron-job.org
2. Créer un nouveau job :
   - URL : `https://anta-staging.onrender.com/`
   - Schedule : Every 14 minutes
   - Method : GET
3. Activer le job

## Rollback

En cas de problème après un deploy :
1. Render Dashboard → service → Deploys
2. Sélectionner un deploy précédent réussi → "Rollback"
```

### Tests d'infrastructure — Stratégie

```typescript
// tests/unit/infrastructure/config_files.spec.ts
import { test } from '@japa/runner'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const r = (p: string) => resolve(process.cwd(), p)

test.group('Infrastructure | render.yaml', () => {
  const renderConfig = parse(readFileSync(r('render.yaml'), 'utf-8'))

  test('render.yaml est un YAML valide avec services', ({ assert }) => {
    assert.isArray(renderConfig.services)
    assert.isAtLeast(renderConfig.services.length, 1)
  })

  test('service anta-staging branche surveille staging', ({ assert }) => {
    const svc = renderConfig.services.find((s: any) => s.name === 'anta-staging')
    assert.exists(svc)
    assert.equal(svc.branch, 'staging')
    assert.equal(svc.type, 'web')
  })

  test('build et start commands corrects', ({ assert }) => {
    const svc = renderConfig.services[0]
    assert.include(svc.buildCommand, 'npm install')
    assert.include(svc.buildCommand, 'node ace build')
    assert.include(svc.startCommand, 'migration:run')
    assert.include(svc.startCommand, 'build/bin/server.js')
  })
})

test.group('Infrastructure | GitHub Actions CI', () => {
  const ci = parse(readFileSync(r('.github/workflows/ci.yml'), 'utf-8'))

  test('CI workflow trigge sur PR vers les 3 branches', ({ assert }) => {
    const branches = ci.on.pull_request.branches
    assert.includeMembers(branches, ['development', 'staging', 'master'])
  })

  test('CI exécute le job test avec Node 24', ({ assert }) => {
    const testJob = ci.jobs.test
    assert.exists(testJob)
    const setupNode = testJob.steps.find((s: any) => s.uses?.includes('setup-node'))
    assert.equal(setupNode.with['node-version'], '24')
  })

  test('CI exécute lint et tests', ({ assert }) => {
    const steps = ci.jobs.test.steps.map((s: any) => s.run || '')
    assert.isTrue(steps.some((s: string) => s.includes('npm run lint')))
    assert.isTrue(steps.some((s: string) => s.includes('node ace test')))
  })
})

test.group('Infrastructure | .gitignore', () => {
  const gitignore = readFileSync(r('.gitignore'), 'utf-8')

  test('exclut .env et secrets', ({ assert }) => {
    assert.match(gitignore, /^\.env$/m)
  })

  test('exclut node_modules et build', ({ assert }) => {
    assert.match(gitignore, /^node_modules/m)
    assert.match(gitignore, /^build/m)
  })
})
```

⚠️ **Package `yaml`** : nécessaire pour parser. Vérifier s'il est déjà en deps (probablement pas). Si absent : `npm install --save-dev yaml`.

### Pages legacy AdonisJS Auth — Considération pour le déploiement Render

Les pages `home.tsx`, `auth/login.tsx`, `auth/signup.tsx` du starter AdonisJS sont dégradées visuellement depuis la Story 1.7 (CSS legacy supprimé). Sur Render, elles seront accessibles mais moches. **C'est acceptable** pour la phase démo :
- Les vraies pages Anta arrivent à partir de l'Epic 2
- Les visiteurs internes/testeurs sauront que c'est un environnement WIP

Si problème : on peut ajouter un middleware "Maintenance mode" qui retourne une page d'attente pour ces routes legacy. Hors scope de cette story.

### Anti-Patterns à Éviter

- ❌ Commiter le `.env` "pour faciliter le deploy" → ✅ jamais — Render gère les secrets via dashboard
- ❌ Définir les secrets dans `render.yaml` avec `value:` → ✅ `sync: false` pour les forcer manuellement
- ❌ Faire un seul gros commit "WIP all stories" → ✅ découper par story pour avoir un historique propre
- ❌ Désactiver `--force` sur `migration:run` en production → ✅ `--force` est REQUIS en non-interactif (Render n'a pas de TTY)
- ❌ Mettre la branche `master` connectée à Render → ✅ Render = `staging`, `master` = VPS production (Epic 8)
- ❌ Tester avec un vrai compte Render dans CI GitHub Actions → ✅ CI utilise PostgreSQL service container + fakes R2/mail
- ❌ Skip les protections de branches "pour aller plus vite" → ✅ protections évitent les `git push --force` accidentels sur `master`
- ❌ Cron-job.org gratuit avec intervalle < 5 min → ✅ 14 min est juste sous le seuil 15 min de Render, et respecte le rate limit cron-job.org
- ❌ Lancer le keep-alive sur une route d'API qui touche la BDD → ✅ pinger `/` (homepage statique côté serveur)

### Project Structure Notes

**Fichiers créés par cette story :**
- `render.yaml` (racine) — Blueprint Render
- `.github/workflows/ci.yml` — pipeline CI GitHub Actions
- `_docs/git-workflow.md` — documentation branches et workflow
- `_docs/deployment-render.md` — guide déploiement
- `tests/unit/infrastructure/config_files.spec.ts` — validation YAML/gitignore

**Fichiers modifiés par cette story :**
- `README.md` — ajout liens vers `_docs/` (créer si absent)
- `package.json` — ajout `yaml` en devDependency si pas présent
- `.gitignore` — vérification que les exclusions sont bien là (créer ou ajuster si nécessaire)

**Branches créées :**
- `development` (depuis `master`) — nouvelle branche par défaut
- `staging` (depuis `master`) — connectée à Render

**Actions manuelles utilisateur (hors scope code, mais checklist incluse) :**
- Compte Render créé + service Blueprint connecté
- Secrets Render configurés
- Branche par défaut GitHub changée vers `development`
- Protections de branches activées
- Compte cron-job.org créé + job ping configuré

### Previous Story Intelligence (Stories 1.1 → 1.7)

**Patterns à reproduire :**
- Tests Japa Node-pur pour valider la structure des fichiers de config (cohérent avec Story 1.6 i18n et 1.7 design system)
- Documenter les divergences ou décisions clés dans Dev Notes
- Séparer ce qui est "automatisable par le dev agent" de ce qui est "action utilisateur" (similaire à la mise à jour `.env` dans Stories 1.3-1.5)

**Gotchas pertinents pour cette story :**
- **Supabase pooler SSL** (Story 1.4) — `config/database.ts` a `ssl: { rejectUnauthorized: false }`. Sur Render, la connexion à Supabase fonctionnera car le pooler Supabase requiert SSL et la config est déjà adaptée. En CI GitHub Actions, le PostgreSQL service n'a pas SSL — vérifier que le driver `pg` négocie correctement (généralement OK, il fallback en plain).
- **`assert.throws()` Japa** — toujours utiliser try/catch + `assert.instanceOf` au lieu du prédicat (déjà documenté)

### Cas d'usage MVP de cette story

Cette story **clôt l'Epic 1 (Fondations Techniques)**. Après son implémentation :
- Le projet a une stratégie Git propre et testée
- L'environnement de démo est en ligne et accessible
- Le CI valide automatiquement chaque PR
- L'Epic 2 (Auth admin) peut démarrer avec une base solide

L'Epic 8 (Migration VPS production) reprendra le flambeau plus tard, en remplaçant Render par un VPS Hetzner. Le workflow Git restera identique — seul le `master → deploy` changera (GitHub Actions → VPS au lieu de Render Blueprint).

### References

- [Source: epics.md#Story 1.8] — Acceptance Criteria (réécrits par toi pendant la conception architecture)
- [Source: epics.md#Epic 8] — Story 8.3 documente le décommissionnement Render (future étape)
- [Source: architecture.md#6. Infrastructure et Déploiement] — Section "Phase initiale — Dev/Démo (Render)" documente la cible
- [Source: Render docs] — https://render.com/docs/blueprint-spec
- [Source: GitHub Actions docs] — services PostgreSQL + setup-node + branch protection
- [Source: Story 1.4] — Pattern de stub des secrets dans CI

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **YAML parse de `ci.yml`** : la clé `on:` est parsée par certains parseurs YAML comme le booléen `true` (vu en YAML 1.1 où `on/off/yes/no` sont des booléens). Le test gère ce cas avec `const triggers = ci.on ?? ci[true]`. Heureusement `yaml@2.x` semble respecter YAML 1.2 et parse `on` comme string — mais le fallback assure la robustesse.
- **`yaml` package** : n'était pas installé (ni en deps ni en transitif). Ajouté en devDependency.
- **`.gitignore`** mis à jour pour exclure `.adonisjs/` (codegen AdonisJS), `database/schema.ts` (généré par Lucid), `storage/*` (R2 utilisé en remote), `.claude/settings.local.json` (local IDE).

### Completion Notes List

- AC1 ✅ Pas encore appliqué — actions Git de l'utilisateur requises (création branches, push, default branch). Les fichiers de config sont en place pour faciliter ces étapes.
- AC2 ✅ Workflow Git documenté dans `_docs/git-workflow.md`, conventions de commits incluses
- AC3 ✅ `render.yaml` complet et validé par tests automatisés
- AC4 ✅ `.github/workflows/ci.yml` complet avec PostgreSQL service container, validé par tests
- AC5 ✅ `_docs/deployment-render.md` (guide pas-à-pas), `_docs/git-workflow.md`, `README.md` créés
- AC6 ✅ 15 tests d'infrastructure passent — validation YAML, .gitignore, documentation
- **Total : 74/74 tests** (59 existants + 15 nouveaux)

### Change Log

- 2026-05-30 : Implémentation Story 1.8 — render.yaml Blueprint, GitHub Actions CI avec PostgreSQL service, documentation déploiement et workflow Git, README.md, .gitignore enrichi, 15 tests d'infrastructure. Actions manuelles utilisateur restantes : création branches Git et setup Render/cron-job.org.

### File List

**Créés :**
- `render.yaml` (racine) — Blueprint Render
- `.github/workflows/ci.yml` — pipeline CI GitHub Actions
- `_docs/git-workflow.md` — stratégie branches + conventions
- `_docs/deployment-render.md` — guide Render pas-à-pas
- `README.md` — accueil projet
- `tests/unit/infrastructure/config_files.spec.ts` (15 tests)

**Modifiés :**
- `.gitignore` — ajout `.adonisjs`, `database/schema.ts`, `storage/*`, `.claude/settings.local.json`
- `package.json` — ajout `yaml` en devDependency

**Actions utilisateur restantes (non automatisables) :**
- Commits + push des Stories 1.3 → 1.7 (script de 7 commits suggéré dans Dev Notes)
- `git checkout -b development master && git checkout -b staging master && git push -u origin development staging`
- GitHub : changer default branch vers `development`
- GitHub : protections de branches (`master` : PR + review ; `development`/`staging` : CI gate)
- Render : compte + Blueprint apply + remplir secrets dans dashboard
- cron-job.org : compte + job GET sur l'URL Render toutes les 14 min
