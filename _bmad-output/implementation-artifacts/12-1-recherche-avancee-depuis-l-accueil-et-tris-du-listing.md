---
baseline_commit: 352531c
---

# Story 12.1 : Recherche avancée depuis l'accueil et tris du listing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **accéder à la recherche avancée depuis la barre de recherche de l'accueil et trier le listing par récence, vues ou téléchargements**,
afin d'**explorer la bibliothèque à ma façon** (FR44, FR9, D7, D8, D34).

## Décision de périmètre (lire en premier)

- Story **sans migration**, **sans dépendance npm**, sans composant shadcn ajouté, sans nouvelle route.
- **DANS 12.1** :
  - hero de l'accueil : `SearchBar` + bouton secondaire (outline pilule) « Recherche avancée » accolé, lien vers `/productions` ; barre vide → `/productions` ;
  - suppression des puces de catégories du hero (`FilterBar` mode accueil) et de la prop `categories` de `home_controller.ts` (D8, P2.6) ;
  - listing `/productions` : migration du `Select` sans libellé vers le `SortSelect` partagé de 10.3 (libellé visible « Trier par »), libellés D34, valeur par défaut omise de l'URL, retour page 1 et défilement ramené en haut des résultats ;
  - i18n public `home.hero.advanced_search`, `listing.sort.*` (FR/EN).
- **HORS 12.1 (ne PAS implémenter)** :
  - blocs « Récemment publiées » / « Les plus consultées » / « Les plus téléchargées » (365 j, 3 éléments, « Voir plus ») → **12.2** : `mostViewed` / `recent` et leurs `Section` restent **tels quels** ;
  - bloc « Auteurs les plus consultés » → 12.3 ; suggestions → 12.4 ; suite transverse → 12.5 ;
  - textes du hero (surtitre, h1, sous-titre) : inchangés (la maquette en montre d'autres, non demandés par l'AC, D-12.1-9) ;
  - tri par titre du listing (D34 n'en prévoit pas) : le report « Tri Titre sensible aux accents » (deferred-work.md, 10.3) reste ouvert (D-12.1-8).

## Acceptance Criteria

1. **Hero (FR44, D8)** — **Given** le hero de l'accueil, **When** il s'affiche, **Then** la `SearchBar` est accompagnée du bouton secondaire outline « Recherche avancée » (icône `SlidersHorizontal` `aria-hidden`, pilule 48 px), accolé à droite à partir de `sm`, sous la barre en pleine largeur en dessous ; c'est un lien vers `/productions` **sans paramètre** (même destination que le lien du pied de page), cible ≥ 44 px.
2. **Puces supprimées (D8, P2.6)** — **Given** `GET /`, **When** l'accueil est rendu, **Then** la prop `categories` est absente et le hero ne rend plus de `FilterBar` ; `featured`, `mostViewed`, `recent`, `meta` inchangés.
3. **Soumission** — **Given** la barre du hero, **When** le visiteur soumet « x y », **Then** il va sur `/productions?q=x+y` (terme rogné) ; une barre vide (ou blanche) mène à `/productions`.
4. **Options de tri (D34, D7)** — **Given** le listing `/productions` avec résultats, **When** le visiteur ouvre le sélecteur, **Then** `SortSelect` (libellé visible « Trier par », associé par `htmlFor`) propose dans l'ordre « Pertinence » (`relevance`), « Récemment publiées » (`date`), « Les plus consultées » (`views`), « Les plus téléchargées » (`downloads`) ; `views` / `downloads` trient sur les **totaux** (toutes les vues / tous les téléchargements, pas 365 j) ; « Pertinence » est désactivée sans `q` (D-12.1-4).
5. **Navigation de tri** — **Given** un changement de tri, **When** il est appliqué, **Then** l'URL porte `sort`, `page` est retiré (page 1), `q` et les filtres sont conservés, et le défilement est ramené en haut des résultats s'ils ont commencé au-dessus de la fenêtre ; la valeur par défaut (`relevance` avec `q`, `date` sans) est **omise** de l'URL (D-12.1-5).
6. **Défauts serveur** — **Given** `GET /productions`, **When** `sort` est absent ou invalide, **Then** le tri est `relevance` avec `q`, `date` sans ; **and** `sort=relevance` sans `q` retombe sur `date` (ordre par date de publication Anta), et la prop `sort` vaut alors `date` (le sélecteur reflète l'ordre réel, D-12.1-3).
7. **i18n (D23)** — **Given** `inertia/locales/public/{fr,en}.json`, **When** ils sont lus, **Then** `home.hero.advanced_search` (« Recherche avancée » / « Advanced search ») et `listing.sort.{relevance,date,views,downloads}` (« Pertinence · Récemment publiées · Les plus consultées · Les plus téléchargées » / « Relevance · Recently published · Most viewed · Most downloaded », EXPERIENCE.md:72) existent avec parité fr/en.

## Tasks / Subtasks

- [x] **T1 — Serveur** (AC 2, 6)
  - [x] 1.1 `HomeController.index` : prop `categories` et import `PRODUCTION_CATEGORIES` retirés.
  - [x] 1.2 `ProductionsController.index` : tri effectif (`relevance` sans `q` → `date`) renvoyé dans la prop `sort`.
- [x] **T2 — Helpers purs** (AC 3, 5) — `inertia/lib/search_query.ts`
  - [x] 2.1 `LISTING_SORTS`, `defaultListingSort(q)`, `effectiveListingSort(sort, q)` (miroir du contrôleur, frontière TS6305).
  - [x] 2.2 `setSort` omet la valeur par défaut ; `setQuery` retire un `sort` devenu redondant.
  - [x] 2.3 `homeSearchHref(query)` : `/productions?q=…` ou `/productions`.
- [x] **T3 — Front** (AC 1–5)
  - [x] 3.1 `inertia/pages/home.tsx` : rangée `SearchBar` + lien « Recherche avancée », `FilterBar` et `categories` retirés, `homeSearchHref`.
  - [x] 3.2 `inertia/components/public/FilterBar.tsx` : mode accueil retiré (plus d'appelant, D-12.1-6).
  - [x] 3.3 `inertia/components/shared/SortSelect.tsx` : option `disabled?`.
  - [x] 3.4 `inertia/pages/productions.tsx` : `SortSelect` (`id="listing-sort"`), `listing.sort.*`, « Pertinence » désactivée sans `q`, `preserveScroll` + retour en haut des résultats (`scroll-mt-24`).
  - [x] 3.5 i18n fr/en : `home.hero.advanced_search`, `listing.sort.*` ; anciennes clés `sort.{relevance,date,views,downloads}` retirées (seul le listing les lisait), `sort.label` conservé.
- [x] **T4 — Tests** (tous les AC)
  - [x] 4.1 Functional `home.spec.ts` (prop `categories` absente), `listing.spec.ts` (quatre tris, totaux, `relevance` avec / sans `q`, défaut avec `q`).
  - [x] 4.2 Unit `search_query_behavior.spec.ts` (omission du défaut, `setQuery`, `homeSearchHref`) ; composants par lecture de source (accueil, listing, `SortSelect`) ; specs `FilterBar` / bannière adaptées ; parité i18n.
  - [x] 4.3 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/controllers/public/home_controller.ts` : `mostViewed` / `recent` (6, `withAggregate`), `featured` (11.6), `categories: [...PRODUCTION_CATEGORIES]`, `meta`. Ne retirer que `categories`.
- `app/controllers/public/productions_controller.ts` : `sort` validé contre `SORT_VALUES` (= `SearchService.SORT_OPTIONS`), défaut `relevance` si `q` sinon `date` ; `sort` renvoyé tel quel (aujourd'hui `relevance` sans `q` est renvoyé `relevance` alors que l'ordre est par date).
- `app/services/search_service.ts` : `search()` gère déjà les quatre tris ; `views` / `downloads` = `withAggregate` count(*) sur toutes les lignes (totaux, D7) ; `relevance` sans terme → date. **Inchangé.**
- `inertia/pages/home.tsx` : hero (surtitre, h1, sous-titre, `SearchBar`, `FilterBar categories`), `FeaturedBanner`, deux `Section`. `handleSearch` ignore une barre vide (à changer : AC 3).
- `inertia/components/public/SearchBar.tsx` : formulaire `role="search"` (input + effacer + « Rechercher »), présentationnel, partagé avec le listing → **inchangé** (D-12.1-1).
- `inertia/components/public/FilterBar.tsx` : deux modes (accueil = puces `categories` ; listing = facettes) ; seul l'accueil l'importe.
- `inertia/components/shared/SortSelect.tsx` (10.3) : libellé visible `sort.label`, `Select` `min-h-11`, `w-full sm:w-64`, `options: { value, label }[]`.
- `inertia/pages/productions.tsx` : `Select` shadcn `w-44` avec `aria-label` (sans libellé visible), `SORT_VALUES` local, `t('sort.${option}')`, `router.visit(setSort(...))` sans `preserveScroll` (retour en haut de page).
- `inertia/lib/search_query.ts` : `setSort` (retire `page`, pose toujours `sort`), `setQuery`, `withActiveAuthors` (10.6) ; testé à l'exécution par `tests/unit/lib/search_query_behavior.spec.ts`.
- Pied de page (`PublicLayout.tsx`) : « Recherche avancée » → `/productions` littéral (D34) : même destination.

### Garde-fous

- Préserver : filtre auteur par slug (10.6, `withActiveAuthors` avant tout helper), état vide / « Effacer les filtres » (D-10.6-2 amendée), région `aria-live` des résultats, bascule liste / grille, résultats approchants (pas de sélecteur de tri dans cette branche, comportement actuel).
- `sort.label` reste utilisé par `SortSelect` (profil, liste des auteurs) : ne pas le retirer.
- Composants `inertia/` testés par lecture de source ; logique d'URL dans `inertia/lib/search_query.ts` (aucun import) testée à l'exécution.
- Inertia : une visite GET sans `preserveState` remonte la page (bascule de vue relue depuis `localStorage`, `SearchBar` réinitialisée sur `q`) : acceptable, comme 10.5.
- En-tête public `sticky` → `scroll-mt-24` sur l'ancre des résultats.
- Dépôt public : données fictives dans les tests.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.1] ; en-tête Epic 12 (ordre de l'accueil FR9).
- [Source: architecture.md#P2.6] (`home` : `categories` supprimé, D8) ; P2.3 (listing `sort=views|downloads` sur les totaux, D7) ; P2.8 (tests de composants par lecture de source).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:32–33, 37, 68, 72, 103, 206] ; [DESIGN.md:154–163, 358, 369] ; maquette `mockups/home.html:39–49`.
- [Source: 10-3-…md] `SortSelect` (« réutilisé par 10.5 et 12.1 ») ; [10-5-…md] retour en haut des résultats ; [10-6-…md] « migration du tri vers `SortSelect` (12.1) » ; [11-6-…md] puces conservées jusqu'à l'Epic 12 ; deferred-work.md « Tri Titre sensible aux accents ».

## Décisions (D-12.1-n)

- **D-12.1-1** : le lien « Recherche avancée » vit dans `home.tsx` (rangée `flex-col sm:flex-row` autour de `SearchBar`), pas dans `SearchBar` : le composant est partagé avec le listing, qui ne doit pas afficher de lien vers lui-même. Lien Inertia `/productions` littéral, comme le pied de page ; classes de la maquette (`h-12`, bordure `stone-300`, survol `green-700`), pleine largeur sous `sm`.
- **D-12.1-2** : la destination de la barre de l'accueil est calculée par un helper pur `homeSearchHref(query)` (`setQuery('', query)`), testé à l'exécution ; barre vide → `/productions`.
- **D-12.1-3** : le serveur renvoie le **tri effectif** : `sort=relevance` sans `q` → prop `sort = 'date'` (ordre inchangé : `SearchService` retombait déjà sur la date). Sinon le sélecteur afficherait « Pertinence » sur une liste triée par date.
- **D-12.1-4** : « Pertinence » reste listée (AC : quatre options) mais est **désactivée sans `q`** (`SelectItem disabled`) : la choisir ne changerait rien (D-12.1-3). Question PO : la masquer plutôt ?
- **D-12.1-5** : valeur par défaut omise de l'URL = celle du `q` courant (`relevance` avec, `date` sans) ; `setQuery` retire aussi un `sort` devenu redondant après changement de terme (`?q=x&sort=date` → effacer la recherche → `/productions`). Un tri explicite non par défaut (`views`…) survit à une nouvelle recherche (comportement actuel).
- **D-12.1-6** (*amendée à la revue*) : `FilterBar` n'a plus aucun appelant (mode accueil supprimé, mode listing jamais utilisé par la page depuis `FilterSidebar`) → **fichier supprimé** ; ses assertions utiles passent sur `FilterSidebar`, la clé orpheline `filters.label` est retirée. `FilterChip`, devenu orphelin, est reporté (deferred-work.md).
- **D-12.1-7** (*amendée à la revue*) : après un tri, `preserveState` + `preserveScroll` (pas de remontage : le focus clavier reste sur `#listing-sort`), puis `scrollIntoView` de l'en-tête des résultats seulement s'il commence sous l'en-tête collant (seuil = `scroll-margin-top` calculé de l'ancre, `scroll-mt-24`), sinon la position est gardée.
- **D-12.1-8** : pas de tri par titre au listing (D34 : quatre tris) ; le report « Tri Titre sensible aux accents » (profil d'auteur) reste ouvert, pointeur 12.1 corrigé dans deferred-work.md.
- **D-12.1-9** : textes du hero inchangés (la maquette montre un autre surtitre / h1 et pas de sous-titre ; non demandé par l'AC, contenu à valider par le PO s'il le souhaite).
- **D-12.1-10** : clés i18n `listing.sort.*` (nom de l'AC) ; les anciennes `sort.{relevance,date,views,downloads}` (« Date », « Vues »…) sont retirées, `sort.label` conservé. `SortSelect` du listing : `sm:w-56` (libellés D34 plus longs que `w-44`, DESIGN.md:369).

## Review Findings

- [x] [Review][Patch] `FilterBar.tsx` sans appelant [inertia/components/public/FilterBar.tsx] — fichier supprimé (remplace D-12.1-6) ; `filter_chip.spec.ts` (groupe `FilterBar` retiré), `filter_sidebar.spec.ts` (assertions portées sur `FilterSidebar`), `a11y_components.spec.ts` (absence du fichier).
- [x] [Review][Patch] Focus perdu après un tri (remontage sans `preserveState`) [inertia/pages/productions.tsx] — `preserveState: true` (sûr : vue, recherche et filtres dépliés gardent leur état, comme les bascules de `FilterSidebar`) ; test de source.
- [x] [Review][Patch] Seuil de retour en haut `top < 0` ignorant l'en-tête collant [inertia/pages/productions.tsx] — seuil = `scroll-margin-top` calculé de l'ancre (`scroll-mt-24`) ; test de source.
- [x] [Review][Patch] Clé i18n orpheline `filters.label` [inertia/locales/public/{fr,en}.json] — retirée (aucun usage, vérifié par grep) ; test.
- [x] [Review][Patch] Test fonctionnel `?q=x&sort=bogus` → `relevance` [tests/functional/public/listing.spec.ts].
- [x] [Review][Defer] Pas de `SortSelect` dans la branche des résultats approchants [inertia/pages/productions.tsx] — préexistant, consigné dans deferred-work.md (avec `FilterChip` orphelin).
- [ ] [Review][PO] « Pertinence » désactivée sans recherche plutôt que masquée (D-12.1-4) — à confirmer.
- [ ] [Review][PO] Textes du hero conservés plutôt que ceux de la maquette (D-12.1-9) — à confirmer.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites avant le code (functional `home.spec.ts` / `listing.spec.ts`, unit `search_query_behavior.spec.ts`, nouveau `home_search_listing_sort.spec.ts`, specs `FilterBar` / bannière adaptées) → 23 échecs sur 81 ; les tests « totaux D7 » et « relevance avec `q` » passaient déjà (comportement existant de `SearchService`, conservé).
- `npm run test:local -- --files a b c` (fichiers séparés par des espaces) bloque le runner : utiliser `--files=a --files=b`.
- Phase verte ciblée : 104 tests verts (10 fichiers).
- Suite complète `npm run test:local` : **1343 tests verts** (baseline 1323, +20), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Rien contre Supabase ni R2 ; aucun codegen Tuyau nécessaire (props de `home` déduites du composant).
- Revue (5 correctifs, 1 report, 2 questions PO) : **1344 tests verts** (+3 ajoutés, −2 tests `FilterBar` retirés), `npm run test:local` code 0, lint 0, typecheck 0, build 0.

### Completion Notes List

- `HomeController.index` : prop `categories` retirée (D8, P2.6) ; `featured`, `mostViewed`, `recent`, `meta` inchangés (blocs = 12.2).
- `ProductionsController.index` : tri effectif renvoyé, `relevance` sans `q` → `date` (D-12.1-3) ; `SearchService` inchangé (totaux D7 déjà en place).
- `inertia/lib/search_query.ts` : `LISTING_SORTS`, `defaultListingSort`, `effectiveListingSort` (miroir du contrôleur), `setSort` / `setQuery` omettent un `sort` égal au tri par défaut (D-12.1-5), `homeSearchHref` (barre vide → `/productions`, D-12.1-2).
- Accueil : rangée `SearchBar` + lien outline pilule « Recherche avancée » (`SlidersHorizontal`, `h-12`, pleine largeur < sm, accolé ≥ sm) vers `/productions` (D-12.1-1) ; `FilterBar` retirée du hero, son mode accueil supprimé (D-12.1-6).
- Listing : `SortSelect` partagé (`id="listing-sort"`, libellé visible « Trier par », `sm:w-56`), libellés D34 `listing.sort.*`, « Pertinence » désactivée sans `q` (D-12.1-4, option `disabled` ajoutée à `SortSelect`), `preserveScroll` + retour en haut des résultats (`#listing-results`, `scroll-mt-24`, D-12.1-7).
- i18n fr/en : `home.hero.advanced_search`, `listing.sort.*` ; `sort.{relevance,date,views,downloads}` retirées, `sort.label` conservé (D-12.1-10).
- deferred-work.md : pointeur « tri par titre de la liste (12.1) » corrigé (D-12.1-8).
- Rendu non vérifié au navigateur (pas de serveur lancé) : contrôle visuel du hero à 375 / 1024 px et de l'option désactivée à faire au test PO.
- Questions PO : voir les entrées `[Review][PO]` (D-12.1-4, D-12.1-9).

### File List

- app/controllers/public/home_controller.ts
- app/controllers/public/productions_controller.ts
- inertia/lib/search_query.ts
- inertia/pages/home.tsx
- inertia/pages/productions.tsx
- inertia/components/public/FilterBar.tsx (supprimé, revue)
- inertia/components/shared/SortSelect.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/functional/public/home.spec.ts
- tests/functional/public/listing.spec.ts
- tests/unit/lib/search_query_behavior.spec.ts
- tests/unit/components/home_search_listing_sort.spec.ts (nouveau)
- tests/unit/components/a11y_components.spec.ts
- tests/unit/components/filter_chip.spec.ts
- tests/unit/components/filter_sidebar.spec.ts (revue)
- tests/unit/components/home_featured_banner.spec.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/12-1-recherche-avancee-depuis-l-accueil-et-tris-du-listing.md (nouveau)

## Change Log

- 2026-11-24 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-24 : implémentation (lien « Recherche avancée » et barre vide de l'accueil, prop `categories` retirée, `SortSelect` et libellés D34 au listing, tri effectif serveur, défaut omis de l'URL, retour en haut des résultats) ; 1343 tests verts ; statut review.
- 2026-11-24 : revue de code — 5 correctifs (`FilterBar` supprimé, focus conservé par `preserveState`, seuil de défilement sous l'en-tête collant, `filters.label` retiré, test `sort` invalide avec `q`), 1 report (tri des approchants), 2 questions PO ; 1344 tests verts ; statut done.
