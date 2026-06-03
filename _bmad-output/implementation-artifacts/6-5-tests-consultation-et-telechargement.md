# Story 6.5 : Tests consultation et téléchargement (clôture Epic 6)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **développeur**,
je veux **une suite de tests couvrant la page de détail, les lecteurs, le téléchargement et l'enregistrement des stats**,
afin de **garantir la fiabilité de la consultation et la précision des métriques** (clôture Epic 6).

## Décision de périmètre (lire en premier)

- **La couverture a été construite au fil des stories 6.1→6.4** (TDD par story). La majorité des scénarios de l'epic 6.5 sont **déjà testés et verts**. Cette story **ne duplique PAS** les tests existants : elle (a) **comble le seul vrai manque** — l'agrégation des compteurs sur la **page détail** — (b) **renforce** une assertion (URL signée au download), (c) **documente la carte de couverture** de l'Epic 6, (d) fait le **sweep final** des suites.
- **Écart de nommage assumé** : l'epic cite `StatsController.spec.ts` / `ProductionsController.spec.ts`. Le repo utilise un fichier par préoccupation (`stats_view.spec.ts`, `download.spec.ts`, `productions.spec.ts`, `stats_service.spec.ts`). On **garde cette organisation** (cohérente avec le reste du repo) — pas de renommage/duplication.
- **HORS périmètre** : agrégation/dashboards admin = **Epic 7** ; tests navigateur réels (Playwright, suite `browser`) = Phase 2.

## Acceptance Criteria

1. **Given** une production publiée avec **N vues** et **M téléchargements** enregistrés, **When** `GET /productions/:slug` est appelé, **Then** `props.production.viewsCount === N` et `downloadsCount === M` (agrégation `withAggregate` correcte sur la page détail).
2. **Given** une production sans aucune stat, **When** la page détail se charge, **Then** `viewsCount === 0` et `downloadsCount === 0`.
3. **Given** un téléchargement réussi, **When** l'endpoint répond, **Then** l'en-tête `Location` du 302 est une **URL signée non vide** (R2) — la signature est bien retournée.
4. **Given** la suite complète de l'Epic 6, **When** `node ace test unit` et `node ace test functional` sont exécutés, **Then** tous les scénarios 6.5 sont couverts par des tests **verts** (hors échecs locaux connus de pollution Supabase, verts en CI propre).
5. **Given** la clôture de l'epic, **When** la story est livrée, **Then** une **carte de couverture** liste chaque scénario de l'epic 6 et le test qui le couvre (traçabilité).

## Tasks / Subtasks

- [x] **Tâche 1 — Test d'agrégation des compteurs sur la page détail** (AC: #1, #2)
  - [x] Étendre `tests/functional/public/productions.spec.ts` (groupe page détail) : créer une production **publiée**, lui ajouter **N `StatsView`** + **M `StatsDownload`** (helpers locaux `addViews`/`addDownloads` comme dans `listing.spec.ts`), puis `GET /productions/:slug` → asserter `props.production.viewsCount === N` et `downloadsCount === M`.
  - [x] Cas zéro : production publiée sans stat → `viewsCount === 0`, `downloadsCount === 0`.

- [x] **Tâche 2 — Renfort assertion URL signée au download** (AC: #3)
  - [x] Dans `tests/functional/public/download.spec.ts`, sur le cas succès (302), asserter que `response.headers().location` (ou `assertHeader('location', ...)`) est une **chaîne non vide** contenant la clé/host R2 fake (ex. `assert.isString` + `assert.isNotEmpty`). Confirme que la signature est retournée (AC#3 de l'epic « Téléchargement → URL signée R2 retournée »).

- [x] **Tâche 3 — Carte de couverture Epic 6** (AC: #5)
  - [x] Créer `_bmad-output/implementation-artifacts/epic-6-coverage.md` : tableau scénario epic 6 → fichier(s) de test → statut. Couvrir : page détail (200/404 ×3, métadonnées), lecteurs (PDF/EPUB/MP4/MP3/AAC via MediaViewer, URLs signées), téléchargement (302, stats_downloads, 404 ×3, ip_hash, URL signée), liens (embed/simple), vues (POST /stats/view 204/404, recordView, ViewTracker timer/cleanup/silent), StatsService (recordView/recordDownload, ip_hash anonymisé), agrégation compteurs (détail + listing).

- [x] **Tâche 4 — Sweep final + documentation des résultats** (AC: #4)
  - [x] `npm run typecheck`, `npm run lint`, `node ace test unit`, `node ace test functional` → consigner les compteurs dans le Dev Agent Record. Confirmer que les **seuls** échecs locaux sont les échecs connus de pollution Supabase (search_service ×12, super_admin ×2 ; functional ×26) — **aucun** lié à l'Epic 6.

## Dev Notes

### Couverture DÉJÀ en place (6.1→6.4) — ne PAS dupliquer
| Scénario epic 6.5 | Couvert par | Statut |
|---|---|---|
| Page détail publiée → 200 + métadonnées | `tests/functional/public/productions.spec.ts` (groupe « page détail (slug) ») | ✅ |
| Page détail brouillon/dépubliée/inexistante → 404 | idem (3 tests) | ✅ |
| Fichiers → URLs signées (lecteurs) | `productions.spec.ts` (groupe « lecteurs de médias ») | ✅ |
| MediaViewer dispatch PDF/EPUB/MP4/MP3/AAC | `tests/unit/components/media_viewer.spec.ts` (source) | ✅ |
| PdfViewer iframe | `media_viewer.spec.ts` | ✅ |
| POST /stats/view valide → 204 + stats_views | `tests/functional/public/stats_view.spec.ts` | ✅ |
| POST /stats/view invalide/non publié/format → 404 | `stats_view.spec.ts` (4 cas) | ✅ |
| POST download valide → 302 + stats_downloads | `tests/functional/public/download.spec.ts` | ✅ |
| Download 404 (brouillon/fichier étranger/inexistant) | `download.spec.ts` (3 cas) | ✅ |
| ip_hash anonymisé (download) | `download.spec.ts` | ✅ |
| recordView / recordDownload + ip_hash anonymisé | `tests/unit/services/stats_service.spec.ts` | ✅ |
| ViewTracker timer 10s / clearTimeout / silencieux | `tests/unit/components/view_tracker.spec.ts` (source) | ✅ |
| Liens embed (sandbox) / simple (rel noopener) | `media_viewer.spec.ts` (lecture de `production.tsx`) | ✅ |
| Agrégation vues sur listing (tri) | `tests/functional/public/listing.spec.ts` (`addViews`) | ✅ |
| **Agrégation compteurs sur page DÉTAIL** | **MANQUE → Tâche 1** | ➕ |
| **URL signée retournée au download (Location)** | **partiel → Tâche 2** | ➕ |

### Helpers à réutiliser
- `addViews(production, count)` / `addDownloads(production, count)` : copier le pattern de `tests/functional/public/listing.spec.ts:24-42` (boucle `StatsView.create` / `StatsDownload.create` avec `ipHash` factice). [Source: tests/functional/public/listing.spec.ts]
- `extractProps(body)` + `createProduction(...)` : déjà dans `productions.spec.ts`. [Source: tests/functional/public/productions.spec.ts]
- Agrégation testée : la requête `show` utilise `withAggregate('statsViews', q => q.count('*').as('viewsCount'))` → le test crée des lignes et vérifie le compte sérialisé (`Number(p.$extras.viewsCount)`). [Source: app/controllers/public/productions_controller.ts#show]

### Sur l'« agrégation StatsService » de l'epic
- L'epic place un test « agrégation des vues par production » dans `StatsService.spec`. **Le calcul d'agrégation vit dans les contrôleurs (`withAggregate` Lucid), pas dans `StatsService`** (qui ne fait qu'enregistrer). On teste donc l'agrégation **sur le chemin réel** (page détail, Tâche 1) plutôt que d'ajouter une méthode `StatsService.countViews` non utilisée en prod. Si Epic 7 introduit des helpers d'agrégation dans `StatsService`, ils seront testés là.

### Gotchas
- `drive.fake('r2')`/`restore('r2')` requis pour les tests touchant les URLs signées (détail avec fichiers, download). Transaction globale par groupe. [Source: tests/functional/admin/production_files.spec.ts]
- BDD locale = Supabase polluée → ~14 unit + ~26 functional échouent en local (search_service, super_admin, etc.), **verts en CI propre** ; la suite functional est `continue-on-error` en CI (Epic 8). **Aucun** de ces échecs ne concerne l'Epic 6 — le vérifier au sweep. [Source: project_anta_status.md]
- Composants React testés par **source** (TS6305), pas par import. [Source: project_anta_status.md]

### Project Structure Notes
- Modifiés : `tests/functional/public/productions.spec.ts` (agrégation détail), `tests/functional/public/download.spec.ts` (assertion Location). Créé : `_bmad-output/implementation-artifacts/epic-6-coverage.md`.
- Aucune migration, aucune dépendance, aucun code applicatif modifié (story de tests uniquement).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR10-FR16, #FR25, #FR26]
- [Source: app/controllers/public/productions_controller.ts (show/download) ; app/services/stats_service.ts]
- [Source: tests/functional/public/productions.spec.ts, download.spec.ts, stats_view.spec.ts, listing.spec.ts]
- [Source: tests/unit/services/stats_service.spec.ts ; tests/unit/components/media_viewer.spec.ts, view_tracker.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅ (1 auto-fix prettier sur `addViews`).
- `node ace test functional --files=productions.spec.ts download.spec.ts` → 17/17.
- Sweep complet : unit 217✓/14✗ ; functional 135✓/26✗ (+2 tests d'agrégation verts). Les **14 + 26 échecs sont exclusivement** les échecs connus de pollution Supabase (search_service ×12, super_admin ×2 ; functional : home/listing/search/seo/admin data-dépendants) — **aucun ne concerne l'Epic 6** (vérifié). Verts en CI propre.

### Completion Notes List

- **Couverture front-loadée** en 6.1→6.4 : 6.5 n'a ajouté que les **vrais manques**, sans duplication.
- **Tâche 1** : test d'**agrégation des compteurs sur la page détail** (`viewsCount`/`downloadsCount` reflètent N vues / M téléchargements via `withAggregate`) + cas zéro → `productions.spec.ts` (groupe « agrégation des compteurs (6.5) »). Helpers `addViews`/`addDownloads` ajoutés.
- **Tâche 2** : `download.spec.ts` asserte désormais que le `Location` du 302 est une **URL signée non vide** (AC « URL signée retournée »).
- **Tâche 3** : carte de couverture `_bmad-output/implementation-artifacts/epic-6-coverage.md` (scénario → test pour tout l'Epic 6).
- **Tâche 4** : sweep documenté ci-dessus.
- Décisions assumées (documentées story) : organisation un-fichier-par-préoccupation (vs `StatsController.spec`/`ProductionsController.spec`) ; agrégation testée sur le chemin réel (contrôleur `withAggregate`) plutôt qu'une méthode `StatsService` non utilisée.
- Aucune migration, aucune dépendance, **aucun code applicatif modifié** (story de tests + doc).

### File List

**Créés :**
- `_bmad-output/implementation-artifacts/epic-6-coverage.md`

**Modifiés :**
- `tests/functional/public/productions.spec.ts` (helpers `addViews`/`addDownloads` + groupe agrégation des compteurs)
- `tests/functional/public/download.spec.ts` (assertion `Location` = URL signée)

### Change Log

- 2026-06-02 : Implémentation Story 6.5 — clôture Epic 6 : test d'agrégation des compteurs (page détail), renfort URL signée au download, carte de couverture, sweep final. Statut → review.
- 2026-06-02 : Code review Epic 6 (6.1-6.5) — 3 patches appliqués, 5 différés, 4 écartés. Statuts 6.1-6.5 → done.

## Review Findings (Epic 6 — code review 2026-06-02)

Revue adversariale 3 couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor). **Acceptance : 35/39 AC pleinement satisfaits** (6.1 10/10, 6.2 9/9, 6.4 7/7, 6.3 6/8, 6.5 3/5 — les 2 « manques » 6.5 étant des faux positifs : suite verte documentée + carte de couverture exclue du diff de revue).

**Patches appliqués (3) :**
- [x] [Review][Patch] Flash public non traduit — `PublicLayout.tsx` rendait `toast.error(flash.error)` sans `t()` → le message d'erreur de téléchargement (6.3 AC4) affichait la clé brute. Corrigé : `t(flash.error, { defaultValue })`, aligné sur AdminLayout.
- [x] [Review][Patch] `Content-Disposition` : durcissement de la sanitisation du nom de fichier (`\\` + guillemet + CR/LF). `file_storage_service.ts`.
- [x] [Review][Patch] `SeoService.forProduction` : plafond ~200 de la description (byline multi-auteurs). `seo_service.ts`.

**Différés (5) → `deferred-work.md`** : course TOCTOU unicité slug (faible proba, index protège) ; compteur download optimiste sur-compte si échec ; inflation/dédup vues → Epic 7, rate-limit → Epic 8 ; iframe embed sandbox `allow-scripts`+`allow-same-origin` (risque accepté, liens curés admin) ; duplication `slugify` migration↔service.

**Écartés (4)** : import circulaire modèle↔service (vérifié fonctionnel) ; `aria-label` vs `title` iframe (`title` = nom accessible valide) ; « carte de couverture absente » (faux — `epic-6-coverage.md` existe) ; cast `Number(viewsCount)` (OK).

Validation post-patch : typecheck ✅, lint ✅, tests impactés verts (seo 12/12, download 5/5).
