# Story 5.4 : Listing des résultats avec tri, toggle et pagination

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que visiteur,
Je veux voir les résultats avec le nombre total, pouvoir les trier et basculer entre vue liste et grille,
Afin d'explorer le catalogue selon mes préférences (FR16 listing, UX-DR2, UX-DR4, UX-DR5, UX-DR12, UX-DR19).

> **4ᵉ et dernière story "fonctionnelle" du listing public.** Elle habille la page `/productions` livrée en Story 5.3 (qui fournit déjà `results`, `pagination` méta, `facets`, `activeFilters`, `q`). 5.4 ajoute : **comptage** des résultats, **dropdown de tri** (Pertinence/Date/Vues/Téléchargements), **ListingToggle** liste/grille (persisté localStorage), **variante `list`** de `ProductionCard`, **état vide stylé** ("Aucune production trouvée pour « {terme} »" + réinitialiser), et l'**UI de pagination numérotée** (composant `Pagination` existant) avec préservation des filtres+recherche+tri. La **logique de recherche/filtres** (Story 5.3) et le **branchement backend du tri** (ajout d'un param `sort` au `SearchService`) sont les seules touches backend.

## Acceptance Criteria

**AC1 — Comptage + dropdown de tri**

- **Given** une recherche ou un filtre est actif (ou le listing nu)
- **When** la page `/productions` affiche les résultats
- **Then** le nombre total de résultats est affiché : "{N} résultat(s)" (`productions.results_count`, depuis `pagination.total`)
- **And** un dropdown "Trier par" (`sort.label`) est visible avec les options : **Pertinence**, **Date**, **Vues**, **Téléchargements**

**AC2 — Changement de tri reflété dans l'URL**

- **Given** le visiteur change l'option de tri
- **When** le dropdown est mis à jour
- **Then** les résultats se réordonnent (navigation Inertia vers `/productions?...&sort=<option>`) et le critère est reflété dans l'URL (`sort`)
- **And** `SearchService` applique l'ordre : `relevance` (par `ts_rank`, requiert `q` — sinon retombe sur Date), `date` (`antaPublishedAt` desc), `views` (`viewsCount` desc), `downloads` (`downloadsCount` desc)
- **And** `q` et les filtres actifs sont **préservés** lors du changement de tri (le param `page` est réinitialisé)

**AC3 — ListingToggle liste/grille persisté**

- **Given** la page listing est affichée
- **When** le `ListingToggle` est rendu
- **Then** la vue **liste** est active par défaut
- **And** le choix est sauvegardé en **localStorage** et restauré à la prochaine visite
- **And** le toggle expose `role="group"` + `aria-pressed` sur chaque bouton

**AC4 — Variante liste de `ProductionCard` (FR16)**

- **Given** la vue liste est active
- **When** chaque `ProductionCard` est rendue
- **Then** elle affiche : **titre**, **auteur(s)**, **catégorie**, **résumé tronqué**, **compteurs de vues et téléchargements** (FR16)
- **And** la carte est un `<article>` avec le titre en `<h3 class="font-display">` lié à `/productions/:id`

**AC5 — Vue grille responsive**

- **Given** la vue grille est active
- **When** les `ProductionCard` sont rendues
- **Then** elles s'affichent en grille **1 → 2 → 3 colonnes** selon le breakpoint (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)

**AC6 — État vide**

- **Given** la recherche/les filtres ne retournent aucun résultat
- **When** la liste est rendue
- **Then** un état vide s'affiche : "Aucune production trouvée pour « {terme} »" si `q` est présent (`productions.no_results_for`), sinon un message factuel générique (`productions.no_results`)
- **And** un bouton "Réinitialiser les filtres" (`productions.reset_filters`) est proposé quand au moins un filtre est actif (→ `clearFilters`)

**AC7 — Pagination numérotée préservant l'état**

- **Given** plus de 20 résultats existent
- **When** la pagination numérotée s'affiche
- **Then** les liens de page préservent **q + filtres + sort** (seul `page` change)
- **And** le composant `Pagination` existant (`inertia/components/shared/Pagination.tsx`) est réutilisé

**AC8 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `SearchService`/contrôleur : `?sort=views` ordonne par vues desc, `?sort=date` par `antaPublishedAt` desc, `?sort=downloads` par téléchargements desc ; `sort` invalide → fallback ; `sort` reflété dans les props
  - `pagination.total` correct ; `?page=2&sort=views&category=X` préserve tri + filtres
  - Helpers `setSort`/`setPage` (source ou pur) : préservent `q`+filtres, `setSort` réinitialise `page`, `setPage` ne touche qu'à `page`
  - `ListingToggle`/`ProductionCard` variante list : assertions source (Node-pur) — `aria-pressed`, `localStorage`, champs FR16
  - Parité i18n FR/EN (`translations.spec.ts` vert)

## Tasks / Subtasks

- [x] **Tâche 1 — Tri backend dans `SearchService`** (AC2)
  - [x] 1.1 Param `sort: SortOption` ajouté ; `SORT_OPTIONS`/`SortOption` exportés.
  - [x] 1.2 Logique : `views`→`orderBy('viewsCount','desc')`, `downloads`→`orderBy('downloadsCount','desc')`, `relevance`+q→`ts_rank`, sinon (`date`/`relevance` sans q)→`antaPublishedAt desc`.
  - [x] 1.3 `withAggregate` viewsCount/downloadsCount conservés.
  - [x] 1.4 `SORT_OPTIONS`/`SortOption` exportés.

- [x] **Tâche 2 — `sort` dans `ProductionsController`** (AC1, AC2)
  - [x] 2.1 `sort` validé contre `SORT_OPTIONS` ; défaut `q ? 'relevance' : 'date'`.
  - [x] 2.2 Passé à `SearchService.search`.
  - [x] 2.3 `sort` ajouté aux props.

- [x] **Tâche 3 — Helpers d'URL `setSort` / `setPage`** (AC2, AC7)
  - [x] 3.1 `setSort` (fixe `sort`, retire `page`).
  - [x] 3.2 `setPage` (fixe `page`, préserve le reste).
  - [x] 3.3 Réutilise `parse`/`toQueryString`.

- [x] **Tâche 4 — Variante `list` de `ProductionCard`** (AC4, AC5)
  - [x] 4.1 Prop `variant?: 'grid' | 'list'` (défaut grid).
  - [x] 4.2 Variante `list` : titre `font-display` lié `/productions/:id`, auteurs, catégorie, résumé `line-clamp-2`, compteurs `Eye`/`Download`.
  - [x] 4.3 Variante `grid` conservée (`line-clamp-3`).

- [x] **Tâche 5 — Composant `ListingToggle`** (AC3)
  - [x] 5.1 Créé (contrôlé `value`/`onChange`, `List`/`LayoutGrid`, `role="group"`, `aria-pressed`, libellés i18n).
  - [x] 5.2 Présentationnel (persistance gérée par la page).

- [x] **Tâche 6 — Refonte de la page `productions.tsx`** (AC1, AC3, AC5, AC6, AC7)
  - [x] 6.1 En-tête : comptage + `Select` tri + `ListingToggle` (responsive).
  - [x] 6.2 `Select` value=sort, `onValueChange` → `router.visit(setSort)`, 4 options i18n.
  - [x] 6.3 Rendu `list` (pile) / `grid` (1→2→3 colonnes).
  - [x] 6.4 `view` en localStorage (`anta:productions-view`, défaut list, garde `typeof window`).
  - [x] 6.5 État vide stylé (`no_results_for`/`no_results`) + "Réinitialiser les filtres" si `hasActiveFilters`.
  - [x] 6.6 `Pagination` avec `buildHref={(p) => '/productions' + setPage(search, p)}`.
  - [x] 6.7 SearchBar + FilterBar conservées.

- [x] **Tâche 7 — Étendre `shared/Pagination.tsx`** (AC7)
  - [x] 7.1 Prop optionnelle `buildHref?: (page) => string`.
  - [x] 7.2 `hrefFor = buildHref ?? defaultBuildHref(page, queryParams)` pour tous les liens.
  - [x] 7.3 Usage admin inchangé (pas de `buildHref` → comportement `queryParams`).

- [x] **Tâche 8 — i18n** (AC1, AC2, AC3, AC6)
  - [x] 8.1 `productions.results_count/no_results/no_results_for/reset_filters`, `sort.*`, `listing.*` ajoutés FR/EN.
  - [x] 8.2 Clés stub 5.2/5.3 nettoyées (`active_search`, `active_category`, `results_pending`) des deux locales.
  - [x] 8.3 `translations.spec.ts` vert.

- [x] **Tâche 9 — Tests** (AC8)
  - [x] 9.1 `tests/functional/public/listing.spec.ts` : tri views/date/downloads, fallback invalide, défaut, `pagination.total`, `?page=2&sort=views&category=X` préserve tri+filtre.
  - [x] 9.2 `search_query.spec.ts` complété (source `setSort`/`setPage`).
  - [x] 9.3 `tests/unit/components/listing_toggle.spec.ts` (source).
  - [x] 9.4 `tests/unit/components/production_card.spec.ts` (source — variantes, FR16, line-clamp, lien détail).
  - [x] 9.5 Fixtures `createProduction` + `addViews`/`addDownloads`, rollback transactionnel.

- [x] **Tâche 10 — Validation finale**
  - [x] 10.1 `node ace test` → 298/298 verts.
  - [x] 10.2 `npm run lint` → 0 erreur.
  - [x] 10.3 `npm run typecheck` → 0 erreur.
  - [ ] 10.4 Test manuel `npm run dev` (**utilisateur**) : changer le tri → URL `?sort=...` + réordre ; basculer liste/grille → persiste après rechargement ; recherche sans résultat → état vide + réinitialiser ; >20 résultats → pagination préserve filtres+tri.

## Dev Notes

### Architecture cible (synthèse)

- **5.4 = couche présentation du listing** sur les données déjà fournies par la Story 5.3. Le seul ajout backend est le **paramètre `sort`** (tri configurable) dans `SearchService` + `ProductionsController`. Tout le reste (recherche tsvector, filtres AND/OR, facettes, pagination serveur, `activeFilters`) est **déjà livré** — ne pas y retoucher.
- **`view` (liste/grille) = préférence localStorage, PAS dans l'URL** (UX-DR4 : "sauvegardé en localStorage"). À l'inverse, `sort` **EST dans l'URL** (UX-DR5 : reflété + partageable). Bien distinguer les deux états.
- **`ssr: false`** (cf. `vite.config.ts` / architecture) : pas de rendu React serveur → `window`/`localStorage` sont disponibles au montage du composant. Lecture localStorage possible dans l'initialiseur `useState` (garder `typeof window !== 'undefined'` par sécurité/tests).
- **Pagination multi-valeurs** : le composant `Pagination` actuel préserve des `queryParams: Record<string,string>` (mono-valeur) — insuffisant pour `category=A&category=B`. On ajoute un `buildHref` optionnel qui délègue à `setPage` (préserve la query string entière). L'admin continue d'utiliser `queryParams` (inchangé).

### État existant à RESPECTER (livré en 5.1/5.2/5.3 — réutiliser)

- `inertia/pages/productions.tsx` (5.3) — **à refondre** : aujourd'hui SearchBar + FilterBar + grille simple + texte `no_results`. 5.4 ajoute header(count+sort)+toggle+variantes+empty stylé+pagination.
- `app/services/search_service.ts` (5.3) — `search({ q, filters, page, perPage })` + `facets()`. **Ajouter le param `sort`** (le tri actuel `q?ts_rank:antaPublishedAt` devient le cas `relevance`/`date`).
- `app/controllers/public/productions_controller.ts` (5.3) — parse params + facettes + sérialisation `ProductionCardData`. **Ajouter** parse/validation `sort` + prop `sort`.
- `inertia/lib/search_query.ts` (5.3) — `toggleFilter`/`clearFilters`/`setQuery`/`hasActiveFilters`/`isFilterActive`. **Ajouter** `setSort`/`setPage`.
- `inertia/components/public/ProductionCard.tsx` (5.2) — variante grille. **Ajouter** `variant='list'`. `ProductionCardData` = `{ id, title, authors, category, domain, summary, viewsCount, downloadsCount }` (suffisant pour FR16).
- `inertia/components/public/{SearchBar,FilterBar,FilterChip}.tsx` (5.2/5.3) — réutiliser tels quels (SearchBar et FilterBar déjà dans `productions.tsx`).
- `inertia/components/shared/Pagination.tsx` — composant existant (props `currentPage`/`lastPage`/`queryParams`, masqué si `lastPage<=1`, `aria-current="page"`, i18n `pagination.label/previous/next`). **Étendre** avec `buildHref?`.
- `inertia/components/ui/select.tsx` — shadcn `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (API Radix : `value` + `onValueChange`). Utiliser pour le tri.
- `inertia/locales/public/{fr,en}.json` — `pagination.*` (label/previous/next) **déjà présents** (utilisés par le composant admin). Ajouter `sort.*`, `listing.*`, `productions.results_count/no_results_for/reset_filters`.
- `lucide-react` — `List`, `LayoutGrid` pour le toggle ; `Eye`/`Download` (déjà utilisés) pour les compteurs.

### Conventions et patterns

- **i18n** : 100% via `t()`, parité FR/EN stricte. Comptage via interpolation `{{count}}` (forme simple "{{count}} résultat(s)" — pas de suffixes pluriels pour éviter les écarts de parité).
- **`sort` dans l'URL, `view` en localStorage** (cf. ci-dessus).
- **Navigation** : `router.visit('/productions' + setSort(search, value))` / `setPage(...)`. La query string courante vient de `usePage().url`.
- **Props Inertia plates** ; `sort` ajouté aux props.
- **Validation `sort`** : whitelist `SORT_OPTIONS` (pas de valeur arbitraire injectée dans l'ORDER BY — `orderBy('viewsCount'|'antaPublishedAt'|'downloadsCount')` sur colonnes/alias connus).
- **Nommage** : composants `inertia/components/public/` (PascalCase) ; helpers purs `inertia/lib/search_query.ts`.
- **Tests** : fonctionnels `tests/functional/public/`, unitaires `tests/unit/lib` (source) + `tests/unit/components` (Node-pur source). `extractProps` regex `data-page`.
- **Accessibilité** (vers Story 5.6) : `role="group"`+`aria-pressed` sur le toggle, `aria-label` sur le `Select` de tri, compteurs `aria-label`, état vide non-dramatique. Un seul `<h1>` (déjà sur la home ; le listing peut avoir un `<h1>` "Résultats" ou s'appuyer sur le contexte — garder un titre de page).

### Anti-patterns à éviter

- ❌ Re-implémenter la recherche/les filtres/les facettes — c'est 5.3, déjà fait. 5.4 ne touche au backend que pour `sort`.
- ❌ Mettre `view` (liste/grille) dans l'URL — c'est une préférence localStorage (UX-DR4). Ne pas mettre `sort` en localStorage — il va dans l'URL (UX-DR5).
- ❌ Injecter `sort` brut dans `orderBy` — valider contre `SORT_OPTIONS`, mapper vers des colonnes/alias connus.
- ❌ Dupliquer un composant Pagination — étendre l'existant avec `buildHref`.
- ❌ Casser la pagination admin (`queryParams`) en ajoutant `buildHref`.
- ❌ Perdre les filtres/tri lors de la pagination — `setPage` préserve toute la query string.
- ❌ Trier par `views`/`downloads` sans les `withAggregate` (alias `viewsCount`/`downloadsCount`) — déjà présents, ne pas les retirer.
- ❌ Lire `localStorage` sans garde et faire planter un test Node — garder `typeof window !== 'undefined'`.
- ❌ Texte en dur (compteur, tri, toggle, état vide) — via i18n.
- ❌ Ajouter un bouton "télécharger" / badge format sur la carte de listing — hors AC (le téléchargement et le `MediaViewer` sont l'Epic 6 ; la variante détail aussi).

### Sécurité / conformité

- Lecture seule, productions publiées uniquement (déjà garanti par `SearchService`).
- `sort` validé (whitelist) — pas d'injection via l'ORDER BY.
- Pages indexables (le SEO meta tags est Story 5.5).

### Project Structure Notes

**Fichiers créés :**

- `inertia/components/public/ListingToggle.tsx`
- `tests/functional/public/listing.spec.ts`
- `tests/unit/components/listing_toggle.spec.ts`
- `tests/unit/components/production_card.spec.ts`

**Fichiers modifiés :**

- `app/services/search_service.ts` — param `sort` + `SORT_OPTIONS`/`SortOption`
- `app/controllers/public/productions_controller.ts` — parse/validation `sort` + prop `sort`
- `inertia/lib/search_query.ts` — `setSort`, `setPage`
- `inertia/components/public/ProductionCard.tsx` — variante `list`
- `inertia/components/shared/Pagination.tsx` — prop optionnelle `buildHref`
- `inertia/pages/productions.tsx` — refonte (count + tri + toggle + variantes + empty + pagination)
- `inertia/locales/public/fr.json` / `en.json` — `sort.*`, `listing.*`, `productions.results_count/no_results_for/reset_filters` (+ nettoyage clés stub optionnel)
- `tests/unit/lib/search_query.spec.ts` — ajout `setSort`/`setPage`

**Pas de migration, pas de modèle modifié.**

### Previous Story Intelligence (5.3 + 5.2 + Epic 4)

- **Story 5.3 (juste livrée)** : `SearchService` (tri implicite `q?ts_rank:antaPublishedAt`), `ProductionsController` renvoie `results/pagination/facets/activeFilters/q`, `productions.tsx` (grille + `no_results`), `search_query.ts` (helpers URL), `FilterBar` multi-dimension. **Le tri implicite devient explicite** (param `sort`). Le helper `search_query.ts` se teste **par sa source** (frontière TS `inertia/`, TS6305) — appliquer la même approche pour `setSort`/`setPage` ; le comportement de tri est validé end-to-end par le test fonctionnel.
- **Story 5.2** : `ProductionCardData`, `withAggregate('statsViews', q => q.count('*').as('viewsCount'))`, fixtures `createProduction`+`addViews`, `extractProps`. La grille `1→2→3` colonnes est déjà le pattern.
- **Story 4.x / admin** : `admin/Productions/Index.tsx` utilise `<Pagination queryParams={{status}} />` — l'ajout de `buildHref` optionnel ne doit pas l'impacter.
- **Flaky connu** : `production.spec.ts` GIN — isolé, non lié.

### Latest Tech Information

- **AdonisJS Lucid** : `orderBy('viewsCount','desc')` trie sur l'alias du `withAggregate` (déjà vérifié en 5.2/5.3). `paginate(page, perPage)` → méta `{currentPage,lastPage,total,perPage}`.
- **Inertia 2.x** : `router.visit(url)` (navigation tri/pagination) ; `usePage().url` (query string courante).
- **shadcn `Select` (Radix)** : `<Select value onValueChange><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value>...</SelectItem></SelectContent></Select>`.
- **localStorage** : `localStorage.getItem/setItem('anta:productions-view', 'list'|'grid')`. `ssr:false` → dispo au montage.
- **lucide-react** : `List`, `LayoutGrid`.

### Questions / clarifications (pour l'utilisateur)

1. **Option de tri "Pertinence" sans recherche** : quand `q` est vide, "Pertinence" n'a pas de sens → fallback sur "Date". Préfères-tu **masquer** l'option Pertinence en l'absence de `q`, ou la **garder visible** avec fallback silencieux (recommandé, plus simple) ?
2. **"Réinitialiser les filtres"** dans l'état vide : réinitialise **les filtres** (conserve `q`) — confirmes-tu, ou veux-tu un reset total (filtres **et** recherche) ?
3. **Clé localStorage** `anta:productions-view` et **défaut "liste"** : OK ?

### References

- [Source: epics.md#Story 5.4] — Acceptance Criteria d'origine (FR16, UX-DR2/4/5/12/19)
- [Source: ux-design-specification.md#ProductionCard] — Variante list (titre/auteur/catégorie/résumé/compteurs)
- [Source: ux-design-specification.md#ListingToggle] — Toggle liste/grille, localStorage, `aria-pressed`
- [Source: ux-design-specification.md#Page Listing — Mode Recherche Active] — Count + "Trier par" + toggle + pagination
- [Source: ux-design-specification.md#États Vides] — "Aucune production trouvée pour « {terme} »" + Réinitialiser
- [Source: app/services/search_service.ts] — Service à étendre (param sort)
- [Source: app/controllers/public/productions_controller.ts] — Contrôleur à étendre (sort)
- [Source: inertia/lib/search_query.ts] — Helpers URL à compléter (setSort/setPage)
- [Source: inertia/components/public/ProductionCard.tsx] — Variante grille existante
- [Source: inertia/components/shared/Pagination.tsx] — Composant pagination à étendre (buildHref)
- [Source: inertia/components/ui/select.tsx] — Select shadcn pour le tri
- [Source: Story 5.3] — Données du listing, helpers, frontière TS test source
- [Source: Story 5.2] — ProductionCardData, withAggregate, fixtures, grille responsive

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **`Pagination.buildHref`** : le composant partagé préservait des `queryParams` mono-valeur, incompatible avec les filtres publics multi-valeurs (`category=A&category=B`). Ajout d'une prop optionnelle `buildHref?: (page) => string` (déléguée à `setPage`) ; l'usage admin (`queryParams`) reste le défaut → non impacté.
- **`view` localStorage vs `sort` URL** : distinction respectée (UX-DR4 = préférence locale, UX-DR5 = état d'URL partageable). `ssr: false` → lecture localStorage sûre dans l'initialiseur `useState` (garde `typeof window`).
- **Lint prettier** : 4 erreurs de format (sauts de ligne objets, guillemets) auto-corrigées via `eslint --fix` (aucune modification de logique).
- **Décisions sur les 3 questions ouvertes (recommandations appliquées)** : (1) "Pertinence" reste visible avec fallback silencieux sur Date ; (2) "Réinitialiser les filtres" = `clearFilters` (conserve `q`) ; (3) clé `anta:productions-view`, défaut "liste". À confirmer en review.

### Completion Notes List

- AC1–AC7 satisfaits ; AC8 (tests) vert (298/298)
- `SearchService` : tri configurable (`relevance`/`date`/`views`/`downloads`) ; le tri implicite de 5.3 devient le cas `relevance`/`date`
- `ProductionsController` : `sort` validé (whitelist) + ajouté aux props
- Helpers `setSort` (retire `page`) / `setPage` (préserve tout) ajoutés à `search_query.ts`
- `ProductionCard` : variante `list` (FR16 : titre, auteurs, catégorie, résumé tronqué, compteurs) + grid conservée
- `ListingToggle` créé (contrôlé, `aria-pressed`, icônes lucide)
- `productions.tsx` refondu : comptage + dropdown tri (`Select` shadcn) + toggle (persisté localStorage) + rendu liste/grille + état vide stylé + pagination
- `Pagination` étendu (`buildHref`) — usage admin préservé
- i18n FR/EN : `sort.*`, `listing.*`, `productions.results_count/no_results/no_results_for/reset_filters` ; clés stub obsolètes nettoyées (parité maintenue)
- Aucune migration, aucun modèle modifié
- Tests : 298/298, lint 0, typecheck 0
- Tâche 10.4 (test manuel navigateur) restante — utilisateur
- **Épilogue Epic 5 (cœur listing)** : l'Epic 5 fonctionnel est désormais complet jusqu'au listing. Restent 5.5 (SEO meta tags SSR), 5.6 (a11y/responsive), 5.7 (tests site public). La **page détail** (`/productions/:id`, lien des cartes) reste l'**Epic 6**.

### File List

**Créés :**
- `inertia/components/public/ListingToggle.tsx`
- `tests/functional/public/listing.spec.ts`
- `tests/unit/components/listing_toggle.spec.ts`
- `tests/unit/components/production_card.spec.ts`

**Modifiés :**
- `app/services/search_service.ts` — param `sort` + `SORT_OPTIONS`/`SortOption`
- `app/controllers/public/productions_controller.ts` — parse/validation `sort` + prop `sort`
- `inertia/lib/search_query.ts` — `setSort`, `setPage`
- `inertia/components/public/ProductionCard.tsx` — variante `list`
- `inertia/components/shared/Pagination.tsx` — prop optionnelle `buildHref`
- `inertia/pages/productions.tsx` — refonte (comptage + tri + toggle + variantes + empty + pagination)
- `inertia/locales/public/fr.json` / `en.json` — `sort.*`, `listing.*`, `productions.*` (+ nettoyage clés stub)
- `tests/unit/lib/search_query.spec.ts` — ajout assertions `setSort`/`setPage`

### Change Log

- 2026-06-01 : Implémentation Story 5.4 (Listing — tri, toggle, pagination). Tri configurable backend (`SearchService.sort`), helpers `setSort`/`setPage`, variante `list` de `ProductionCard`, `ListingToggle` (localStorage), refonte `productions.tsx` (comptage + tri + toggle + état vide + pagination), `Pagination.buildHref` (préservation filtres multi-valeurs), i18n. Aucune migration. 4 fichiers créés, 8 modifiés. Tests : 298/298 verts, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [ ] [Review][Patch] Clés i18n `pagination.*` absentes des locales **publiques** [inertia/locales/public/{fr,en}.json] — `Pagination` (rendu sur `/productions`) appelle `t('pagination.label/previous/next')` ; ces clés n'existent que dans les locales **admin** (vérifié : 0 occurrence dans public, 1 dans admin). Sur un listing > 1 page, les `aria-label`/labels lecteur d'écran affichent la clé brute. **Fix** : ajouter le namespace `pagination` (label/previous/next) à `public/fr.json` et `public/en.json`. (Signalé par les 3 couches.)
- [ ] [Review][Patch] Accès `localStorage` non protégé → crash possible du listing [inertia/pages/productions.tsx:readStoredView/changeView] — `window.localStorage.getItem/setItem` sans `try/catch` ; en navigation privée / stockage désactivé (Safari, iframe sandbox), l'accès lève `SecurityError` dans l'initialiseur `useState` → la page `/productions` plante (pas de fallback SSR, `ssr:false`). **Fix** : envelopper lecture/écriture dans `try/catch` (fallback `'list'`). (blind+edge)
- [x] [Review][Defer] `Pagination` rend toutes les pages sans fenêtrage/ellipses [inertia/components/shared/Pagination.tsx] — deferred, composant pré-existant (Epic 4, partagé avec l'admin) ; avec un grand catalogue (`lastPage` élevé) le pager génère N liens. Amélioration (fenêtrage + ellipses) à traiter séparément (impacte aussi l'admin).
