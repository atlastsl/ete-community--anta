# Story 7.1 : Statistiques par production (panel admin)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **consulter les statistiques de vues et de téléchargements pour chaque production**,
afin de **mesurer l'impact individuel de chaque contenu publié** (FR27).

## Décision de périmètre (lire en premier)

- **Emplacement** : la section stats vit sur la **page admin Edit** (`/admin/productions/:id/edit` — c'est la page de détail admin ; il n'y a pas de route `/admin/productions/:id` distincte). On étend le contrôleur `edit` + `Edit.tsx`.
- **Agrégation** : Epic 7 introduit l'**agrégation dans `StatsService`** (anticipé en revue 6.5). Ajout de `StatsService.productionStats(productionId)` (totaux + évolution 30 jours des vues, 0-remplie).
- **Graphique = CSS pur, 0 dépendance** (décision dev 2026-06-02, cohérente avec le 0-dep de 6.2) : barres en `<div>` (hauteur ∝ vues) + **table accessible** (sr-only) pour l'a11y. Pas de lib de charting.
- **DANS le périmètre 7.1** : `StatsService.productionStats`, props stats dans `edit`, composant `ProductionStats` (totaux + dates + évolution 30j + état vide), intégration `Edit.tsx`, i18n admin, tests.
- **HORS périmètre** : vue agrégée bibliothèque (`/admin/stats`) = **7.2** ; logs d'activité = **7.3** ; tests consolidés = **7.4**.

## Acceptance Criteria

1. **Given** un admin ouvre `/admin/productions/:id/edit`, **When** la section statistiques se charge, **Then** sont affichés : **nombre total de vues**, **nombre total de téléchargements**, **date de première publication sur Anta** (`antaPublishedAt`), **date de dernière modification** (`updatedAt`).
2. **Given** la production a des vues dans le temps, **When** les stats se chargent, **Then** un **tableau/graphique simple** affiche l'évolution des **vues sur les 30 derniers jours, regroupées par jour** (jours sans vue = 0).
3. **Given** la production n'a **aucune vue ni téléchargement**, **When** la section se charge, **Then** un état vide factuel s'affiche : « Aucune statistique disponible pour cette production. » (et l'évolution 30j n'est pas rendue).
4. **Given** un admin consulte les stats d'une production qui n'est pas la sienne, **When** la page se charge, **Then** les statistiques sont **accessibles** (tous les admins voient toutes les stats — FR27 ; aucun contrôle de propriété).
5. **Given** l'interface, **When** la section est rendue, **Then** tous les textes passent par `react-i18next` (parité FR/EN) ; la visualisation 30j est **accessible** (table sr-only ou `aria-label` par barre) ; dates formatées selon la locale.

## Tasks / Subtasks

- [x] **Tâche 1 — `StatsService.productionStats`** (AC: #1, #2)
  - [x] Ajouter `static async productionStats(productionId: string): Promise<ProductionStatsData>` dans `app/services/stats_service.ts`.
  - [x] `totalViews` = `StatsView.query().where('productionId', id).count('* as total')` → `Number(...)` ; idem `totalDownloads` sur `StatsDownload`.
  - [x] `viewsByDay` (30 derniers jours, 0-remplis) : requête `db.rawQuery` groupée —
    `select to_char(date_trunc('day', recorded_at), 'YYYY-MM-DD') as day, count(*)::int as count from stats_views where production_id = ? and recorded_at >= now() - interval '30 days' group by day` — puis **construire 30 entrées** côté JS (de J-29 à aujourd'hui) en mappant le résultat, jours absents = 0. Utiliser Luxon pour l'itération des dates.
  - [x] Exporter le type `export type ProductionStatsData = { totalViews: number; totalDownloads: number; viewsByDay: { date: string; count: number }[] }`.

- [x] **Tâche 2 — Contrôleur admin `edit` : props stats** (AC: #1, #4)
  - [x] `app/controllers/admin/productions_controller.ts` → `edit` : calculer `const stats = await StatsService.productionStats(production.id)` et passer une prop `stats` enrichie des dates : `{ ...stats, firstPublishedAt: production.antaPublishedAt?.toISO() ?? null, lastModifiedAt: production.updatedAt?.toISO() ?? null }`.
  - [x] Importer `StatsService`. **Aucun contrôle de propriété** (FR27 — tout admin voit toutes les stats ; le middleware admin suffit déjà).

- [x] **Tâche 3 — Composant `ProductionStats` (admin)** (AC: #1, #2, #3, #5)
  - [x] Créer `inertia/components/admin/ProductionStats.tsx`. Props : `{ stats: { totalViews, totalDownloads, firstPublishedAt, lastModifiedAt, viewsByDay } }`.
  - [x] **État vide** : si `totalViews === 0 && totalDownloads === 0` → afficher uniquement `t('productions.stats.empty')`.
  - [x] Sinon : 4 indicateurs (vues, téléchargements, première publication, dernière modification — dates `toLocaleDateString` selon `i18n.language`, « — » si null).
  - [x] **Évolution 30j** : barres CSS (`<div>` hauteur ∝ `count / max`, `max` = pic des 30j ; min 1px si count>0) avec `title`/`aria-label` par jour (`{date} : {count} vue(s)`), + une **table sr-only** (`<table class="sr-only">` date/vues) pour lecteurs d'écran. Icônes Lucide `Eye`/`Download`.

- [x] **Tâche 4 — Intégration `Edit.tsx`** (AC: #1)
  - [x] `inertia/pages/admin/Productions/Edit.tsx` : ajouter `stats` au type `Props` ; rendre `<ProductionStats stats={stats} />` dans une section (ex. au-dessus du formulaire, sous le titre/`publishedBy`).

- [x] **Tâche 5 — i18n admin (parité FR/EN)** (AC: #5)
  - [x] `inertia/locales/admin/{fr,en}.json` : ajouter sous `productions` un bloc `stats` : `heading` (« Statistiques »), `views` (« Vues »), `downloads` (« Téléchargements »), `first_published` (« Première publication »), `last_modified` (« Dernière modification »), `evolution_30d` (« Vues — 30 derniers jours »), `empty` (« Aucune statistique disponible pour cette production. »), `day_views` (« {{date}} : {{count}} vue(s) »). Respecter `tests/unit/i18n/translations.spec.ts` (parité).

- [x] **Tâche 6 — Tests** (AC: #1, #2, #3, #4)
  - [x] `tests/unit/services/stats_service.spec.ts` (étendre) : `productionStats` → `totalViews`/`totalDownloads` corrects ; `viewsByDay` a **exactement 30 entrées**, somme des `count` = nombre de vues des 30 derniers jours, jour avec vues > 0 ; production sans stat → totaux 0 + 30 entrées à 0. (Transaction globale ; insérer des `StatsView` avec `recordedAt` daté.)
  - [x] `tests/functional/admin/productions_stats.spec.ts` : admin connecté ouvre `/admin/productions/:id/edit` → props `stats` présentes avec `totalViews`/`totalDownloads` corrects (créer N vues + M téléchargements). _Note : suite functional admin = `continue-on-error` en CI (ticket Epic 8) ; passe en local._
  - [x] (Source TS6305) `tests/unit/components/production_stats.spec.ts` : `ProductionStats.tsx` contient l'état vide (`productions.stats.empty`), les 4 indicateurs, et la table sr-only / `aria-label` des barres.
  - [x] `node ace test unit` + `node ace test functional`, lint, typecheck verts.

## Dev Notes

### Contexte (déjà en place)
- **Page admin Edit** = la page de détail admin (`/admin/productions/:id/edit`), rendue par `inertia/pages/admin/Productions/Edit.tsx` (layout `AdminLayout`, namespace i18n **admin**, clés `productions.*`). [Source: inertia/pages/admin/Productions/Edit.tsx]
- Le contrôleur `edit` charge déjà la production (`antaPublishedAt`, `updatedAt` disponibles) + `publishedBy` (dernier publieur via logs). On y ajoute `stats`. [Source: app/controllers/admin/productions_controller.ts#edit]
- `StatsService` existe (Epic 6) avec `recordView`/`recordDownload` + `hashIp` privé. On y ajoute l'**agrégation** `productionStats`. [Source: app/services/stats_service.ts]
- Modèles : `StatsView { productionId, recordedAt, ipHash, sessionId }`, `StatsDownload { productionId, downloadedAt, ipHash }`. [Source: app/models/stats_view.ts, stats_download.ts]

### Patterns à réutiliser (anti-réinvention)
- **Comptage** : `Model.query().where('productionId', id).count('* as total')` → `Number(rows[0].$extras.total)` (déjà utilisé dans les tests download/stats). Alternative : `withAggregate` mais ici une requête dédiée par service est plus lisible.
- **Groupby temporel** : `db.rawQuery` (déjà le pattern pour `distinctSuggestions`/`search_vector`). `db` = `@adonisjs/lucid/services/db`. [Source: app/services/production_service.ts]
- **Dates** : props en ISO 8601 ; affichage `toLocaleDateString(i18n.language)`. Luxon pour l'itération des 30 jours côté service. [Source: architecture.md#Formats de Dates]
- **Composant admin** : suivre la structure des composants `inertia/components/admin/*` (ex. `CompletionIndicator`, `StatusBadge`) ; `useTranslation()` namespace admin.

### Visualisation 30 jours — 0 dépendance
- Barres CSS : conteneur flex, une `<div>` par jour, `style={{ height: \`\${count === 0 ? 0 : Math.max(4, (count / max) * 100)}%\` }}` dans un cadre de hauteur fixe (ex. `h-32`). `max = Math.max(1, ...counts)`. Couleur `bg-green-700`.
- **A11y** : chaque barre `aria-label={t('productions.stats.day_views', { date, count })}` OU une `<table class="sr-only">` listant date/vues (préférable). Ne jamais reposer uniquement sur la couleur/hauteur.

### Sécurité / accès (FR27)
- Tout admin (rôle `admin` ou `super_admin`) voit toutes les stats. La page `edit` est déjà derrière `AdminMiddleware` ; **aucun contrôle de propriété** à ajouter (et il n'y en a pas aujourd'hui — `edit` charge par `:id` sans filtrer sur `createdById`). Ne pas en introduire.

### Gotchas
- **Suite functional admin = `continue-on-error` en CI** (ticket Epic 8 : `beginGlobalTransaction` non propagé au serveur HTTP in-process → auth KO en CI propre). Le test functional admin de cette story **passera en local** mais sera non bloquant en CI. La **vraie garantie** est le test **unit** de `productionStats`. [Source: project_anta_status.md ; deferred-work.md]
- BDD locale Supabase polluée → ne pas s'alarmer des échecs data-dépendants connus (search_service, super_admin…). Aucun lié à cette story.
- Composants React testés par **source** (TS6305). [Source: project_anta_status.md]
- `viewsByDay` : bien produire **30 entrées** (0-remplies) côté service pour un rendu stable, plutôt que de laisser le client gérer les trous.

### Stories suivantes (ne PAS implémenter ici)
- 7.2 : `/admin/stats` (totaux bibliothèque + top 10 vues/téléchargements + évolution 30j globale). 7.3 : logs d'activité (super admin, filtres, pagination). 7.4 : tests consolidés. L'agrégation `productionStats` de cette story pourra être complétée par des agrégations globales (`libraryStats`) en 7.2.

### Project Structure Notes
- Nouveaux : `inertia/components/admin/ProductionStats.tsx`, `tests/unit/components/production_stats.spec.ts`, `tests/functional/admin/productions_stats.spec.ts`. Modifiés : `app/services/stats_service.ts` (+`productionStats`), `app/controllers/admin/productions_controller.ts` (edit → prop `stats`), `inertia/pages/admin/Productions/Edit.tsx`, `inertia/locales/admin/fr.json`+`en.json`, `tests/unit/services/stats_service.spec.ts`.
- Aucune migration, aucune dépendance.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR27]
- [Source: app/services/stats_service.ts ; app/models/stats_view.ts ; app/models/stats_download.ts]
- [Source: app/controllers/admin/productions_controller.ts#edit ; inertia/pages/admin/Productions/Edit.tsx]
- [Source: app/services/production_service.ts (pattern db.rawQuery) ; architecture.md#Formats de Dates]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅.
- `node ace test unit --files=stats_service.spec.ts production_stats.spec.ts translations.spec.ts` → 14/14.
- `node ace test functional --files=productions_stats.spec.ts` → 2/2 (local).
- Sweep complet : unit 222✓/14✗ (+5 nouveaux verts) ; functional 137✓/26✗ (+2 nouveaux verts). Les 14+26 échecs restants = pollution Supabase connue, aucun lié à 7.1.

### Completion Notes List

- **`StatsService.productionStats`** : totaux all-time (`count`) + `viewsByDay` (30 entrées 0-remplies). **Bucketing par jour en JS (Luxon)** sur la fenêtre 30j (filtre `recordedAt >= cutoff` + regroupement par `yyyy-MM-dd`) → cohérence de fuseau garantie entre filtre, buckets et tableau de sortie (évite les off-by-one TZ d'un `date_trunc` SQL).
- **Contrôleur admin `edit`** : prop `stats` = `{ ...productionStats, firstPublishedAt: antaPublishedAt, lastModifiedAt: updatedAt }`. Aucun contrôle de propriété (FR27 — tout admin voit toutes les stats).
- **`ProductionStats`** : état vide si 0 vue & 0 téléchargement ; sinon 4 indicateurs + évolution 30j en **barres CSS (0 dépendance)** + **table `sr-only`** accessible.
- **Décision** : graphique CSS pur (pas de lib de charting), cohérent avec le 0-dep de 6.2.
- **Caveat test** : le test functional admin passe en local mais sera **non bloquant en CI** (ticket Epic 8) ; la garantie réelle est le test **unit** de `productionStats`.
- Aucune migration, aucune dépendance.

### File List

**Créés :**
- `inertia/components/admin/ProductionStats.tsx`
- `tests/unit/components/production_stats.spec.ts`
- `tests/functional/admin/productions_stats.spec.ts`

**Modifiés :**
- `app/services/stats_service.ts` (`productionStats` + type `ProductionStatsData`)
- `app/controllers/admin/productions_controller.ts` (`edit` → prop `stats` + import `StatsService`)
- `inertia/pages/admin/Productions/Edit.tsx` (prop `stats` + rendu `ProductionStats`)
- `inertia/locales/admin/fr.json`, `inertia/locales/admin/en.json` (bloc `productions.stats`)
- `tests/unit/services/stats_service.spec.ts` (tests `productionStats`)

### Change Log

- 2026-06-02 : Implémentation Story 7.1 — statistiques par production (panel admin) : `StatsService.productionStats` (totaux + évolution 30j), section `ProductionStats` (barres CSS + table accessible) sur la page Edit. Statut → review.
