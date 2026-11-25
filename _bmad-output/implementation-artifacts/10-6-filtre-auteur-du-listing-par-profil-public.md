---
baseline_commit: 144d424
---

# Story 10.6 : Filtre auteur du listing par profil public

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur,
je veux filtrer le listing par un ou plusieurs auteurs enregistrés,
afin de retrouver toutes les productions d'un auteur (FR5, D12, D28, flux 5).

## Décision de périmètre (lire en premier)

- **Aucune migration, aucune route nouvelle, aucune dépendance npm.** `GET /productions` existe (`productions`, `ProductionsController.index`) : `.adonisjs` ne change pas (régénérer seulement si une route bouge — ce n'est pas prévu).
- **Le paramètre `author` change de sens** : valeur = **slug** d'auteur (D28), répétable (OU). Le filtre texte libre sur `productions.authors` (jsonb, `applyJsonbFilter(query, 'authors', …)`) est **débranché** du listing. Les anciens liens `?author=<nom libre>` ne renvoient jamais d'erreur : un nom n'est pas un slug visible → ignoré (listing non filtré par auteur).
- **Visibilité à source unique** : la facette part de `Author.query().withScopes(s => s.visibleOnSite())` (10.4/10.5). Les slugs demandés sont validés **contre la facette déjà chargée** (même mécanique que `knownFilters` de 10.5) : un slug inconnu, non public ou sans production publiée est traité exactement pareil (ignoré, absent de `activeFilters`, aucune différence de réponse) → aucune révélation d'existence. Aucun prédicat de consentement réécrit en SQL.
- **Filtre** : `whereExists` sur `production_authors` ⨝ `authors` (`authors.slug IN (…)`), OU entre auteurs, ET avec les autres dimensions et la recherche ; s'applique à la recherche exacte **et** aux résultats approchants (même `baseQuery`).
- **Facette** : `facets.author` = `{ value: slug, label: "Prénom NOM" }[]` (`formatAuthorName`), triée nom de famille, prénom, `id` (comme le tri `name` de `/authors`), au lieu des valeurs distinctes du jsonb. Le code jsonb générique (`distinctJsonbValues`, `applyJsonbFilter`) **reste** (toujours utilisé par `subdomain`) ; sa suppression pour les auteurs fait partie du « contract » (hors Phase 2, architecture « `productions.authors` : expand/contract »).
- **Hors périmètre** : SEO des pages auteurs (10.7), suite de tests 10.8, lien « toutes ses productions » depuis le profil, migration du tri vers `SortSelect` (12.1), axe WCAG global (Epic 13).
- Aucun nom réel dans le code, les tests ou les textes ; noms fictifs (« Jeanne EXEMPLE »). Les tests existants qui utilisaient des noms dans le filtre jsonb sont réécrits avec des noms fictifs.

## Acceptance Criteria

1. **Filtre par slug** — `GET /productions?author=<slug>` (répétable) ne garde que les productions **publiées** liées (pivot) à au moins un des auteurs demandés (OU, `whereExists` pivot + `authors.slug`), combiné en ET avec `category`, `domain`, `subdomain`, `language`, `country`, `license` et `q` ; tri et pagination inchangés (départage `id`).
2. **Slugs ignorés** — un slug inconnu, d'un profil non public (sans consentement) ou d'un profil sans production publiée est ignoré sans erreur : réponse 200, absent de `activeFilters.author`, résultats identiques à une requête sans ce slug. Un ancien lien `?author=<nom libre>` donne 200 et le listing non filtré par auteur. Plus de 20 valeurs (`qs` `arrayLimit: 20`, le tableau devient un objet), une valeur non chaîne ou vide → ignorées, jamais de 500.
3. **Approchants** — avec `q` sans résultat exact, les résultats approchants (OU relâché, puis `pg_trgm`) respectent le filtre auteur.
4. **Facette** — `facets.author` = `{ value: slug, label: "Prénom NOM" }[]` des seuls auteurs visibles (consentement confirmé **et** ≥ 1 production publiée liée, D12), triés nom, prénom, `id` ; aucun champ interne (ni `id`, ni consentement) ; les noms jsonb non convertis n'y figurent plus.
5. **UI** — `FilterSidebar` (dimension « Auteur ») affiche les libellés « Prénom NOM », filtre la liste par la recherche de facette (insensible à la casse et aux accents), coche/décoche via l'URL (`author=<slug>`) ; chaque ligne est opérable au clavier (Entrée **et** Espace, `aria-pressed`) ; le compteur de résultats est annoncé (`aria-live="polite"`). `FilterBar` (mode listing) accepte la même forme de facette.
6. **Paramètres conservés** — la pagination (`setPage`) et les autres filtres/tri/recherche conservent `author` ; « Effacer filtres » (en-tête du panneau) retire les autres dimensions et conserve `author` et `q` ; il n'apparaît que si un filtre hors auteur est actif ; l'état vide garde `author`, sauf s'il est le seul filtre (sortie) (D-10.6-2, amendée le 2026-11-21).
7. **i18n** — inchangée (libellé « Auteur » / « Author » et `filters.author_search` existants).

## Tasks / Subtasks

- [x] **T1 — Tests rouges (functional)** `tests/functional/public/search.spec.ts` (AC 1–4)
  - [x] Remplacer « filtre auteur sur le tableau jsonb » et l'assertion `facets.author` jsonb par des scénarios slug : un slug ; deux slugs en OU ; combinaison avec catégorie ; avec `q` ; slug non public (sans consentement) ignoré ; slug sans production publiée (brouillon) ignoré ; slug inconnu ignoré ; ancien nom libre → 200 non filtré ; 21 valeurs → 200 ; approchants filtrés ; facette limitée aux auteurs visibles, forme `{ value, label }`, ordre ; pagination page 2 avec `author`.
  - [x] Isolation : `db.from('production_authors').delete()` dans la transaction globale des groupes auteurs.
  - [x] Vérifier qu'ils échouent avant implémentation.
- [x] **T2 — Service** `app/services/search_service.ts` (AC 1, 3, 4)
  - [x] Type `AuthorFacetOption = { value: string; label: string }` ; `Facets = Omit<ProductionFilters, 'author'> & { author: AuthorFacetOption[] }`.
  - [x] `baseQuery` : `author` → `whereExists(production_authors ⨝ authors, authors.slug IN …)` à la place de `applyJsonbFilter('authors')` ; commenter que `author` doit contenir des slugs visibles (résolus par l'appelant).
  - [x] `facets()` : `author` ← `PublicAuthorService.facetOptions()`.
- [x] **T3 — Visibilité** `app/services/public_author_service.ts` (AC 2, 4)
  - [x] `facetOptions()` : scope `visibleOnSite`, `select slug, first_names, last_names`, ordre nom/prénom/id, label `formatAuthorName`.
  - [x] `knownAuthorSlugs(requested, options)` : sous-ensemble dédoublonné, dans l'ordre demandé, des slugs présents dans la facette.
- [x] **T4 — Contrôleur** `app/controllers/public/productions_controller.ts` (AC 1–3, 6) : facettes chargées **avant** la recherche ; `filters.author = knownAuthorSlugs(asArray(author), facets.author)` ; `activeFilters` = filtres résolus.
- [x] **T5 — Client** (AC 5, 6)
  - [x] `inertia/lib/search_query.ts` : `FacetOption`, `Facets` (auteur = options), `facetOptions(facets, dim, labelOf)` pur ; `matchesFacetQuery(label, query)` (casse + accents).
  - [x] `FilterSidebar.tsx` : options `{ value, label }`, recherche de facette sur `label`, `CheckboxRow` gère Espace (`router.visit`), comme `FilterChip`.
  - [x] `FilterBar.tsx` : mode listing via `facetOptions`.
  - [x] `inertia/pages/productions.tsx` : `aria-live="polite"` sur le compteur.
- [x] **T6 — Tests unitaires par lecture de source** (TS6305) : `tests/unit/lib/search_query.spec.ts` (forme de facette, `matchesFacetQuery`, `clearFilters` retire `author`, `setPage` conserve) ; `tests/unit/components/filter_sidebar.spec.ts` (libellé d'option, Espace, `aria-pressed`, recherche par label) ; compteur `aria-live`.
- [x] **T7 — Vérifications** : `npm run test:local` (base 970 + nouveaux), lint, typecheck, build (codes de sortie) ; statut `review`.

## Dev Notes

### État actuel (fichiers UPDATE, lus)

- `app/services/search_service.ts` : `ProductionFilters` (7 dimensions, tableaux ; OU intra, ET inter) ; `baseQuery` (publiées + agrégats vues/téléchargements + filtres ; `authors` et `subdomain` via `applyJsonbFilter` = `col @> '["v"]'`) ; `search` (tsvector `'simple'`, tris, départage `id`, `paginate`) ; `approximate` (OU relâché puis `similarity(title) > 0.1`, mêmes filtres via `baseQuery`) ; `facets()` (`distinctValues` + `distinctJsonbValues('authors' | 'subdomain')`). **Préserver** : tout sauf la ligne auteur de `baseQuery` et la source de `facets.author`.
- `app/controllers/public/productions_controller.ts` `index` : `asArray` (tableau de chaînes non vides, chaîne → `[v]`, sinon `[]` — un objet issu de `qs` au-delà de 20 valeurs donne `[]`), `license` validée contre l'enum, `search` puis `facets`, `PublicBylineService.attach` sur la page et sur les approchants, `activeFilters: filters`. **Préserver** l'ordre bylines/approchants, `meta` SEO.
- `app/services/public_author_service.ts` : `visibleSlugs`, `findVisibleBySlug`, `visibleAuthorIds()` (sous-requête du scope), `list`, `knownFilters` (10.5 : valeur inconnue → `null`, aucun filtrage). Ajouter `facetOptions` et `knownAuthorSlugs` à côté.
- `app/models/author.ts` : scope `visibleOnSite` = **seule** définition de la visibilité.
- `app/helpers/author_name.ts` : `formatAuthorName(first, last)` = « Prénom NOM » (miroir client dans `inertia/lib/author_form.ts`).
- `inertia/lib/search_query.ts` : `FILTER_DIMENSIONS`, `Facets = Record<dim, string[]>`, `toggleFilter` (retire `page`), `clearFilters` (retire toutes les dimensions + `page`, garde `q`/`sort`), `setPage` (garde tout).
- `inertia/components/public/FilterSidebar.tsx` : `DimensionGroup` (`<details>`, recherche de facette pour `author` sur la **valeur**), `CheckboxRow` = `Link` `aria-pressed` (Entrée seulement). `FilterBar.tsx` : mode listing (aujourd'hui inutilisé par les pages, à garder typé) + mode accueil catégories (test `snap-x`). `facetValueLabel` (`inertia/lib/taxonomy.ts`) traduit catégorie/domaine/sous-domaine, renvoie la valeur sinon.
- `inertia/pages/productions.tsx` : `FilterSidebar`, état vide avec « Effacer les filtres », compteur `productions.results_count`, `Pagination buildHref=setPage`.

### Garde-fous

- Jamais d'interpolation SQL : `whereIn('authors.slug', slugs)` dans le `whereExists` ; `whereColumn('production_authors.production_id', 'productions.id')`.
- Pas de N+1 : facette = 1 requête ; filtre = sous-requête corrélée ; bylines inchangées (`attach`, 2 requêtes).
- Non-révélation : la réponse pour un slug non visible doit être **indiscernable** de celle d'un slug inconnu (mêmes props). Le nom d'un auteur non visible n'apparaît nulle part dans le HTML (vérifier `notInclude`).
- `inertia/` testé par lecture de source ; Japa `db.beginGlobalTransaction()` ; `refreshDenormalizedNames` après insertion pivot (comme `authors_list.spec.ts`).
- Les labels de facette sont « Prénom NOM » : la recherche de facette compare sur le label normalisé (`NFD`, diacritiques retirés, minuscules).

### Décisions par défaut (D-10.6-x)

- **D-10.6-1** Slug non visible / inconnu / nom libre → ignoré **silencieusement** (aucun message), `activeFilters.author` ne contient que les slugs résolus (puces cohérentes).
- **D-10.6-2** ~~« Effacer filtres » retire `author`~~ — **amendée le 2026-11-21 (Aurélien)** : « Effacer filtres » **conserve** `author` (et `q`), conformément à l'epic ; le lien n'est affiché que si un filtre hors auteur est actif (`hasClearableFilters`). À l'état vide, « Réinitialiser les filtres » garde `author` ; si l'auteur est le seul filtre actif, il est retiré (`clearFilters(search, { includeAuthor: true })`) pour qu'une sortie existe. La pagination le conserve.
- **D-10.6-3** Validation contre la facette chargée (aucune requête supplémentaire) plutôt qu'une requête de résolution dédiée.
- **D-10.6-4** Ordre de la facette = nom de famille, prénom, `id` (comme `/authors` tri `name`).
- **D-10.6-5** Pas de repli sur le jsonb pour les productions non converties : seules les productions liées par le pivot sont filtrées (après la bascule 9.7, toutes le sont).
- **D-10.6-6** `aria-live="polite"` ajouté au compteur de résultats (flux 5 « le nombre de résultats est lu »).

### Porte de déploiement

- **10.6 (comme 9.7) ne se déploie qu'après `authors:apply` + `authors:verify` à 100 %** : le filtre et la facette ne lisent que le pivot ; avant la conversion, une production non liée ne serait plus trouvable par auteur.

### Review Findings

- [x] [Review][Patch] Remontage de la page à chaque bascule [FilterSidebar.tsx, FilterChip.tsx, FilterBar.tsx] — visite GET d'Inertia sans `preserveState` = nouvelle clé (vérifié dans `@inertiajs/core` : `preserveState ?? method !== 'get'`) → recherche de facette, groupe déplié et `aria-live` perdus. `preserveState` + `preserveScroll` sur les bascules et « Effacer filtres » du panneau ; `<details>` piloté par un état local (`onToggle`), reste ouvert ; région `role="status"` `aria-live` toujours montée hors des branches résultats / aucun / approchants (« N résultat(s) », « Aucune production… », avis approchant) ; compteur visible `aria-hidden`.
- [x] [Review][Patch] Plus de 20 auteurs [FilterSidebar.tsx, public_author_service.ts] — à 20 auteurs actifs, lignes non cochées inertes (`aria-disabled`) + aide `filters.author_limit` (FR/EN) ; serveur : `parseAuthorParam` garde les valeurs de l'objet `qs` (au-delà de `arrayLimit` ou `author[x]=`), 20 premières ; `knownAuthorSlugs` borne aussi à 20. Tests : 21 auteurs visibles → 20 retenus ; `author[x]=<slug>` retenu.
- [x] [Review][Patch] Défense en profondeur [search_service.ts] — la sous-requête auteur se limite à `PublicAuthorService.visibleAuthorIds()` (scope unique `Author.visibleOnSite`) ; test unitaire : appel direct avec un slug non public → aucun résultat (rouge vérifié).
- [x] [Review][Patch] Recherche de facette [search_query.ts, FilterSidebar.tsx] — auteurs cochés toujours affichés ; chaque mot saisi cherché indépendamment, dans n'importe quel ordre ; œ/æ/ø/ß/ł/đ repliés.
- [x] [Review][Patch] Tests renforcés [search.spec.ts] — > 20 valeurs / vide / indexée : résultats non filtrés et `activeFilters.author == []` ; étape « OU relâché » des approchants avec filtre auteur ; ordre de la facette indépendant de la collation (même casse).
- [x] [Review][Patch] Espace [keyboard.ts, FilterSidebar.tsx, FilterChip.tsx] — `spaceToggle` : répétition avalée sans nouvelle visite, modificateurs laissés au navigateur ; appliqué aussi à `FilterChip` ; test de comportement.
- [x] [Review][Patch] Valeurs `author` ignorées recopiées [search_query.ts, productions.tsx, FilterSidebar.tsx, FilterBar.tsx] — `withActiveAuthors(search, activeFilters.author)` reconstruit les paramètres `author` avant bascule, pagination, tri et recherche.
- [x] [Review][Defer] Facette auteur non bornée → `deferred-work.md`.
- [x] [Review][PO] D-10.6-2 : tranchée le 2026-11-21 — « Effacer filtres » conserve le filtre auteur.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.6] ; en-tête Epic 10 (règle de visibilité) ; 10.8 (scénarios `author=<slug>`).
- [Source: architecture.md#P2.6] (`/productions` : filtre `author=<slug>` répétable, `whereExists` pivot + `authors.slug`, facette `{ value: slug, label }` D12) ; « `productions.authors` (jsonb) : expand/contract » (facette jsonb = contract).
- [Source: prd.md] FR5 (modifié Phase 2 : profils publics seulement).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] URL listing (`author=<slug>` répétable), état « Listing — Filtre auteur », Flux 5 (clavier, NVDA, recherche de facette, compteur lu), confidentialité (profil non public absent du filtre).
- [Source: 10-4-…md] (scope `visibleOnSite`, bylines), [10-5-…md] (`knownFilters`, isolation pivot, facettes via scope).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Rouge vérifié : 11 tests functional (`search.spec.ts`) en échec avant le code serveur ; 7 tests unitaires (source + comportement) en échec avec `inertia/` remis à l'état de base (`git stash`), les 2 tests de non-régression d'URL (`toggleFilter`, `setPage`/`clearFilters`) verts dès la base.
- Régressions attendues corrigées : `tests/unit/services/search_service.spec.ts` (« author (jsonb) », facette auteurs aplatis) réécrits pour le slug / les profils visibles.
- `npm run test:local` : 989 tests verts (base 970) ; `lint`, `typecheck`, `build` : code 0. Aucune route modifiée → `.adonisjs` inchangé.

### Completion Notes List

- `SearchService.baseQuery` : filtre `author` = `whereExists` (`production_authors` ⨝ `authors`, `authors.slug IN …`, corrélé sur `productions.id`) à la place du containment jsonb ; s'applique à la recherche exacte et aux approchants. `Facets.author` = `AuthorFacetOption[]` via `PublicAuthorService.facetOptions()` (scope `visibleOnSite`, « Prénom NOM », ordre nom/prénom/id, une requête). `distinctJsonbValues` / `applyJsonbFilter` gardés pour `subdomain` (contract).
- `ProductionsController.index` : facettes chargées avant la recherche ; `PublicAuthorService.knownAuthorSlugs` ne garde que les slugs de la facette (dédoublonnés, ordre demandé) → slug inconnu / non public / sans production publiée / ancien nom libre / > 20 valeurs : ignorés, réponse identique (vérifié par comparaison des props).
- Client : `search_query.ts` (`FacetOption`, `Facets` typé, `facetOptions`, `matchesFacetQuery` NFD + minuscules) ; `FilterSidebar` (libellés, recherche sur le libellé, Espace sur `CheckboxRow`), `FilterBar` (même forme ; fichier reformaté par Prettier, écart préexistant), compteur `aria-live="polite"`.
- Tests : 11 functional (un slug, OU, ET catégorie/`q`, approchants, non public sans fuite, brouillon seul, slug inconnu mêlé, ancien nom libre, > 20 valeurs et formes indexées, facette visible + forme + ordre, pagination) ; unitaires `search_service` (2 réécrits), `search_query_behavior.spec.ts` (helpers exécutés via import dynamique, aucun import statique → pas de TS6305), `filter_sidebar.spec.ts` (source). Noms réels retirés des tests touchés.

### File List

- app/controllers/public/productions_controller.ts (modifié)
- app/services/search_service.ts (modifié)
- app/services/public_author_service.ts (modifié)
- inertia/lib/search_query.ts (modifié)
- inertia/components/public/FilterSidebar.tsx (modifié)
- inertia/components/public/FilterBar.tsx (modifié)
- inertia/pages/productions.tsx (modifié)
- tests/functional/public/search.spec.ts (modifié)
- tests/unit/services/search_service.spec.ts (modifié)
- tests/unit/lib/search_query_behavior.spec.ts (nouveau)
- tests/unit/components/filter_sidebar.spec.ts (nouveau)
- tests/unit/components/filter_chip.spec.ts (modifié, revue)
- inertia/lib/keyboard.ts (nouveau, revue)
- inertia/components/public/FilterChip.tsx (modifié, revue)
- inertia/locales/public/fr.json, en.json (modifiés, revue : `filters.author_limit`)
- _bmad-output/implementation-artifacts/deferred-work.md (modifié, revue)
- _bmad-output/implementation-artifacts/10-6-filtre-auteur-du-listing-par-profil-public.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

- AC « Effacer filtres … conserve le paramètre `author` » : appliqué tel quel après décision d'Aurélien (2026-11-21, D-10.6-2 amendée).
- Les productions non converties (noms seulement dans le jsonb) ne sont plus filtrables par auteur (D-10.6-5) ; sans objet après `authors:apply` + `verify` à 100 %.
- Faut-il un lien « Toutes ses productions » (`/productions?author=<slug>`) sur le profil ? Non prévu par les epics.

## Change Log

- 2026-11-19 : story créée (contexte complet, ready-for-dev).
- 2026-11-19 : revue de code appliquée (7 correctifs, 1 report, 1 question PO) ; statut done.
- 2026-11-19 : implémentation (filtre `author=<slug>` par pivot, facette des auteurs visibles, clavier, compteur annoncé) ; 989 tests ; statut review.
