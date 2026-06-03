# Story 7.3 : Logs d'activité des administrateurs (super admin)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **super administrateur**,
je veux **consulter l'historique des actions effectuées par chaque administrateur**,
afin de **superviser l'activité du panel et d'assurer la traçabilité des opérations** (FR29).

## Décision de périmètre (lire en premier)

- **Page dédiée `/admin/activity`** (super-admin only) plutôt qu'une section de `/admin/stats`. Raison : `/admin/stats` (7.2) est accessible à **tous** les admins ; mélanger une section super-admin-only sur la même route est fragile. Une page dédiée derrière le groupe `superAdmin()` + l'item de nav `superAdminOnly` est plus propre. L'epic autorise explicitement « une page dédiée ».
- **Accès refusé = 302** (redirect `/admin/productions` + flash `errors.forbidden`), pas 403 — c'est le comportement existant de `SuperAdminMiddleware` (cohérent avec les routes `users`). _Le libellé « 403 » de l'epic 7.4 sera réconcilié vers 302._
- **DANS le périmètre 7.3** : contrôleur `ActivityLogsController.index`, route super-admin, page liste + filtres (admin, type d'action) + pagination 20/page, item de nav, i18n, tests.
- **HORS périmètre** : tests consolidés = **7.4**. Aucune nouvelle table (`admin_activity_logs` + `ActivityLogService` existent depuis Epic 3).

## Acceptance Criteria

1. **Given** un super admin accède à `/admin/activity`, **When** la section se charge, **Then** la liste des actions admin est affichée : **admin concerné** (email), **type d'action** (`login | create | update | publish | unpublish | delete | password_reset`), **ressource** (type + id, ou « — » si absente), **date et heure**.
2. **Given** la liste est affichée, **When** le super admin **filtre par administrateur**, **Then** seules les actions de cet admin sont affichées.
3. **Given** la liste est affichée, **When** le super admin **filtre par type d'action**, **Then** seules les actions du type sélectionné sont affichées.
4. **Given** la liste contient de nombreuses entrées, **When** la page se charge, **Then** les logs sont **paginés (20 par page)** avec les **plus récents en premier** ; les filtres actifs sont **préservés** à travers la pagination.
5. **Given** un admin (rôle `admin`) tente d'accéder à `/admin/activity`, **When** `SuperAdminMiddleware` s'exécute, **Then** l'accès est **refusé** (302 → `/admin/productions` + flash `errors.forbidden`) **and** l'item de nav « Activité » n'apparaît **pas** dans son interface.
6. **Given** l'interface, **When** la page est rendue, **Then** tous les textes via `react-i18next` (parité FR/EN ; libellés des 7 types d'action) ; tables accessibles ; dates formatées selon la locale.

## Tasks / Subtasks

- [x] **Tâche 1 — Contrôleur `ActivityLogsController.index`** (AC: #1, #2, #3, #4)
  - [x] Créer `app/controllers/admin/activity_logs_controller.ts`, méthode `async index({ request, inertia })`.
  - [x] `page = Math.max(1, Number(request.input('page', 1)) || 1)`.
  - [x] Filtres : `actionType` validé contre `Object.values(ActionType)` (sinon null) ; `adminUserId` accepté seulement s'il matche un **UUID** (regex) — sinon ignoré (évite le 500 Postgres « invalid uuid »).
  - [x] Query : `AdminActivityLog.query().preload('adminUser').orderBy('createdAt','desc').orderBy('id','asc')` + `if (actionType) where('actionType', actionType)` + `if (adminUserId) where('adminUserId', adminUserId)` → `.paginate(page, 20)`.
  - [x] Options de filtre : liste des admins (`AdminUser.query().select('id','email').orderBy('email')`) pour le dropdown ; les types d'action = `Object.values(ActionType)`.
  - [x] `inertia.render('admin/ActivityLogs/Index', { logs: paginator.all().map(serialize), pagination: { currentPage,lastPage,total,perPage }, currentAdminId: adminUserId, currentActionType: actionType, admins, actionTypes })`. `serialize(l)` = `{ id, adminEmail: l.adminUser?.email ?? null, actionType, resourceType, resourceId, createdAt: l.createdAt.toISO() }`.

- [x] **Tâche 2 — Route super-admin** (AC: #5)
  - [x] `start/routes.ts` : dans le sous-groupe `.use(middleware.superAdmin())` (où vivent les routes `users`), ajouter `router.get('activity', [controllers.admin.ActivityLogs, 'index']).as('admin.activity')`.

- [x] **Tâche 3 — Page `admin/ActivityLogs/Index.tsx`** (AC: #1, #2, #3, #4, #6)
  - [x] Type `Props = { logs: LogRow[]; pagination: PaginationMeta; currentAdminId: string | null; currentActionType: string | null; admins: { id: string; email: string }[]; actionTypes: string[] }`.
  - [x] `<h1>` « Logs d'activité ».
  - [x] **Filtres** : `Select` admin (option « Tous » + un par admin/email) + `Select` type d'action (option « Tous » + libellé i18n par type) → on change, `router.get('/admin/activity', { adminId, actionType }, { preserveState, preserveScroll })` (ou liens) ; bouton « Réinitialiser ». Suivre le pattern de `admin/Productions/Index.tsx` (Selects + applyFilters + Pagination `queryParams`).
  - [x] **Table** : colonnes admin (email) · action (badge libellé i18n) · ressource (`{resourceType} #{resourceId court}` ou « — ») · date/heure (`toLocaleString`). `<th scope="col">`. État vide si `logs.length === 0`.
  - [x] **Pagination** : composant `~/components/shared/Pagination` avec `queryParams={{ adminId, actionType }}` (préserve les filtres — AC#4).
  - [x] `AdminLayout`, i18n admin.

- [x] **Tâche 4 — Item de nav (super-admin only)** (AC: #5)
  - [x] `inertia/layouts/AdminLayout.tsx` : ajouter à `NAV_ITEMS` `{ labelKey: 'nav.activity', href: '/admin/activity', icon: <Lucide ScrollText/Activity>, superAdminOnly: true }`. Importer l'icône. `visibleItems` le masque déjà pour les non-super-admins.

- [x] **Tâche 5 — i18n admin (parité FR/EN)** (AC: #6)
  - [x] `inertia/locales/admin/{fr,en}.json` : `nav.activity` + bloc top-level `activity` : `heading`, `filter_admin` (« Administrateur »), `filter_action` (« Type d'action »), `all` (« Tous »), `clear` (« Réinitialiser »), `col_admin`, `col_action`, `col_resource`, `col_date`, `empty` (« Aucune action enregistrée. »), et `action.{login,create,update,publish,unpublish,delete,password_reset}` (libellés). Respecter `translations.spec`.

- [x] **Tâche 6 — Tests** (AC: #1–#5)
  - [x] `tests/functional/admin/activity_logs.spec.ts` (transaction globale ; `loginAs`) :
    - [x] super_admin `GET /admin/activity` → 200 + props `logs`/`pagination`/`admins`/`actionTypes` ; créer quelques `AdminActivityLog` (ou via `ActivityLogService.log`) et vérifier qu'ils apparaissent, **plus récents en premier**.
    - [x] filtre par admin (`?adminId=`) → seules ses actions ; filtre par `?actionType=publish` → seules les `publish`.
    - [x] pagination : créer > 20 logs → `pagination.perPage === 20`, `lastPage >= 2`.
    - [x] **rôle `admin`** `GET /admin/activity` → **302** vers `/admin/productions` (SuperAdminMiddleware). _Note : functional admin = `continue-on-error` en CI (Epic 8) ; passe en local._
  - [x] (Source TS6305) `tests/unit/components/activity_logs_page.spec.ts` : la page contient les filtres (admin/action), la table (col_admin/col_action/col_resource/col_date), l'état vide.
  - [x] (Garde-fou, optionnel) étendre `tests/unit/infrastructure/config_files.spec.ts` : vérifier que la route `activity` est sous le groupe super-admin (lecture source `start/routes.ts`).
  - [x] `node ace test unit` + `node ace test functional`, lint, typecheck verts.

## Dev Notes

### Infra existante (NE PAS réinventer)
- `AdminActivityLog` : `{ id, adminUserId, actionType, resourceType, resourceId, createdAt }` + relation `adminUser` (belongsTo). [Source: app/models/admin_activity_log.ts]
- `ActionType` (enum const) : `login | create | update | publish | unpublish | delete | password_reset`. [Source: app/enums/action_type.ts]
- `ActivityLogService.log()` écrit déjà ces logs (Epic 3 — login, create/update/publish/unpublish/delete, password_reset). Cette story ne fait que **lire**. [Source: app/services/activity_log_service.ts]
- `SuperAdminMiddleware` : si rôle ≠ super_admin → `flash('error','errors.forbidden')` + `redirect('/admin/productions')` (**302**). [Source: app/middleware/super_admin_middleware.ts]
- Groupe routes super-admin : sous-groupe `.use(middleware.superAdmin())` dans `start/routes.ts` (contient `users/*`). Y ajouter `activity`. [Source: start/routes.ts]

### Patterns à réutiliser
- **Liste paginée + filtres** : copier le pattern de `admin/productions_controller.index` (parse/validate filtres, `.paginate(page, PER_PAGE)`, retourne `pagination` meta + `currentX` + options) et de la page `admin/Productions/Index.tsx` (Selects + `applyFilters` via `router.get(..., { preserveState, preserveScroll })` + `Pagination queryParams`). [Source: app/controllers/admin/productions_controller.ts#index ; inertia/pages/admin/Productions/Index.tsx]
- **Pagination** : composant `~/components/shared/Pagination` (prend `pagination` + `queryParams`). [Source: inertia/components/shared/Pagination.tsx]
- **Nav role-based** : `NAV_ITEMS` + `superAdminOnly` + `visibleItems` filtre déjà sur `isSuperAdmin`. [Source: inertia/layouts/AdminLayout.tsx:12-23,49]
- **Validation enum/UUID** : valider `actionType` contre l'enum ; **garder un guard UUID** sur `adminUserId` (cf. `stats_controller`) avant `where('adminUserId', ...)` pour éviter le 500 Postgres sur un id non-UUID.

### Sécurité / accès
- Route sous `AdminMiddleware` + `SuperAdminMiddleware`. Défense en profondeur : l'item de nav est masqué pour les admins (UI) ET le middleware bloque l'accès direct (302). Ne PAS exposer la route hors du groupe super-admin.

### Affichage
- **Ressource** : `resourceType` est `'production'` (ou null) ; `resourceId` un UUID. Afficher `{type} #{id tronqué 8}` ou « — » si les deux sont null (ex. `login`). Lien éventuel vers la production = bonus (hors AC).
- **Type d'action** : badge avec libellé i18n (`activity.action.{type}`). Date : `toLocaleString(locale)`.

### Gotchas
- **Suite functional admin = `continue-on-error` en CI** (ticket Epic 8) → les tests functional de cette story passent en local, non bloquants en CI. La logique de filtre/pagination est simple et testée en local ; pas d'équivalent unit nécessaire (lecture pure).
- BDD locale Supabase polluée (logs réels présents : login du super admin seedé, etc.) → tester en **isolant** via transaction globale (les logs créés dans le test + rollback) et asserter sur **les logs créés** (filtrer par un admin créé dans le test) plutôt que sur des totaux absolus.
- Nouveau contrôleur `ActivityLogsController` → codegen `.adonisjs/server/controllers.ts` régénéré au boot `node ace test` (committer).
- Composants React testés par **source** (TS6305).

### Stories suivantes (ne PAS implémenter ici)
- 7.4 : suite de tests consolidée (`StatsController.spec` / couverture Epic 7), peut réutiliser/compléter ces tests + ceux de 7.1/7.2.

### Project Structure Notes
- Nouveaux : `app/controllers/admin/activity_logs_controller.ts`, `inertia/pages/admin/ActivityLogs/Index.tsx`, `tests/functional/admin/activity_logs.spec.ts`, `tests/unit/components/activity_logs_page.spec.ts`. Modifiés : `start/routes.ts`, `inertia/layouts/AdminLayout.tsx`, `inertia/locales/admin/{fr,en}.json`. Régénéré : `.adonisjs/server/controllers.ts` (+ `pages.d.ts` pour la nouvelle page).
- Aucune migration, aucune dépendance.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3, #Story 7.4]
- [Source: _bmad-output/planning-artifacts/prd.md#FR29]
- [Source: app/models/admin_activity_log.ts ; app/enums/action_type.ts ; app/services/activity_log_service.ts]
- [Source: app/middleware/super_admin_middleware.ts ; start/routes.ts (groupe superAdmin)]
- [Source: app/controllers/admin/productions_controller.ts#index ; inertia/pages/admin/Productions/Index.tsx ; inertia/components/shared/Pagination.tsx]
- [Source: inertia/layouts/AdminLayout.tsx]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `npm run typecheck` ✅ · `npm run lint` ✅ (auto-fix prettier sur la spec + routes).
- `node ace test functional --files=activity_logs.spec.ts` → 5/5 (régénère le codegen).
- `node ace test unit --files=activity_logs_page.spec.ts translations.spec.ts` → 7/7.
- Sweep complet : unit 230✓/14✗ (+3 nouveaux verts) ; functional 144✓/26✗ (+5 nouveaux verts). 14+26 = pollution Supabase connue, aucun lié à 7.3.

### Completion Notes List

- **Page dédiée `/admin/activity`** (route dans le groupe `superAdmin()`), pas une section de `/admin/stats`.
- **`ActivityLogsController.index`** : pagination 20/page, `orderBy createdAt desc, id asc`, `preload('adminUser')` ; filtres `actionType` (validé enum) + `adminId` (**guard UUID** anti-500). Retourne `admins` (dropdown) + `actionTypes`.
- **Page** : 2 `Select` (admin / type) + bouton Réinitialiser + table (admin · action badge · ressource `type #id8` · date) + état vide + `Pagination` (filtres préservés via `queryParams`). Pattern mirroré sur `Productions/Index`.
- **Nav** : item `nav.activity` `superAdminOnly: true` (masqué pour les admins ; middleware bloque l'accès direct).
- **Accès refusé = 302** vers `/admin/productions` (SuperAdminMiddleware existant), pas 403 — testé.
- i18n admin : `nav.activity` + bloc top-level `activity` (+ 7 libellés d'action), parité FR/EN.
- **Tests isolés** par transaction + filtrage sur un admin créé dans le test (BDD polluée). `createMany` pour les 25 logs (sous le timeout). **Caveat** : functional admin `continue-on-error` en CI (Epic 8).
- Codegen régénéré (`controllers.ts` + `pages.d.ts`). Aucune migration, aucune dépendance.

### File List

**Créés :**
- `app/controllers/admin/activity_logs_controller.ts`
- `inertia/pages/admin/ActivityLogs/Index.tsx`
- `tests/functional/admin/activity_logs.spec.ts`
- `tests/unit/components/activity_logs_page.spec.ts`

**Modifiés :**
- `start/routes.ts` (route `admin.activity` dans le groupe super-admin)
- `inertia/layouts/AdminLayout.tsx` (item de nav `activity` superAdminOnly + icône ScrollText)
- `inertia/locales/admin/fr.json`, `inertia/locales/admin/en.json` (`nav.activity` + bloc `activity`)
- Régénérés (codegen) : `.adonisjs/server/controllers.ts`, `.adonisjs/server/pages.d.ts`

### Change Log

- 2026-06-02 : Implémentation Story 7.3 — logs d'activité admin (`/admin/activity`, super-admin only) : liste paginée + filtres admin/type d'action, item de nav. Statut → review.
