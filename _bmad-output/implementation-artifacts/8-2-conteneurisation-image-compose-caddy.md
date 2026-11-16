# Story 8.2 : Conteneurisation de l'application (image + Compose + Caddy)

Status: done

## Story

En tant que développeur,
Je veux une image Docker de production et un fichier Compose avec Caddy,
Afin que staging et production exécutent exactement le même artefact.

## Acceptance Criteria

1. **Given** un `Dockerfile` multi-stage (Node 22 : build `node ace build`, puis image runtime avec `npm ci --omit=dev` dans `build/`)
   **When** l'image est construite
   **Then** elle démarre avec `node ace migration:run --force && node bin/server.js` et écoute sur `PORT`
   **And** elle tourne avec un utilisateur non-root
2. **Given** un `compose.yaml` (services `app` et `caddy`) et un `Caddyfile` paramétré par domaine
   **When** `doppler run -- docker compose up -d` est exécuté sur un hôte
   **Then** Caddy sert l'app en HTTPS avec un certificat Let's Encrypt automatique et redirige HTTP → HTTPS (NFR4)
   **And** la limite de corps de requête accepte les uploads de 110 Mo (parité avec `bodyparser`)
   **And** les logs des conteneurs sont plafonnés (driver `json-file`, `max-size`/`max-file`)

> Écart assumé : **Node 24** au lieu de Node 22 — `package.json` exige `engines.node >=24`, et `.nvmrc` + la CI sont en 24 (Story 8.1). L'architecture (`Node 22`) est à corriger au prochain passage.

## Tasks / Subtasks

- [x] T1 — `Dockerfile` multi-stage + `.dockerignore` (AC 1)
  - [x] Étage `build` : `npm ci` (avec `.npmrc` `include=dev`) puis `node ace build`
  - [x] Étage `runtime` : copie de `build/` seulement, `npm ci --omit=dev` **sans** `.npmrc` (son `include=dev` l'emporterait sur `--omit=dev`), `USER node`
  - [x] `CMD` : `node ace migration:run --force && exec node bin/server.js` (migrations en JS compilé depuis `build/`, `exec` pour que Node reçoive SIGTERM)
  - [x] `.dockerignore` : `.env*`, `node_modules`, `build`, `.git`, doc, BMad
- [x] T2 — `compose.yaml` (AC 2)
  - [x] `app` : variables reprises de Doppler (listées sans valeur, pas d'`env_file`), `NODE_ENV/HOST/PORT/TZ` fixés, aucun port publié, health check `GET /health`
  - [x] `caddy` : `caddy:2-alpine`, ports `${HTTP_PORT:-80}`/`${HTTPS_PORT:-443}` (+ UDP pour HTTP/3), volumes `caddy_data`/`caddy_config`, `DOMAIN` requis
  - [x] Logs `json-file` `max-size: 10m`, `max-file: 5` sur les deux services
- [x] T3 — `Caddyfile` (AC 2) : site `{$DOMAIN}`, `request_body max_size 110MiB` (= `bodyparser` `110mb`, unité binaire), `encode zstd gzip`, `reverse_proxy app:3333`
- [x] T4 — Ajustements app requis par le proxy
  - [x] `trustProxy: proxyAddr.compile(['loopback', 'uniquelocal'])` dans `config/app.ts` (dépendance `proxy-addr` explicite + `@types/proxy-addr`) : sinon `request.ip()` (stats vues/téléchargements) = IP de Caddy
  - [x] Route `GET /health` → `{ status: 'ok' }` (sans base) pour le health check Compose et le déploiement (8.4)
- [x] T5 — Tests et validation
  - [x] `tests/functional/health.spec.ts`, `tests/unit/infrastructure/deployment.spec.ts` (garde-fous fichiers + `trustProxy`)
  - [x] Stack complète en local (override hors dépôt avec Postgres jetable, `DOMAIN=localhost`, ports 18080/18443)
- [x] T6 — Documentation : `docs/docker.md`

## Dev Notes

- Le certificat Let's Encrypt réel ne peut être vérifié qu'avec un domaine public pointant sur l'hôte : validation en Story 8.3 (`anta.peraha.com`). En local, `DOMAIN=localhost` fait utiliser à Caddy sa CA interne (même chemin de config).
- Caddy écrase l'en-tête `X-Forwarded-For` reçu du client (pas de `trusted_proxies`) : pas d'usurpation d'IP possible depuis l'extérieur.
- Image : 711 Mo. Vite/TypeScript/assembler restent en runtime car ce sont des **peer dependencies** des paquets `@adonisjs/*` (installées par npm 7+). Optimisation possible en V2 (`--omit=peer` à évaluer prudemment).
- Le builder legacy de Docker (pas de buildx sur ce VPS) ignore la ligne `# syntax=` ; sans effet.
- `render.yaml` reste en place jusqu'à la Story 8.5.

### References
- `_bmad-output/planning-artifacts/epics.md` § Story 8.2 (branche `docs/epic-8-vps-infra`, PR #11)
- `_bmad-output/planning-artifacts/architecture.md` § Phase finale — VPS
- `config/bodyparser.ts` (limite 110 Mo), `render.yaml` (ancienne commande de démarrage)

## Dev Agent Record

### Agent Model Used

claude-opus-5-5

### Debug Log References

- `docker build` : OK, Node 24.22.3, `id -u -n` = `node`.
- Stack locale (`docker compose -f compose.yaml -f <override> up -d`) : migrations OK, `app` healthy ; `http://` → 308 vers `https://` ; `/`, `/admin/login`, asset Vite → 200 ; cookies `Secure` ; corps de 105 Mo transmis à l'app (404 attendu), 116 Mo → 413 par Caddy ; `LogConfig` = `json-file` `max-file:5 max-size:10m` ; aucun port publié pour `app`.

### Completion Notes List

- `npm run test:local -- unit` : 262/262 ✅ (5 nouveaux).
- `npm run test:local -- functional` : 81 ✅ / 90 ❌ — même échec connu qu'en 8.1 (`loginAs`/transaction globale, Story 8.4) ; le nouveau `health.spec.ts` passe.
- `npm run typecheck` et lint des fichiers modifiés verts.
- 2026-11-16 : PR mergées (#12–#16, #18 sur `development` ; #19 sur `staging`), premier run de `deploy-staging.yml` vert (`/health` → `revision` 81d9e07). Recette de l'Epic 8 validée par Aurélien. Story → done.

### File List

- `Dockerfile` (nouveau)
- `.dockerignore` (nouveau)
- `compose.yaml` (nouveau)
- `Caddyfile` (nouveau)
- `config/app.ts`
- `start/routes.ts`
- `package.json`, `package-lock.json` (`proxy-addr`, `@types/proxy-addr`)
- `tests/functional/health.spec.ts` (nouveau)
- `tests/unit/infrastructure/deployment.spec.ts` (nouveau)
- `docs/docker.md` (nouveau)
- `_bmad-output/implementation-artifacts/8-2-conteneurisation-image-compose-caddy.md` (nouveau)
