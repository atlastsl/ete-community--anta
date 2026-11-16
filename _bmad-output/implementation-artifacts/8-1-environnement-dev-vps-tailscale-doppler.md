# Story 8.1 : Environnement de développement sur VPS (Tailscale + Doppler)

Status: done

## Story

En tant que développeur,
Je veux lancer Anta en mode dev sur le VPS de développement et l'ouvrir depuis mon PC via Tailscale,
Afin de développer sans dépendre de mon poste local ni d'un fichier `.env`.

## Acceptance Criteria

1. **Given** un projet Doppler `anta` avec une config `dev` contenant toutes les variables de `.env.example`
   **When** `doppler run -- npm run dev` est exécuté dans le dépôt du VPS (`PORT=3333`, `HOST=127.0.0.1`)
   **Then** l'application démarre sans fichier `.env` sur disque
   **And** aucun secret n'est écrit dans le dépôt ni dans les fichiers du workspace
2. **Given** `tailscale serve` expose le port 3333 sur un port HTTPS libre du tailnet (hors 443, 8443 et 10000, déjà pris)
   **When** j'ouvre l'URL `https://vmi3733843.tail39fe0e.ts.net:<port>` depuis le PC
   **Then** le site public et l'admin fonctionnent
   **And** le HMR de Vite se recharge à travers le proxy (`vite.config.ts` ajusté si nécessaire)
   **And** l'URL n'est pas joignable hors du tailnet
3. **Given** la base Supabase est partagée avec le staging
   **When** je travaille en dev
   **Then** les règles « base partagée » sont documentées dans `CLAUDE.local.md` et dans `docs/` : pas de rollback/fresh/reset/wipe, migrations rétrocompatibles uniquement
   **And** `node ace test` tourne contre un Postgres local jetable (Docker, base `anta_test`, mêmes valeurs que la CI), jamais contre Supabase

## Tasks / Subtasks

- [x] T1 — Node 24 pour `atlas` (prérequis : `engines.node >=24.0.0`) (AC 1)
  - [x] `nvm install 24` (utilisateur `atlas`) ; ajouter `.nvmrc` = `24` à la racine du dépôt (aligné sur la CI `node-version: '24'`)
  - [x] `npm ci` sous Node 24 si `node_modules` a été installé avec une autre version
- [x] T2 — Projet Doppler `anta` / config `dev` (AC 1)
  - [x] `doppler projects create anta` (crée les environnements dev/stg/prd ; `stg`/`prd` restent vides, ils servent aux stories 8.3/8.6)
  - [x] Renseigner les **valeurs non secrètes** par CLI : `TZ=UTC`, `PORT=3333`, `HOST=127.0.0.1`, `NODE_ENV=development`, `LOG_LEVEL=info`, `APP_NAME=Anta`, `VITE_APP_NAME=Anta`, `APP_URL=https://vmi3733843.tail39fe0e.ts.net:9443`, `SESSION_DRIVER=cookie`, `SESSION_AGE=2h`, `DB_SSL=true`, `R2_BUCKET`, `MAIL_MAILER=mailgun`, `MAIL_FROM_*`, `MAILGUN_DOMAIN`, `SUPER_ADMIN_EMAIL`, `VITE_HMR_CLIENT_PORT=9444`
  - [x] **Action Aurélien** : saisir les secrets dans le dashboard Doppler (jamais via un fichier ni le chat) : `APP_KEY`, `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_DATABASE` (pooler Supabase du staging), `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `MAILGUN_API_KEY`, `RESEND_API_KEY` (optionnel), `SUPER_ADMIN_PASSWORD` (optionnel)
  - [x] `doppler setup --project anta --config dev` dans le dépôt (scope local à `/home/atlas/projects/anta`, stocké dans `~atlas/.doppler`, pas dans le dépôt)
  - [x] Vérifier : comparaison des noms `.env.example` ↔ `doppler secrets --only-names` = aucun manquant
- [x] T3 — HMR à travers `tailscale serve` (AC 2)
  - [x] `vite.config.ts` : si `VITE_HMR_CLIENT_PORT` est défini, `server.hmr = { protocol: 'wss', clientPort: Number(VITE_HMR_CLIENT_PORT) }` ; sinon rien (dev local inchangé)
  - [x] Ne pas déclarer `VITE_HMR_CLIENT_PORT` dans `start/env.ts` (variable lue uniquement par Vite) ; l'ajouter commentée dans `.env.example`
- [x] T4 — Exposition tailnet (AC 2)
  - [x] `tailscale serve --bg --https=9443 http://127.0.0.1:3333`
  - [x] `tailscale serve --bg --https=9444 http://127.0.0.1:24678` (WebSocket HMR de Vite, port par défaut d'`@adonisjs/vite` en `middlewareMode`)
  - [x] Vérifier `tailscale serve status` : les deux entrées en « tailnet only », **pas** de `tailscale funnel`
- [x] T5 — Postgres de test jetable (AC 3)
  - [x] Script `npm run test:db` (ou doc) : `docker run -d --name anta-test-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=anta_test -p 127.0.0.1:5433:5432 postgres:16` (5433 : éviter tout conflit futur sur 5432)
  - [x] Lancer les tests avec les **mêmes valeurs que la CI** (bloc `env:` de `.github/workflows/ci.yml`, `DB_PORT=5433`), **sans** `doppler run` — pour qu'aucune variable Supabase ne puisse fuiter dans les tests
  - [x] `node ace migration:run --force` puis `node ace test unit` et `node ace test functional` contre `anta_test`
- [x] T6 — Documentation (AC 3)
  - [x] `docs/dev-vps.md` : prérequis, `doppler run -- npm run dev`, ports tailnet, HMR, tests locaux, règles base partagée
  - [x] `CLAUDE.local.md` (déjà réécrit le 2026-11-15, ignoré par git via `.git/info/exclude`) : vérifier qu'il couvre les règles ; y ajouter les ports et la commande de test
- [x] T7 — Validation manuelle (AC 1, 2)
  - [x] `doppler run -- npm run dev` démarre ; `ls .env` → absent
  - [x] Depuis le PC : page d'accueil, une page détail, `/admin/login` + connexion OK (cookie de session sur HTTPS)
  - [x] Modifier un composant React → rechargement à chaud visible sans F5
  - [x] Hors tailnet (téléphone en 4G sans Tailscale) : URL injoignable

## Dev Notes

### Contexte
- Epic 8 réorientée le 2026-11-15 (`sprint-change-proposal-2026-11-15.md`, PR #11) : 8.1 dev VPS, 8.2 Docker+Caddy, 8.3 staging `anta.peraha.com`, 8.4 CI GHCR, 8.5 fin de Render, 8.6 prod. Cette story ne touche **ni** Docker de l'app, **ni** Caddy, **ni** la CI.
- Tableau des environnements : `architecture.md` § « Phase finale — VPS ».

### Garde-fous
- **Jamais de `.env`** sur disque, ni de secret dans le dépôt, `docs/`, le workspace Harness ou la mémoire. Tout passe par Doppler `anta/dev`.
- **Base Supabase partagée avec le staging** : interdits `migration:rollback|fresh|reset`, `db:wipe`, seeders destructifs (le seeder démo `SEED_DEMO` crée 300 productions : ne pas le lancer sur la base partagée sans accord). Migrations expand/contract uniquement.
- R2 et Mailgun sont réels en dev : un upload crée un vrai fichier, un reset de mot de passe envoie un vrai e-mail.
- Le Doppler CLI est connecté sous l'utilisateur **`atlas`** (pas root) : toutes les commandes `doppler` / `npm run dev` se lancent via `sudo -u atlas -H …`.
- Node de root (`/usr/local/bin/node`, v22) appartient à Harness Maxxing : ne pas l'utiliser pour Anta.

### Détails techniques
- `start/env.ts` (Adonis `Env.create`) valide les variables ; l'absence de fichier `.env` est tolérée, les variables d'environnement du process suffisent.
- `HOST=127.0.0.1` : le serveur n'écoute qu'en local, seul `tailscale serve` l'expose. `APP_URL` doit valoir l'URL tailnet (liens dans les e-mails, SEO canonical).
- Cookies de session : derrière le proxy HTTPS Tailscale, le navigateur voit HTTPS ; vérifier que la connexion admin fonctionne (pas de `secure` forcé en dev qui casserait, pas de `trustProxy` nécessaire pour le cookie).
- HMR : `@adonisjs/vite` (`build/chunk-*.js`) crée Vite en `middlewareMode` avec `hmr: { port: VITE_HMR_PORT }` si défini, sinon port par défaut 24678. Le client doit se connecter en `wss://<host>:9444` → `server.hmr.clientPort` + `protocol: 'wss'`.
- Shield CSRF / CSP : vérifier qu'aucune politique ne bloque `wss://…:9444` (sinon ajuster la config en dev uniquement).

### Fichiers attendus
- Nouveaux : `.nvmrc`, `docs/dev-vps.md`
- Modifiés : `vite.config.ts`, `.env.example`, éventuellement `package.json` (script `test:db`)
- Hors dépôt : `CLAUDE.local.md`, config Doppler, `tailscale serve`

### Tests
- Pas de nouveau test automatisé (infra). Preuve = T5 (suites unit + functional contre `anta_test`, noter le résultat — la suite fonctionnelle est connue instable en CI, cf. `deferred-work.md`) + checklist manuelle T7.
- `npm run lint` et `npm run typecheck` verts.

### References
- `_bmad-output/planning-artifacts/epics.md` § Story 8.1
- `_bmad-output/planning-artifacts/architecture.md` § Phase finale — VPS
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-15.md`
- `.github/workflows/ci.yml` (valeurs de test)

## Dev Agent Record

### Agent Model Used

claude-opus-5-5

### Debug Log References

- Vite 7 bloquait l'hôte tailnet (403 « Blocked request ») → `server.allowedHosts` dérivé de `APP_URL`, actif seulement avec `VITE_HMR_CLIENT_PORT`.
- HMR vérifié à travers le proxy : `wss://…:9444/?token=…` → 101 Switching Protocols ; `/@vite/client` → `hmrPort = 9444`, `socketProtocol = "wss"`.
- Le WebSocket HMR écoute sur `*:24678` mais ufw (INPUT DROP, rien d'ouvert hors 22 et tailscale0) le bloque de l'extérieur.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-11-15 : Node 24.22.3 installé via nvm (`atlas`), `npm ci` refait. Projet Doppler `anta` créé (dev/stg/prd) ; `dev` : valeurs non secrètes + `APP_KEY` généré directement dans Doppler ; dépôt lié (`doppler setup`). Manquent les secrets Supabase/R2/Mailgun (action Aurélien).
- `tailscale serve` : 9443 → 3333, 9444 → 24678, tous deux « tailnet only ».
- Smoke test : `doppler run -- npm run dev` (DB/R2 surchargés vers la base de test locale) → `/` et `/admin/login` 200 via l'URL tailnet, sans `.env`.
- `npm run test:local` : unit 257/257 ✅ ; functional 80 ✅ / 90 ❌ — identique à l'échec connu de la CI (`loginAs`/transaction globale, `deferred-work.md`), traité en Story 8.4. Lint + typecheck verts.
- 2026-11-16 : PR mergées (#12–#16, #18 sur `development` ; #19 sur `staging`), premier run de `deploy-staging.yml` vert (`/health` → `revision` 81d9e07). Recette de l'Epic 8 validée par Aurélien. Story → done.

### File List

- `.nvmrc` (nouveau)
- `vite.config.ts`
- `.env.example`
- `package.json` (script `test:local`)
- `scripts/test-local.sh` (nouveau)
- `docs/dev-vps.md` (nouveau)
- `_bmad-output/implementation-artifacts/8-1-environnement-dev-vps-tailscale-doppler.md` (nouveau)
- Hors dépôt : `CLAUDE.local.md`, Doppler `anta/dev`, `tailscale serve`
