# Story 5.3 : Recherche full-text et filtres multi-critères

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que visiteur,
Je veux rechercher des productions par mot-clé et affiner les résultats avec des filtres combinables,
Afin de trouver précisément ce que je cherche dans le catalogue (FR1–FR8, NFR2).

> **3ᵉ story de l'Epic 5.** Elle **remplace le stub `/productions`** (Story 5.2) par un vrai `SearchService` (recherche full-text `tsvector` + filtres multi-critères combinables) et une `FilterBar` multi-select pilotée par l'URL. **Périmètre strict — ce qui N'EST PAS dans 5.3 (→ Story 5.4)** : l'en-tête de comptage "{N} résultats", le dropdown de tri (Pertinence/Date/Vues/Téléchargements), le `ListingToggle` liste/grille, la variante `list` de `ProductionCard`, l'affichage du composant `Pagination` numéroté, et l'état vide stylé "aucun résultat". 5.3 livre la **logique de recherche/filtrage**, l'**état d'URL** (filtres reflétés + persistants), et la **FilterBar fonctionnelle** (toggle multi-select + état actif + "Effacer filtres"). Le contrôleur **pagine déjà** (param `page` respecté, méta retournée) pour que 5.4 branche l'UI de pagination sans retoucher le backend.

## Acceptance Criteria

**AC1 — Recherche full-text par pertinence (tsvector)**

- **Given** un visiteur saisit un terme dans la SearchBar et soumet
- **When** `GET /productions?q=terme` est traité par `SearchService`
- **Then** une requête de correspondance `search_vector @@ <tsquery>('simple', terme)` est exécutée (config `'simple'` — **identique au trigger** de la table)
- **And** les résultats sont triés par **pertinence** (`ts_rank`) par défaut quand `q` est présent
- **And** seules les productions **publiées** sont retournées
- **And** la requête s'appuie sur l'index GIN `idx_productions_search_vector` (NFR2 — réponse < 1s au 95e percentile)

**AC2 — Filtres multi-critères combinables (AND inter-dimensions, OR intra-dimension)**

- **Given** un visiteur active un ou plusieurs FilterChips parmi : **catégorie** (FR2), **domaine** (FR3), **sous-domaine** (FR4), **auteur** (FR5), **langue** (FR6), **pays** (FR7), **licence** (FR8)
- **When** les filtres sont appliqués
- **Then** les dimensions différentes sont combinées en **AND** dans la requête SQL ; plusieurs valeurs d'une **même** dimension en **OR** (multi-select — UX-DR2)
- **And** chaque filtre actif est reflété dans l'URL via des query params (`?category=...&language=...`)
- **And** les FilterChips actifs ont un état visuel distinct (`aria-pressed="true"`, fond `green-700`)
- **And** la recherche `q` et les filtres se combinent (recherche + filtres simultanés)

**AC3 — Effacer les filtres**

- **Given** au moins un filtre est actif
- **When** le visiteur clique sur "Effacer filtres" (`actions.clear_filters`)
- **Then** tous les paramètres de **filtre** sont retirés de l'URL (le terme de recherche `q` est conservé)
- **And** le bouton "Effacer filtres" est **visible uniquement** quand au moins un filtre est actif

**AC4 — Persistance des filtres lors de la navigation paginée**

- **Given** une recherche et/ou des filtres sont actifs
- **When** un paramètre `page` est ajouté à l'URL (navigation paginée — UI rendue en 5.4)
- **Then** `SearchService` respecte `page` (pagination serveur) et **tous les filtres + `q` restent appliqués**
- **And** les liens générés (chips, effacer, futurs liens de pagination) **préservent** les autres paramètres actifs

**AC5 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `SearchService` : `q` retourne les productions dont `search_vector` matche (titre/résumé/auteurs/tags/catégorie/domaine/sous-domaine/langue), publiées uniquement ; requête multi-mots ne lève PAS d'erreur SQL
  - Filtres : `category`/`domain`/`subdomain`/`language`/`country`/`license` filtrent correctement (AND inter-dimensions, OR intra-dimension) ; `author` filtre sur le tableau `jsonb`
  - `?page=2` respecté ; filtres conservés
  - Helper d'URL (`toggleFilter`/`clearFilters`) : ajoute/retire une valeur en préservant `q` + autres dimensions, retire `page`
  - Parité i18n FR/EN préservée (`translations.spec.ts` vert)

## Tasks / Subtasks

- [x] **Tâche 1 — `SearchService` (backend recherche + filtres)** (AC1, AC2, AC4)
  - [x] 1.1 Créé `app/services/search_service.ts`, `static search({ q, filters, page, perPage })` → paginator Lucid.
  - [x] 1.2 Base `where('status', ProductionStatus.PUBLISHED)` + 2 `withAggregate` (`viewsCount`/`downloadsCount`).
  - [x] 1.3 Full-text : `whereRaw("search_vector @@ websearch_to_tsquery('simple', ?)", [term])` (config `'simple'`, `websearch_to_tsquery` robuste multi-mots).
  - [x] 1.4 Tri : `q` → `orderByRaw("ts_rank(...) desc")` ; sinon `orderBy('antaPublishedAt','desc')`.
  - [x] 1.5 Filtres : `whereIn` pour category/domain/subdomain/language/`publicationCountry`/`licenseStatus` ; groupe `orWhereRaw("authors @> ?::jsonb")` pour author.
  - [x] 1.6 `return query.paginate(page, perPage)`.
  - [x] 1.7 Types `ProductionFilters`/`Facets`/`EMPTY_FILTERS` exportés.

- [x] **Tâche 2 — `ProductionsController.index` (réel, remplace le stub)** (AC1, AC2, AC3, AC4)
  - [x] 2.1 Stub remplacé.
  - [x] 2.2 Helper `asArray` (param répété→array, unique→[v], absent→[]) ; bornage `page`.
  - [x] 2.3 `license` validé contre `LicenseStatus` (valeurs hors enum ignorées).
  - [x] 2.4 `SearchService.search({ q, filters, page, perPage: 20 })`.
  - [x] 2.5 `SearchService.facets()` : distinct par dimension + `jsonb_array_elements_text` pour author, tri alpha.
  - [x] 2.6 Sérialisation `ProductionCardData` (viewsCount/downloadsCount via `withAggregate`).
  - [x] 2.7 `inertia.render('productions', { results, pagination, facets, activeFilters, q })`.
  - [x] 2.8 Méta de pagination retournée (UI = 5.4).

- [x] **Tâche 3 — Helper d'état d'URL des filtres (client)** (AC2, AC3, AC4)
  - [x] 3.1 Créé `inertia/lib/search_query.ts` : `toggleFilter`, `clearFilters`, `setQuery`, `hasActiveFilters`, `isFilterActive` (fonctions pures).
  - [x] 3.2 `FILTER_DIMENSIONS` + types `ProductionFilters`/`Facets`/`EMPTY_FILTERS_CLIENT` (dupliqués côté client, frontière TS).
  - [x] 3.3 `URLSearchParams` (encode/décode).

- [x] **Tâche 4 — `FilterBar` multi-dimension + `FilterChip` toggle** (AC2, AC3)
  - [x] 4.1 `FilterBar` à deux modes : **listing** (`facets`+`activeFilters` → chips groupés par dimension, toggle URL, bouton "Effacer filtres" si `hasActiveFilters`) ; **homepage** (compat `categories` — inchangé).
  - [x] 4.2 `FilterChip` conserve `aria-pressed` + état actif `green-700`.
  - [x] 4.3 Query string courante via `usePage().url`.

- [x] **Tâche 5 — Page `productions.tsx` (résultats réels)** (AC1, AC2, AC3)
  - [x] 5.1 Stub remplacé. Props `{ results, pagination, facets, activeFilters, q }`.
  - [x] 5.2 `SearchBar` (defaultValue=q) ; submit → `router.visit('/productions' + setQuery(search, q))` (préserve les filtres).
  - [x] 5.3 `FilterBar` mode listing.
  - [x] 5.4 Grille `ProductionCard` ; pas de comptage/tri/toggle/pagination/empty stylé (Story 5.4). Vide → texte neutre `productions.no_results`.
  - [x] 5.5 Hérite de `PublicLayout`.

- [x] **Tâche 6 — i18n** (AC2, AC3)
  - [x] 6.1 `filters.dimensions.*` (7 dimensions) + `productions.no_results` ajoutés FR/EN (parité). `actions.clear_filters` réutilisé.
  - [x] 6.2 `translations.spec.ts` vert.

- [x] **Tâche 7 — Tests** (AC5)
  - [x] 7.1 `tests/functional/public/search.spec.ts` : full-text (titre/résumé/auteur), multi-mots sans erreur, draft exclu, OR/AND, author jsonb, licence (+ invalide ignorée), facettes, `?page=2` + filtres conservés.
  - [x] 7.2 `tests/unit/lib/search_query.spec.ts` : vérification **source** (Node-pur) — l'import direct casse le typecheck (TS6305, frontière inertia/ — cf. `notify.spec.ts`). Comportement couvert end-to-end par `search.spec.ts`.
  - [x] 7.3 `filter_chip.spec.ts` (5.2) reste vert (FilterBar conserve `/productions?category=`, `encodeURIComponent`, `role="group"`, `aria-label`) — pas de MAJ nécessaire.
  - [x] 7.4 `tests/functional/public/productions.spec.ts` (5.2) **mis à jour** : testait le stub (props `category`/`q` plats) → adapté au vrai contrat (`results`/`facets`/`activeFilters`/`pagination`/`q`).

- [x] **Tâche 8 — Validation finale**
  - [x] 8.1 `node ace test` → 282/282 verts.
  - [x] 8.2 `npm run lint` → 0 erreur.
  - [x] 8.3 `npm run typecheck` → 0 erreur.
  - [ ] 8.4 Test manuel `npm run dev` (**utilisateur**) : recherche → résultats pertinents ; chips multiples (catégorie + langue) → URL `?category=...&language=...` filtrée AND ; "Effacer filtres" → filtres retirés, `q` conservé ; recherche + filtres simultanés.

## Dev Notes

### Architecture cible (synthèse)

- **`SearchService`** (`app/services/search_service.ts`) encapsule **toute** la logique full-text + filtres + pagination. Le contrôleur reste mince (parse params, validation enum, facettes, sérialisation). Conforme `architecture.md#services` (`SearchService.ts — Logique full-text tsvector + filtres`) et au flux `SearchBar → GET /productions → ProductionsController → SearchService → tsvector → props Inertia`.
- **Infra full-text déjà en place** (migration `1775918733547_create_productions_table.ts`) :
  - Colonne `search_vector tsvector`, alimentée par le **trigger** `productions_search_vector_trigger` (config **`'simple'`**, sur `title, summary, authors::text, tags::text, category, domain, subdomain, language`).
  - **Index GIN** `idx_productions_search_vector` → la requête `@@` l'utilise (NFR2 < 1s).
  - **Ne PAS** recréer trigger/index/colonne ni ajouter de migration : tout existe.
- **État d'URL = source de vérité** : les filtres et la recherche vivent dans les query params. Aucune persistance localStorage pour les filtres (le `ListingToggle` liste/grille en localStorage, lui, est Story 5.4). Les liens (chips, effacer, pagination) se construisent en mutant la query string courante.

### ⚠️ `websearch_to_tsquery` plutôt que `to_tsquery` brut (déviation justifiée de l'AC)

L'AC d'origine mentionne `to_tsquery`. **`to_tsquery('simple', ?)` lève une erreur SQL** dès que l'entrée contient des espaces ou des caractères spéciaux (ex. `"machine learning"` → `syntax error in tsquery`). Pour une saisie utilisateur libre, utiliser **`websearch_to_tsquery('simple', ?)`** (gère espaces, guillemets, `or`, `-`, robuste, jamais d'exception) — ou à défaut `plainto_tsquery`. C'est l'implémentation correcte de l'intention de l'AC (« correspondance `@@` sur `search_vector` triée par pertinence »). Documenter ce choix dans les Completion Notes. Config **`'simple'`** obligatoire (identité avec le trigger, sinon zéro résultat).

### Spécificités SQL

- **`authors`/`tags` sont `jsonb`** (pas du texte). Filtre auteur exact : `authors @> '["Nom"]'::jsonb` (opérateur containment, indexable). Le `whereRaw` bind la valeur : `sub.orWhereRaw("authors @> ?::jsonb", [JSON.stringify([a])])`.
- **Facette auteur** : `select distinct jsonb_array_elements_text(authors) as author from productions where status = 'published' order by author`. (Les autres facettes = `distinct(col)`.)
- **Pertinence** : `ts_rank(search_vector, websearch_to_tsquery('simple', ?))`. Quand `q` est absent → tri par `antaPublishedAt desc` (le tri multi-critères Pertinence/Date/Vues/Téléchargements est **Story 5.4**).
- **`withAggregate`** pour `viewsCount`/`downloadsCount` (relations `statsViews`/`statsDownloads` ajoutées en Story 5.2) — mêmes alias que `HomeController` pour réutiliser `ProductionCardData`.
- **Mapping param ↦ colonne** : `country ↦ publication_country`, `license ↦ license_status`. Les autres params = nom de colonne.

### État existant à RESPECTER (ne pas réinventer)

- `app/controllers/public/productions_controller.ts` — **stub de Story 5.2 à remplacer** (lisait `q`/`category`, rendait `productions`).
- `inertia/pages/productions.tsx` — **stub de Story 5.2 à remplacer**.
- `inertia/components/public/{SearchBar,FilterBar,FilterChip,ProductionCard}.tsx` (Story 5.2) — réutiliser/faire évoluer. `SearchBar` est présentationnel (`onSubmit`), `ProductionCard` variante grille OK. `FilterBar`/`FilterChip` à enrichir pour le multi-dimension + toggle.
- `app/controllers/public/home_controller.ts` (Story 5.2) — **référence** pour `withAggregate('statsViews', q => q.count('*').as('viewsCount'))`, le filtre `status=PUBLISHED`, et la sérialisation plate.
- `app/models/production.ts` — relations `statsViews`/`statsDownloads` déjà présentes (5.2). Colonnes : `category, domain, subdomain, language, publicationCountry, licenseStatus, authors (jsonb), searchVector`.
- `app/enums/license_status.ts` / `production_status.ts` — `LicenseStatus` (`member|free_license|external_link`), `ProductionStatus.PUBLISHED`. Jamais de string en dur.
- `app/controllers/admin/productions_controller.ts` — **pattern** : bornage `page`, validation d'un query param contre un enum (`status`), `paginate(page, PER_PAGE)`, `getMeta()`, sérialisation plate.
- `inertia/components/shared/Pagination.tsx` — composant pagination **existant** (props `currentPage`/`lastPage`/`queryParams`) → **branché en Story 5.4**, pas ici. La méta retournée par 5.3 lui servira d'entrée.
- `inertia/lib/production_completion.ts` — précédent de **constante dupliquée** entre serveur/client (frontière TS). Suivre ce pattern pour `FILTER_DIMENSIONS` si nécessaire.
- `inertia/locales/public/{fr,en}.json` — déjà `actions.clear_filters`, `actions.filter`, `filters.label`, `nav.search`. Ajouter `filters.dimensions.*`.

### Conventions et patterns

- **i18n** : 100% via `t()`, parité FR/EN stricte. Réutiliser `actions.clear_filters`.
- **Props Inertia plates** ; dates `.toISO()` ; agrégats `Number(p.$extras.alias)`.
- **Validation des query params** : `license` contre l'enum ; bornage de `page` ; les autres dimensions sont libres mais **toujours bindées** (jamais d'interpolation de string dans le SQL).
- **Nommage** : service `app/services/search_service.ts` (classe `SearchService`, méthodes statiques — cohérent avec `ProductionService`/`ActivityLogService`). Helper client `inertia/lib/search_query.ts` (fonctions pures).
- **Tests** : fonctionnels `tests/functional/public/`, unitaires `tests/unit/lib/` (helper pur, import direct) et `tests/unit/components/` (Node-pur sur source). `extractProps` (regex `data-page`) pour lire les props Inertia d'une réponse HTML.
- **Accessibilité** : `aria-pressed` sur chips, `role="group"`/`aria-label` sur FilterBar, `role="search"` sur SearchBar (déjà fait 5.2). Audit a11y complet = Story 5.6.

### Anti-patterns à éviter

- ❌ `to_tsquery('simple', q)` avec saisie brute → erreur SQL sur multi-mots. Utiliser `websearch_to_tsquery`.
- ❌ Config tsquery ≠ `'simple'` → zéro résultat (le trigger indexe en `'simple'`).
- ❌ Recréer le trigger / l'index GIN / une migration `search_vector` — déjà en place.
- ❌ Interpoler une valeur de filtre directement dans une string SQL — toujours bind (`?`).
- ❌ Filtrer `authors` comme une colonne texte (`where('authors', x)`) — c'est du `jsonb` → `@> ?::jsonb`.
- ❌ Implémenter le **tri configurable**, le **comptage**, le **toggle liste/grille**, la **variante list de ProductionCard**, l'**UI Pagination**, l'**état vide stylé** — c'est **Story 5.4**.
- ❌ Stocker l'état des filtres ailleurs que dans l'URL (pas de state local / localStorage pour les filtres).
- ❌ Casser l'usage homepage de `FilterBar` (chips catégorie → `/productions?category=`) lors de la refonte multi-dimension.
- ❌ Oublier `withAggregate` viewsCount/downloadsCount → `ProductionCard` afficherait 0/undefined.
- ❌ Texte en dur (libellés de dimensions, "Effacer filtres") — via i18n.

### Sécurité / conformité

- **Productions publiées uniquement** : `where status = PUBLISHED` dans `SearchService` — un brouillon ne doit jamais apparaître via recherche ou filtre.
- **Pas d'injection SQL** : valeurs bindées (`whereRaw(..., [value])`, `whereIn`), `license` validé contre l'enum. `q` passé à `websearch_to_tsquery` en paramètre lié.
- **Pages publiques indexables**, lecture seule.

### Project Structure Notes

**Fichiers créés :**

- `app/services/search_service.ts`
- `inertia/lib/search_query.ts`
- `tests/functional/public/search.spec.ts`
- `tests/unit/lib/search_query.spec.ts`

**Fichiers modifiés :**

- `app/controllers/public/productions_controller.ts` — stub → contrôleur réel (search + filtres + facettes + pagination)
- `inertia/pages/productions.tsx` — stub → page résultats (search + FilterBar + grille)
- `inertia/components/public/FilterBar.tsx` — multi-dimension + toggle + bouton "Effacer filtres" (compat homepage)
- `inertia/components/public/FilterChip.tsx` — ajustements état actif si nécessaire
- `inertia/locales/public/fr.json` / `en.json` — `filters.dimensions.*`
- `tests/unit/components/filter_chip.spec.ts` — MAJ assertions si refonte FilterBar
- `.adonisjs/*` — régénérés si nécessaire (codegen) ; committer

**Pas de migration, pas de modèle modifié** (relations stats déjà ajoutées en 5.2).

### Previous Story Intelligence (5.2 + 5.1 + Epic 4)

- **Story 5.2 (juste livrée)** : `HomeController` utilise `withAggregate('statsViews', q => q.count('*').as('viewsCount'))` + tri sur l'alias — **réutiliser ce pattern** dans `SearchService`. `ProductionCardData` = forme de sérialisation à réutiliser. Stub `/productions` (contrôleur + page) **à remplacer**. `FilterBar`/`FilterChip` créés (single category) **à enrichir**. Pattern de test : `extractProps(body)` via regex `data-page`, fixtures `createProduction` + `addViews`, rollback transactionnel.
- **Story 5.2 gotcha codegen** : remplacer un contrôleur/une page ne change pas les noms → probablement pas de régénération nécessaire, mais relancer `node ace test` régénère et committer `.adonisjs/*` si modifié.
- **Story 4.x** : `admin/productions_controller.ts` = référence pagination + validation enum query param. `ProductionService` = pattern service statique.
- **Flaky connu** : `tests/unit/models/production.spec.ts` (index GIN, planner Postgres sur table vide) — non lié, isolé.
- **CI PostgreSQL** (Story 1.8) : service Postgres réel en CI → les requêtes `tsvector`/`jsonb` s'exécutent comme en local.

### Latest Tech Information

- **PostgreSQL full-text** : `websearch_to_tsquery('simple', $1)` (robuste pour saisie utilisateur) + `search_vector @@ ...` + `ts_rank(search_vector, ...)` pour le tri par pertinence. GIN index requis (présent).
- **AdonisJS Lucid** : `.whereRaw("col @@ websearch_to_tsquery('simple', ?)", [q])`, `.orderByRaw(..., [q])`, `.whereIn(col, values)`, `.where((sub) => sub.orWhereRaw(...))` pour les groupes OR, `.paginate(page, perPage)` → `ModelPaginatorContract` (`.all()`, `.getMeta()`). `jsonb` containment via `@> ?::jsonb`.
- **Inertia 2.x** : `usePage().url` (path + query) pour dériver la query string courante ; `router.visit(url)` pour naviguer.
- **`URLSearchParams`** : `getAll(dim)` (multi-valeurs), `append`/`delete`, `toString()` (encodage auto).

### Questions / clarifications (pour l'utilisateur)

1. **Multi-select intra-dimension** : 5.3 implémente le multi-select (plusieurs valeurs d'une même dimension = OR), conforme UX-DR2. Confirmes-tu, ou veux-tu une seule valeur active par dimension pour le MVP (plus simple) ?
2. **Variante dropdown des filtres à nombreuses valeurs** (UX-DR2 évoque un dropdown pour ex. le domaine) : 5.3 rend des chips à plat pour toutes les dimensions. Le passage en dropdown (si trop de valeurs) est-il acceptable en amélioration ultérieure (Story 5.4/5.6) ?
3. **Rendu minimal des résultats en 5.3** : OK pour afficher une simple grille sans comptage/tri/toggle/pagination (tout cela arrivant en 5.4), afin d'éviter de construire deux fois l'UI de listing ?

### References

- [Source: epics.md#Story 5.3] — Acceptance Criteria d'origine (FR1–FR8, NFR2)
- [Source: epics.md#Story 5.4] — Périmètre listing (NE PAS empiéter : comptage, tri, toggle, pagination, état vide)
- [Source: architecture.md#1. Données — Trigger PostgreSQL pour tsvector] — Config `'simple'`, champs indexés
- [Source: architecture.md#services] — `SearchService.ts — full-text tsvector + filtres`
- [Source: architecture.md#Flux Clés — Recherche] — `SearchBar → GET /productions → ProductionsController → SearchService → tsvector`
- [Source: database/migrations/1775918733547_create_productions_table.ts] — `search_vector`, trigger `'simple'`, index GIN `idx_productions_search_vector`, `authors`/`tags` jsonb
- [Source: app/controllers/public/home_controller.ts] — Pattern `withAggregate`/sérialisation (Story 5.2)
- [Source: app/controllers/admin/productions_controller.ts] — Pattern pagination + validation enum query param
- [Source: app/enums/license_status.ts, production_status.ts] — Enums licence/statut
- [Source: ux-design-specification.md#FilterChip / FilterBar] — Multi-select, `aria-pressed`, état actif green-700, "Effacer tout", dropdown variante
- [Source: ux-design-specification.md#Comportement des Filtres] — Multi-select, réinitialisation, persistance URL
- [Source: Story 5.2] — Composants publics, stub à remplacer, patterns de test
- [Source: Story 5.1] — PublicLayout, gotcha codegen

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **`websearch_to_tsquery` au lieu de `to_tsquery`** (déviation justifiée de l'AC) : `to_tsquery` brut lève une erreur SQL sur une saisie multi-mots. `websearch_to_tsquery('simple', ?)` est robuste. Config `'simple'` identique au trigger. Le test `?q=topologie quantique` confirme l'absence d'erreur.
- **Frontière TS inertia/ — TS6305** : le test unitaire du helper `search_query.ts` ne peut PAS importer le module directement (`tsc --noEmit` échoue avec TS6305 — le module appartient au projet composite `inertia/tsconfig.json`). Convention du repo (cf. `notify.spec.ts`, `production_completion.spec.ts`) : vérification de la **source** via `fs`. Le comportement réel du filtrage est couvert end-to-end par `search.spec.ts` (à travers le contrôleur).
- **Test `productions.spec.ts` (5.2) obsolète** : il assertait le contrat du stub (props `q`/`category` plats). Le stub ayant été remplacé, le test échouait (`props.category` désormais `undefined`). Mis à jour pour le vrai contrat (`results`/`facets`/`activeFilters`/`pagination`/`q`).
- **Décisions sur les 3 questions ouvertes (recommandations appliquées)** : (1) multi-select OR intra-dimension implémenté ; (2) chips à plat (pas de dropdown) ; (3) rendu minimal des résultats en 5.3. À confirmer en review.

### Completion Notes List

- AC1–AC4 satisfaits ; AC5 (tests) vert (282/282)
- `SearchService` : full-text `tsvector` (`websearch_to_tsquery('simple')` + `ts_rank`), filtres AND inter-dimensions / OR intra-dimension, filtre auteur sur `jsonb` (`@> ?::jsonb`), pagination serveur, facettes distinctes
- `ProductionsController` réécrit (stub → réel) : parse/validation params, `license` validé contre l'enum, sérialisation `ProductionCardData`
- Helper client `search_query.ts` : état d'URL des filtres (toggle/clear/setQuery), source de vérité = query params
- `FilterBar` enrichi (mode listing multi-dimension + "Effacer filtres" ; mode homepage conservé)
- `productions.tsx` réécrit : SearchBar + FilterBar + grille de résultats (comptage/tri/toggle/pagination/empty stylé = Story 5.4)
- i18n `filters.dimensions.*` + `productions.no_results` (parité FR/EN)
- Infra full-text (trigger + index GIN) **réutilisée telle quelle** — aucune migration
- Tests : 282/282, lint 0, typecheck 0
- Tâche 8.4 (test manuel navigateur) restante — utilisateur
- **NFR2 (< 1s)** : la requête `@@` s'appuie sur l'index GIN `idx_productions_search_vector` ; non mesuré automatiquement (échelle Anta faible)

### File List

**Créés :**
- `app/services/search_service.ts`
- `inertia/lib/search_query.ts`
- `tests/functional/public/search.spec.ts`
- `tests/unit/lib/search_query.spec.ts`

**Modifiés :**
- `app/controllers/public/productions_controller.ts` — stub → contrôleur réel (search + filtres + facettes + pagination)
- `inertia/pages/productions.tsx` — stub → page résultats (SearchBar + FilterBar + grille)
- `inertia/components/public/FilterBar.tsx` — mode listing multi-dimension + "Effacer filtres" (compat homepage)
- `inertia/locales/public/fr.json` / `en.json` — `filters.dimensions.*`, `productions.no_results`
- `tests/functional/public/productions.spec.ts` — adapté au vrai contrat (n'était plus aligné avec le stub remplacé)
- `.adonisjs/*` — régénérés si nécessaire (codegen), à committer

### Change Log

- 2026-06-01 : Implémentation Story 5.3 (Recherche full-text + filtres multi-critères). `SearchService` (tsvector `websearch_to_tsquery('simple')` + `ts_rank`, filtres AND/OR, author jsonb, facettes, pagination), `ProductionsController` réel (remplace le stub 5.2), helper d'URL `search_query.ts`, `FilterBar` multi-dimension + "Effacer filtres", i18n. Aucune migration (infra full-text préexistante). 4 fichiers créés, 6 modifiés. Tests : 282/282 verts, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [ ] [Review][Patch] Tri sans départage déterministe → pagination instable sur ex-aequo [app/services/search_service.ts + app/controllers/public/home_controller.ts] — `orderBy('viewsCount'|'downloadsCount'|'antaPublishedAt', 'desc')` sans `orderBy` secondaire. En cas d'égalité (catalogue neuf à 0 vue, même `antaPublishedAt`), PostgreSQL ne garantit pas un ordre stable entre requêtes `LIMIT/OFFSET` → une production peut réapparaître page 2 ou être sautée. Touche aussi les sections homepage (5.2). **Fix** : ajouter un tiebreaker déterministe (ex. `.orderBy('id', 'asc')`) dans `SearchService.search` et `HomeController.publishedWithCounts`. (edge)
- _Note : le claim « CRITICAL orderBy sur alias d'agrégat sous paginate » (Blind Hunter) a été **vérifié et écarté** — ordering testé et fonctionnel (home/listing/search_service specs verts)._
