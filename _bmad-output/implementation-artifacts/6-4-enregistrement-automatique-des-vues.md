# Story 6.4 : Enregistrement automatique des vues (10 secondes)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **système**,
je veux **enregistrer une vue uniquement si le visiteur reste sur la page de détail au moins 10 secondes**,
afin de **comptabiliser des consultations réelles et non des clics accidentels** (FR25, UX-DR10).

## Décision de périmètre (lire en premier)

- **`POST /stats/view` = beacon analytique public, EXEMPTÉ de CSRF** (décision dev 2026-06-02). La CSRF n'est pas une frontière de sécurité ici (le compteur est de toute façon gonflable en chargeant la page 10s) ; un beacon fire-and-forget exempté est le pattern standard et évite la lecture du cookie XSRF côté `fetch`. À ajouter dans `config/shield.ts` → `csrf.exceptRoutes: ['/stats/view']`.
- **`ViewTracker` réel** : `setTimeout(10000)` au montage → `POST /stats/view` → `clearTimeout` au démontage → **échec silencieux**. (Le stub no-op de la 6.1 est remplacé.)
- **`StatsService.recordView`** ajouté (le service existe depuis la 6.3 avec `recordDownload`).
- **Compteur de vues** : incrément **optimiste** côté client après enregistrement réussi (comme les téléchargements en 6.3), sans rechargement.
- **HORS périmètre** : agrégation / dashboards stats = **Epic 7** ; suite de tests consolidée = **6.5** (cette story fournit ses propres tests). Le téléchargement (6.3) est déjà fait.

## Acceptance Criteria

1. **Given** le composant `ViewTracker` est monté sur la page détail avec le `productionId`, **When** il s'initialise, **Then** un `setTimeout` de **10 000 ms** démarre immédiatement.
2. **Given** le visiteur reste sur la page ≥ 10 s, **When** le timeout s'écoule, **Then** `POST /stats/view` est appelé avec `productionId` ; **And** `StatsService.recordView` insère une ligne dans `stats_views` avec `production_id`, `recorded_at`, `ip_hash` **anonymisé** et `session_id`.
3. **Given** le visiteur quitte la page avant 10 s (navigation Inertia ou fermeture), **When** le composant est démonté, **Then** le `setTimeout` est nettoyé via `clearTimeout` **and** aucun `POST /stats/view` n'est effectué.
4. **Given** la vue est enregistrée avec succès, **When** le compteur de vues est affiché, **Then** il reflète la valeur mise à jour **sans rechargement** (incrément optimiste).
5. **Given** `POST /stats/view` échoue (erreur réseau/serveur), **When** la requête est rejetée, **Then** l'erreur est **silencieuse** côté visiteur (aucun message, aucune interruption de navigation).
6. **Given** `POST /stats/view` est appelé avec un `productionId` **invalide** (inexistant, non publié, ou format non-UUID), **When** le serveur traite la requête, **Then** une **404** est retournée et **aucune** vue n'est enregistrée.
7. **Given** la requête `POST /stats/view`, **When** elle aboutit, **Then** le serveur répond **204 No Content** (pas de corps ; ce n'est pas une réponse Inertia).

## Tasks / Subtasks

- [x] **Tâche 1 — `StatsService.recordView`** (AC: #2)
  - [x] `app/services/stats_service.ts` : `static async recordView(productionId: string, ip?: string | null, sessionId?: string | null): Promise<void>` → `StatsView.create({ productionId, recordedAt: DateTime.now(), ipHash: hashIp(ip), sessionId: sessionId ?? null })`. Réutiliser le `hashIp` privé existant. **Échec silencieux** (try/catch + `logger.error`), comme `recordDownload`. Importer `StatsView`.

- [x] **Tâche 2 — `StatsController.view`** (AC: #2, #6, #7)
  - [x] Créer `app/controllers/public/stats_controller.ts`, méthode `async view({ request, response, session })`.
  - [x] Lire `productionId = request.input('productionId')`. **Garde format UUID** (regex `^[0-9a-f-]{36}$` ou validateur) AVANT toute requête — sinon Postgres lève « invalid input syntax for type uuid » (500). Format invalide → `response.notFound()`.
  - [x] Charger la production **publiée** : `Production.query().where('id', productionId).where('status', 'published').first()`. Si null → `response.notFound()` (AC#6).
  - [x] `await StatsService.recordView(production.id, request.ip(), session.sessionId)` puis `return response.noContent()` (204, AC#7).

- [x] **Tâche 3 — Route + exemption CSRF** (AC: #2, #7)
  - [x] `start/routes.ts` : `router.post('/stats/view', [controllers.public.Stats, 'view']).as('stats.view')` (hors groupe admin ; route publique).
  - [x] `config/shield.ts` : `csrf.exceptRoutes: ['/stats/view']` (beacon public — voir décision de périmètre).

- [x] **Tâche 4 — `ViewTracker` réel** (AC: #1, #3, #4, #5)
  - [x] Remplacer le stub `inertia/components/public/ViewTracker.tsx` :
    ```tsx
    import { useEffect } from 'react'
    export default function ViewTracker({ productionId, onRecorded }: { productionId: string; onRecorded?: () => void }) {
      useEffect(() => {
        const timer = setTimeout(() => {
          fetch('/stats/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ productionId }),
          })
            .then((res) => { if (res.ok) onRecorded?.() })
            .catch(() => {}) // échec silencieux (AC#5)
        }, 10_000)
        return () => clearTimeout(timer) // AC#3
      }, [productionId])
      return null
    }
    ```

- [x] **Tâche 5 — Compteur de vues optimiste** (AC: #4)
  - [x] `inertia/pages/production.tsx` : `viewsCount` en **state local** (`useState(production.viewsCount)`), affiché dans l'aside (remplacer `production.viewsCount`). Passer `onRecorded={() => setViewsCount((n) => n + 1)}` à `<ViewTracker />`.

- [x] **Tâche 6 — Tests** (AC: #2, #6, #7)
  - [x] `tests/functional/public/stats_view.spec.ts` (transaction globale) :
    - [x] `POST /stats/view` avec `productionId` d'une production **publiée** → **204** + **1 ligne** dans `stats_views` (avec `ip_hash` haché 64 hex, `session_id` non vide). _CSRF : la route étant exemptée, pas besoin de `.withCsrfToken()`._
    - [x] `productionId` d'une production **non publiée** → 404 + 0 ligne.
    - [x] `productionId` **inexistant** (UUID valide mais absent) → 404.
    - [x] `productionId` **format invalide** (`"abc"`) → 404 (pas de 500).
  - [x] `tests/unit/services/stats_service.spec.ts` (étendre) : `recordView` insère `stats_views` avec `ipHash` haché + `sessionId` ; IP nulle → `ipHash` null.
  - [x] (Source TS6305) `tests/unit/components/view_tracker.spec.ts` : `ViewTracker.tsx` contient `setTimeout`, `10_000` (ou `10000`), `clearTimeout`, `/stats/view`, `.catch(` (échec silencieux), `onRecorded`.
  - [x] `tests/unit/infrastructure/config_files.spec.ts` (si pertinent) : vérifier `shield.ts` exempte `/stats/view` (optionnel, garde-fou).
  - [x] `node ace test unit` + `node ace test functional`, lint, typecheck verts.

## Dev Notes

### État issu de 6.1/6.2/6.3 (point de départ)
- `ViewTracker` existe en **stub no-op** (6.1) : `function ViewTracker({ productionId }) { void productionId; return null }`. **À remplacer** par la logique réelle + prop `onRecorded`. [Source: inertia/components/public/ViewTracker.tsx]
- `production.tsx` monte déjà `<ViewTracker productionId={production.id} />` et gère `downloadsCount` en state optimiste (6.3) — **répliquer le même pattern pour `viewsCount`**. [Source: inertia/pages/production.tsx]
- `StatsService` existe (6.3) avec `recordDownload` + `hashIp` privé → **ajouter `recordView`** (même pattern, même `hashIp`). [Source: app/services/stats_service.ts]
- `StatsDownload` download endpoint (6.3) = bon modèle de contrôleur stats (404 + service). `StatsView` model : `{ productionId, recordedAt, ipHash, sessionId }`. [Source: app/models/stats_view.ts]

### CSRF — pourquoi exempter `/stats/view`
- Shield : `csrf.enabled = true`, méthodes incluent POST, `enableXsrfCookie: true`, `exceptRoutes: []`. [Source: config/shield.ts]
- Le beacon `/stats/view` est public et fire-and-forget. Exiger un token XSRF imposerait au `fetch` de lire/décoder le cookie XSRF-TOKEN — fragile pour peu de valeur (le compteur est gonflable de toute façon). **Exempter** est le pattern beacon standard. C'est la **seule** route publique POST exemptée ; les formulaires admin restent protégés. [Décision 2026-06-02]

### Endpoint — robustesse
- **Garde UUID obligatoire** avant la requête : un `productionId` non-UUID passé à `where('id', ...)` fait lever Postgres (« invalid input syntax for type uuid ») → 500. Valider le format (regex ou VineJS) → 404 si invalide (AC#6).
- Réponse **204** (`response.noContent()`) : le client `fetch` lit juste `res.ok`. Ce n'est PAS une réponse Inertia (pas de `inertia.render`).
- `session.sessionId` fournit l'identifiant de session pour `stats_views.session_id`. [Source: AdonisJS session]
- `request.ip()` → IP à hacher via `StatsService.hashIp` (déjà en place). IP jamais stockée en clair.

### ViewTracker — détails
- `useEffect(() => {... return cleanup}, [productionId])` : timer démarré au montage, **nettoyé au démontage** (navigation Inertia = démontage du composant de page → `clearTimeout`). Aucune requête si départ < 10 s (AC#3).
- **Échec silencieux** : `.catch(() => {})` — aucune UI d'erreur (AC#5). N'utilise PAS le router Inertia (réponse 204 non-Inertia) → `fetch` natif.
- `credentials: 'same-origin'` pour transmettre les cookies de session (alimente `session_id`).
- **Idempotence par page-vue** : le timer ne se déclenche qu'une fois (deps `[productionId]`) ; un re-render ne relance pas. Pas de garde « 1 vue par session » demandée (FR25 = vue après 10 s ; la dédup éventuelle relève de l'Epic 7 si besoin).

### Conventions (rappel)
- `ssr: false` → `ViewTracker` testé par **source** (TS6305). Props Inertia directes ; alias `~/`. [Source: project_anta_status.md]
- Tests stats : transaction globale + `StatsView.query()` pour compter. Gotcha BDD : Supabase pollué en local ; functional `continue-on-error` en CI (Epic 8) — viser le vert local, ne pas régresser l'unit. [Source: project_anta_status.md]
- Nouveau contrôleur `StatsController` → codegen `.adonisjs` régénéré au boot `node ace test` (committer).

### Stories suivantes (ne PAS implémenter ici)
- 6.5 : suite de tests consolidée (peut réutiliser/compléter ceux-ci). Epic 7 : agrégation des stats, dédup éventuelle, dashboards admin.

### Project Structure Notes
- Nouveaux : `app/controllers/public/stats_controller.ts`, `tests/functional/public/stats_view.spec.ts`, `tests/unit/components/view_tracker.spec.ts`. Modifiés : `stats_service.ts` (`recordView`), `start/routes.ts`, `config/shield.ts`, `ViewTracker.tsx`, `production.tsx`, `tests/unit/services/stats_service.spec.ts`. Régénéré : `.adonisjs/server/controllers.ts`.
- Aucune migration, aucune dépendance.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4, #Story 6.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR25, #UX-DR10]
- [Source: _bmad-output/planning-artifacts/architecture.md:207, :885 (StatsController → recordView)]
- [Source: config/shield.ts ; app/services/stats_service.ts ; app/models/stats_view.ts]
- [Source: inertia/components/public/ViewTracker.tsx ; inertia/pages/production.tsx]
- [Source: app/controllers/public/productions_controller.ts#download (modèle contrôleur stats)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅.
- `node ace test functional --files=stats_view.spec.ts` → 5/5 (régénère le codegen `controllers.ts` pour `StatsController`).
- `node ace test unit --files=stats_service.spec.ts view_tracker.spec.ts` → 8/8.
- Suites complètes : unit 217✓/14✗ (+5 nouveaux verts ; 14 = échecs connus pollution Supabase, 0 nouveau) ; functional 133✓/26✗ (+5 nouveaux verts ; 26 = pollution connue, 0 nouveau). Aucune régression.

### Completion Notes List

- **`StatsService.recordView`** ajouté (réutilise `hashIp`) : insère `stats_views` avec `ipHash` anonymisé + `sessionId` ; échec silencieux.
- **`StatsController.view`** : garde **format UUID** sur `productionId` (évite le 500 Postgres « invalid uuid »), 404 si invalide/inexistant/non publié, sinon `recordView(id, request.ip(), session.sessionId)` + **204** (`response.noContent()`).
- **Route `POST /stats/view`** + **exemption CSRF** dans `config/shield.ts` (`exceptRoutes: ['/stats/view']`) — beacon public fire-and-forget ; seule route publique POST exemptée, formulaires admin toujours protégés.
- **`ViewTracker` réel** : `setTimeout(10_000)` → `fetch('/stats/view', POST)` → `clearTimeout` au démontage (navigation < 10s → aucune vue) → **échec silencieux** (`.catch`). `onRecorded` stocké en **ref** → le timer ne dépend que de `productionId` (un re-render parent ne réinitialise pas le décompte).
- **Compteur de vues optimiste** : `viewsCount` en state dans `production.tsx`, incrémenté via `onRecorded` (sans rechargement — AC#4).
- Pas d'i18n (composant invisible). Aucune migration, aucune dépendance.

### File List

**Créés :**
- `app/controllers/public/stats_controller.ts`
- `tests/functional/public/stats_view.spec.ts`
- `tests/unit/components/view_tracker.spec.ts`

**Modifiés :**
- `app/services/stats_service.ts` (`recordView` + import `StatsView`)
- `start/routes.ts` (route `stats.view`)
- `config/shield.ts` (`csrf.exceptRoutes: ['/stats/view']`)
- `inertia/components/public/ViewTracker.tsx` (stub → logique réelle)
- `inertia/pages/production.tsx` (`viewsCount` optimiste + `onRecorded`)
- `tests/unit/services/stats_service.spec.ts` (tests `recordView`)
- **Régénéré (codegen)** : `.adonisjs/server/controllers.ts`

### Change Log

- 2026-06-02 : Implémentation Story 6.4 — enregistrement des vues après 10s (ViewTracker timer + POST /stats/view beacon CSRF-exempt + StatsService.recordView, IP anonymisée + session_id, compteur optimiste). Statut → review.
