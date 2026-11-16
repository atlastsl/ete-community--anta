# Story 8.4 : CI/CD de déploiement du staging

Status: review

## Story

En tant que développeur,
Je veux qu'un push sur la branche `staging` déploie automatiquement le VPS de staging,
Afin de conserver le flux actuel (PR `development → staging`) sans Render.

## Acceptance Criteria

1. **Given** une PR `development → staging` est mergée
   **When** le workflow `deploy-staging.yml` se déclenche
   **Then** les tests (`node ace test`, Postgres de service CI) passent avant tout déploiement (gate)
2. **And** la suite fonctionnelle est réparée en CI et le `continue-on-error` du step `Run functional tests` de `ci.yml` est retiré (`deferred-work.md`, « TICKET — Suite fonctionnelle incompatible avec la CI »)
3. **And** l'image est construite et poussée sur GHCR, taggée avec le SHA du commit
4. **And** le VPS de staging tire l'image et redémarre la stack via SSH (clé de déploiement dédiée, secrets GitHub)
5. **And** un health check HTTP sur `https://anta.peraha.com` valide le déploiement ; en cas d'échec le workflow est rouge et l'image précédente reste relançable par son tag

## Cause racine de la suite fonctionnelle (diagnostiquée à la création de la story)

Ce n'est **pas** la transaction globale (hypothèse du ticket). Le plugin `sessionApiClient` de `@adonisjs/session` 8 écrit la session du client de test (`withCsrfToken()`, `loginAs()`, `flashMessages()`) dans le store **memory** (`config.stores.memory()`). Le serveur ne la lit que si `SESSION_DRIVER=memory`, valeur de `.env.test`. Or `ci.yml` et `scripts/test-local.sh` exportent `SESSION_DRIVER=cookie`, et une variable d'environnement du process **prime** sur `.env.test`. Le serveur ne voit donc jamais la session : CSRF invalide → redirect `/`, `loginAs` sans effet → `/admin/login`, flash vide.

Vérifié : avec `SESSION_DRIVER=memory` dans `test-local.sh`, functional passe de 81/171 à **169/171**. Les 2 échecs restants (`tests/functional/public/home.spec.ts`) sont des tests périmés : depuis 0a1541f (taxonomie unifiée), `home_controller` renvoie `categories: [...PRODUCTION_CATEGORIES]` (liste fixe), plus les catégories distinctes des productions publiées.

## Tasks / Subtasks

- [x] T1 — Réparer la suite fonctionnelle (AC 2)
  - [x] `ci.yml` et `scripts/test-local.sh` : `SESSION_DRIVER: memory` (commentaire : pourquoi, lien avec `sessionApiClient`).
  - [x] `home.spec.ts` : aligner les 2 tests sur le comportement actuel (`categories` = `PRODUCTION_CATEGORIES`, base vide ou non).
  - [x] Retirer `continue-on-error` et le commentaire « NON BLOQUANT » du step `Run functional tests`.
  - [x] `deferred-work.md` : marquer le ticket résolu (cause réelle). `tests/functional/admin/README.md` : corriger `--suite functional` (flag inexistant) → `node ace test functional`.
- [x] T2 — `ci.yml` réutilisable (AC 1)
  - [x] Ajouter `workflow_call` ; retirer `staging` des déclencheurs `push` (le gate du staging est l'appel depuis `deploy-staging.yml`, pas de double exécution). PR vers `development`/`staging`/`master` inchangées.
  - [x] Mettre à jour le commentaire « avant le déploiement Render ».
- [x] T3 — Révision exposée par `/health` (AC 5)
  - [x] `Dockerfile` : `ARG GIT_SHA=unknown` + `ENV ANTA_REVISION=$GIT_SHA` dans le stage runtime.
  - [x] `GET /health` → `{ status: 'ok', revision }` (via `env`, `ANTA_REVISION` optionnel dans `start/env.ts`). Test fonctionnel `health.spec.ts` mis à jour.
  - [x] Le health check du workflow exige `revision == SHA déployé` (sinon un ancien conteneur qui répond 200 ferait passer un déploiement raté).
- [x] T4 — Script distant `scripts/vps/staging-remote-deploy.sh`, installé en `/opt/anta/remote-deploy.sh` (AC 4, 5)
  - [x] Clé CI **restreinte** : ligne `authorized_keys` de `coffeechat` = `restrict,command="/opt/anta/remote-deploy.sh" ssh-ed25519 … anta-ci-deploy`. `coffeechat` a `sudo` : une clé CI non restreinte = root sur le VPS de Coffee Chat.
  - [x] Commande lue dans `SSH_ORIGINAL_COMMAND` : `deploy <image>` | `status`. Image validée par regex (`ghcr.io/atlastsl/ete-community--anta:<sha>` ou `anta:<sha>` local), rien d'autre n'est exécuté.
  - [x] `deploy` : stdin = archive tar(.gz) avec `compose.yaml`, `compose.staging.yaml` et, pour une image GHCR, `ghcr-token`. Extraction dans un `mktemp -d` (supprimé par `trap`) ; `DOCKER_CONFIG` temporaire pour `docker login ghcr.io --password-stdin` → `pull` → l'identifiant disparaît avec le dossier.
  - [x] Refuse si `/opt/anta/.env` est absent. Installe les fichiers Compose, écrit `image.env`, `up -d --no-build --wait --wait-timeout 180`, puis `curl` local `/health`.
  - [x] Échec → remet l'image précédente (`image.env` d'avant), relance, **sort en erreur** (workflow rouge, staging toujours servi). Succès → l'ancienne image est notée dans `image.env.previous`.
  - [x] Ménage : supprimer les images `ghcr.io/…anta` autres que la courante et la précédente.
- [x] T5 — `.github/workflows/deploy-staging.yml` (AC 1, 3, 4, 5)
  - [x] `on: push: [staging]` + `workflow_dispatch` (input `image_tag` : redéployer un SHA déjà sur GHCR = rollback, sans rebuild ni tests). `concurrency: deploy-staging` (pas d'annulation en cours de route). `permissions: contents: read` par défaut.
  - [x] Job `test` : `uses: ./.github/workflows/ci.yml` (sauté si `image_tag`).
  - [x] Job `image` (`needs: test`, `packages: write`) : `docker/setup-buildx-action`, `docker/login-action` (GHCR, `GITHUB_TOKEN`), `docker/build-push-action` (`push: true`, tags `:<sha>` + `:staging`, `build-args: GIT_SHA=<sha>`, cache `type=gha`).
  - [x] Job `deploy` (`environment: staging`, url `https://anta.peraha.com`, `packages: read`) : clé SSH et `known_hosts` depuis les secrets (pas de `StrictHostKeyChecking=no`), tar des fichiers Compose + jeton → `ssh coffeechat@$STAGING_HOST "deploy ghcr.io/…:<sha>"`, puis health check public avec retries (`/health`, `revision` attendue). Le job tourne si `image` a réussi ou si `image_tag` est fourni.
  - [x] Secrets de l'environnement GitHub `staging` : `STAGING_HOST`, `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`. Aucune IP ni secret dans le dépôt.
- [x] T6 — Outillage et docs (AC 4, 5)
  - [x] `scripts/vps/deploy-staging.sh` (manuel, clé admin) : installe/rafraîchit `/opt/anta/remote-deploy.sh` puis délègue le démarrage à ce script (même chemin que la CI) ; l'image locale `anta:<sha>` reste transférée par `docker save | docker load`.
  - [x] Clé de déploiement : générée sur le VPS de dev (`ed25519`, sans passphrase, hors dépôt), publique installée restreinte sur le VPS, privée + `ssh-keyscan` dans les secrets GitHub — **avec l'accord d'Aurélien** (écrit sur le VPS partagé et sur GitHub).
  - [x] `docs/staging-vps.md` : section CI/CD (schéma, secrets, rollback par `workflow_dispatch`, rotation de la clé) ; `docs/docker.md` si besoin.
  - [x] `tests/unit/infrastructure/deployment.spec.ts` : workflow (déclencheurs, `needs`, `uses: ./.github/workflows/ci.yml`, tag `github.sha`, `environment: staging`, pas de `StrictHostKeyChecking=no`), `ci.yml` (plus de `continue-on-error`, `SESSION_DRIVER: memory`, `workflow_call`), script distant (`set -euo pipefail`, regex d'image, `--no-build`, retour arrière, aucune IP).

## Dev Notes

### Ce qui existe déjà (ne pas refaire)
- 8.2 : `Dockerfile` (Node 24, multi-stage), `compose.yaml` (`image: ${ANTA_IMAGE:-anta:local}`), `GET /health`. 8.3 : `compose.staging.yaml`, `/opt/anta/{.env,image.env}` sur le VPS (Compose lancé avec `--env-file .env --env-file image.env`), `scripts/vps/deploy-staging.sh`, `docs/staging-vps.md`. Branche **`feat/8-4-ci-staging` sur `feat/8-3-staging-vps`** (rien n'est poussé, Aurélien teste l'Epic 8 d'un bloc).

### Schéma
```
merge development → staging
  └─ deploy-staging.yml
       test (ci.yml) ─► image (GHCR :sha) ─► deploy (SSH, clé restreinte)
                                               └─ remote-deploy.sh : pull, up --wait, /health
                                                   └─ échec : image précédente relancée, job rouge
       ─► curl https://anta.peraha.com/health (revision == sha)
```

### Pièges
- **Base partagée** : le conteneur lance `migration:run --force` au démarrage, sur Supabase partagée. Le retour arrière automatique relance l'ancien code sur un schéma déjà migré : correct tant que les migrations restent rétrocompatibles (`CLAUDE.local.md`).
- Nom d'image GHCR en minuscules : `ghcr.io/atlastsl/ete-community--anta` (le dépôt l'est déjà, mais utiliser une valeur fixe plutôt que `github.repository` pour coller à la regex du script distant).
- Un package GHCR créé par `GITHUB_TOKEN` est privé par défaut mais lié au dépôt : le `GITHUB_TOKEN` du job `deploy` (`packages: read`) suffit au `pull` ; il expire à la fin du job.
- Clé forcée (`command=`) : `scp` et les commandes arbitraires sont refusés, d'où les fichiers Compose envoyés dans le tar sur stdin.
- `docker compose up --wait` sort en erreur si le healthcheck échoue ; pas de `--no-build` = tentative de build sans contexte.
- Ne pas toucher aux conteneurs `coffeechat-*` ni au nginx (8.3 inchangé).
- Le job `deploy` ne doit pas tourner sur une PR ni depuis un fork (déclencheurs `push`/`workflow_dispatch` seulement ; l'environnement `staging` peut être restreint à la branche `staging`).

### Hors périmètre
- Fin de Render (`render.yaml`, service Render) → 8.5. Prod → 8.6. Protection de branche / reviewers d'environnement : réglages GitHub, à proposer à Aurélien.

### Project Structure Notes
- `.github/workflows/deploy-staging.yml` (nouveau), `.github/workflows/ci.yml`, `scripts/vps/staging-remote-deploy.sh` (nouveau), `scripts/vps/deploy-staging.sh`, `scripts/test-local.sh`, `Dockerfile`, `start/routes.ts`, `start/env.ts`, `tests/functional/{health,public/home}.spec.ts`, `tests/unit/infrastructure/deployment.spec.ts`, `docs/staging-vps.md`.

### References
- `_bmad-output/planning-artifacts/epics.md` § Story 8.4 (branche `docs/epic-8-vps-infra`)
- `_bmad-output/implementation-artifacts/deferred-work.md` § TICKET — Suite fonctionnelle
- `_bmad-output/implementation-artifacts/8-3-provisionnement-vps-staging.md`, `docs/staging-vps.md`
- `node_modules/@adonisjs/session/build/src/plugins/japa/api_client.js` (store memory du client de test)

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code), 2026-11-16

### Debug Log References

- Suite functional locale (Postgres `anta-test-db`, mêmes variables que la CI) : 81/171 avec `SESSION_DRIVER=cookie` → 169/171 avec `memory` → 171/171 après `home.spec.ts`. Total `unit functional` : 448/448. Lint + typecheck OK.
- `actionlint` (conteneur `rhysd/actionlint`) : 0 erreur sur `ci.yml` + `deploy-staging.yml` ; `shellcheck` : 0 remarque sur les scripts.
- VPS staging, via `deploy-staging.sh` (donc `remote-deploy.sh`) : `anta:ddef148` déployé, `https://anta.peraha.com/health` → `{"status":"ok","revision":"ddef148"}`, `image.env.previous` = `anta:bee44b9`.
- `remote-deploy.sh` par `SSH_ORIGINAL_COMMAND` (comme la clé forcée) : `status` OK ; `sh -c id` → refusé (2) ; `deploy anta:ddef148;id` → refusé (2) ; image GHCR sans jeton → refusé (2).
- Retour arrière : image `anta:badbad0` (CMD `exit 1`) → `unhealthy`, relance de `anta:ddef148` (healthy), sortie 1, staging servi tout du long sauf la fenêtre de recréation ; image de test supprimée.
- Non testable avant push : le workflow GitHub lui-même (GHCR, environnement `staging`, clé restreinte réelle).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Cause racine du ticket CI : `SESSION_DRIVER=cookie` exporté par la CI masquait `.env.test` (`memory`), store utilisé par le client de test. Pas un problème de transaction.
- `/health` renvoie `revision` (commit de l'image) : le health check public du workflow compare au SHA déployé.
- `deploy-staging.sh` (manuel) passe désormais par `remote-deploy.sh` : un seul chemin de démarrage, retour arrière compris ; il réinstalle aussi le script sur le VPS (la clé CI ne peut pas le modifier).
- 2026-11-16 (accord d'Aurélien) : clé `anta-ci-deploy` générée (copie `/home/atlas/.ssh/dev-staging/anta_ci_deploy`), installée `restrict,command="/opt/anta/remote-deploy.sh"` dans `authorized_keys` de `coffeechat` (fichier `root:root 644`, sauvegarde `authorized_keys.bak-anta-ci`). Testée : `status` OK ; `id`, lecture de `.env` → refusés ; `scp` → fermé ; redirection de port → `administratively prohibited`. Environnement GitHub `staging` (déploiements depuis la branche `staging` seulement) + secrets `STAGING_HOST`, `STAGING_KNOWN_HOSTS` (ed25519, empreinte vérifiée contre `/etc/ssh/ssh_host_ed25519_key.pub` du VPS), `STAGING_SSH_KEY`.
- Premier run réel du workflow : au merge sur `staging` (Epic 8 testé d'un bloc par Aurélien).

### File List

- `.github/workflows/deploy-staging.yml` (nouveau), `.github/workflows/ci.yml`
- `scripts/vps/staging-remote-deploy.sh` (nouveau), `scripts/vps/deploy-staging.sh`, `scripts/test-local.sh`
- `Dockerfile`, `start/env.ts`, `start/routes.ts`
- `tests/functional/health.spec.ts`, `tests/functional/public/home.spec.ts`, `tests/functional/admin/README.md`, `tests/unit/infrastructure/deployment.spec.ts`
- `docs/staging-vps.md`, `docs/docker.md`, `_bmad-output/implementation-artifacts/deferred-work.md`
- Hors dépôt (VPS) : `/opt/anta/remote-deploy.sh`, `/opt/anta/image.env.previous`, `~coffeechat/.ssh/authorized_keys`
- GitHub : environnement `staging` + 3 secrets
