# Story 5.2 : Page d'accueil avec deux sections et filtres visibles

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que visiteur,
Je veux voir sur la page d'accueil les productions les plus consultées et les plus récentes, avec la barre de recherche et les filtres immédiatement disponibles,
Afin de commencer à explorer la bibliothèque sans friction dès mon arrivée (FR9, UX-DR23).

> **2ᵉ story de l'Epic 5.** Elle construit la homepage de découverte + les composants `SearchBar`, `FilterBar`/`FilterChip`, `ProductionCard` (variante grille), et un `HomeController` public. Elle s'appuie sur le `PublicLayout` livré en Story 5.1. **La recherche full-text réelle (tsvector) est Story 5.3 ; le listing complet (tri/toggle/pagination) est Story 5.4.** Ici, la SearchBar et les FilterChips se contentent de **naviguer vers `/productions`** avec les bons paramètres d'URL — un stub `/productions` est créé pour que la redirection aboutisse (200), à étoffer en 5.3/5.4.

## Acceptance Criteria

**AC1 — SearchBar hero + FilterBar visibles dès l'arrivée**

- **Given** un visiteur accède à `/`
- **When** la page se charge
- **Then** une `SearchBar` hero centrée est affichée avec le placeholder i18n "Rechercher une production..." (`home.search_placeholder`)
- **And** une `FilterBar` listant les FilterChips de catégories est visible sous la SearchBar, **sans qu'aucune recherche active ne soit requise**

**AC2 — Section "Les plus consultées" (6 productions, vues décroissantes)**

- **Given** la page d'accueil se charge
- **When** `HomeController` interroge la base
- **Then** une section "Les plus consultées" (`home.sections.most_viewed`) affiche les **6** productions **publiées** ayant le plus de vues, triées par nombre de vues **décroissant**
- **And** chaque production est rendue via `ProductionCard` (variante grille)

**AC3 — Section "Récemment ajoutées" (6 productions, antaPublishedAt décroissant)**

- **Given** la page d'accueil se charge
- **When** `HomeController` interroge la base
- **Then** une section "Récemment ajoutées" (`home.sections.recent`) affiche les **6** dernières productions **publiées**, triées par `antaPublishedAt` **décroissant**

**AC4 — État vide factuel**

- **Given** aucune production n'a encore été publiée
- **When** la page d'accueil se charge
- **Then** chaque section affiche un état vide **factuel** (`home.empty`, ton sobre, sans illustration complexe — cf. UX-DR19)
- **And** la `SearchBar` et la `FilterBar` restent affichées (la FilterBar peut être vide s'il n'existe aucune catégorie)

**AC5 — SearchBar et FilterChip redirigent vers `/productions` avec paramètres URL**

- **Given** un visiteur saisit du texte dans la SearchBar et soumet (Entrée ou bouton), OU clique sur un FilterChip de catégorie
- **When** l'action est déclenchée
- **Then** il est redirigé (navigation Inertia) vers `/productions` avec le paramètre correspondant dans l'URL (`?q=terme` pour la recherche, `?category=valeur` pour un chip)
- **And** la route `/productions` répond `200` (stub à ce stade — listing réel en 5.3/5.4)

**AC6 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `GET /` → `200` (homepage), y compris base vide (sections vides, pas d'erreur)
  - `HomeController` renvoie au plus 6 items par section, productions **publiées uniquement**, "plus consultées" ordonnées par vues décroissantes, "récentes" par `antaPublishedAt` décroissant
  - `GET /productions` → `200` (stub)
  - Parité des clés i18n FR/EN préservée (`translations.spec.ts` reste vert)
  - Assertions source (Node-pur) sur `SearchBar` (role/aria, placeholder via i18n, navigation vers `/productions`) et `FilterChip` (`aria-pressed`/lien `?category=`)

## Tasks / Subtasks

- [x] **Tâche 1 — Relations stats sur le modèle `Production`** (AC2, AC3)
  - [x] 1.1 Ajouté `@hasMany(() => StatsView) declare statsViews` et `@hasMany(() => StatsDownload) declare statsDownloads` dans `app/models/production.ts` (imports `#models/stats_view`, `#models/stats_download`). FK par défaut `productionId`.
  - [x] 1.2 Aucune migration (tables `stats_views`/`stats_downloads` déjà existantes — relations Lucid uniquement).
  - [x] 1.3 `database/schema.ts` régénéré (codegen) — cohérent.

- [x] **Tâche 2 — `HomeController` public** (AC2, AC3, AC4)
  - [x] 2.1 Créé `app/controllers/public/home_controller.ts`, méthode `index`.
  - [x] 2.2 "Plus consultées" via helper `publishedWithCounts()` (`where status=PUBLISHED` + 2 `withAggregate` alias `viewsCount`/`downloadsCount`) + `orderBy('viewsCount','desc').limit(6)`.
  - [x] 2.3 "Récemment ajoutées" : même base + `orderBy('antaPublishedAt','desc').limit(6)`.
  - [x] 2.4 Catégories : `whereNotNull('category').distinct('category').orderBy('category')`.
  - [x] 2.5 Sérialisation plate ; agrégats via `Number(p.$extras.viewsCount ?? 0)` ; `antaPublishedAt.toISO()`.
  - [x] 2.6 `inertia.render('home', { mostViewed, recent, categories })`.
  - [x] 2.7 Lecture seule, aucun enregistrement de vue.

- [x] **Tâche 3 — Composant `ProductionCard` (variante grille)** (AC2, AC3)
  - [x] 3.1 Créé `inertia/components/public/ProductionCard.tsx`, type `ProductionCardData` exporté.
  - [x] 3.2 `<article>` ; titre `<h3 className="font-display">` ; auteurs ; catégorie/domaine ; compteurs `Eye`/`Download` avec `aria-label` (interpolation count).
  - [x] 3.3 Titre = `<Link href={`/productions/${id}`}>` (détail Epic 6) ; carte Tailwind pur (bordure stone-200, hover green-700).
  - [x] 3.4 Libellés via i18n (`production_card.by/views/downloads`). Pas de variante `list`.

- [x] **Tâche 4 — Composants `SearchBar` + `FilterBar` + `FilterChip`** (AC1, AC5)
  - [x] 4.1 `SearchBar.tsx` présentationnel : `<form role="search">`, input `aria-label` + placeholder i18n, loupe, bouton submit, bouton × (reset). Soumission explicite, pas de debounce.
  - [x] 4.2 `FilterChip.tsx` : `<Link aria-pressed>` ; actif `bg-green-700 text-white`, inactif bordure grise.
  - [x] 4.3 `FilterBar.tsx` : `role="group"` + `aria-label`, un chip/catégorie → `/productions?category=encodeURIComponent(cat)`, `overflow-x-auto`, rien si vide.
  - [x] 4.4 Homepage : `onSubmit` → `router.visit('/productions?q=...')` (navigue si `q` non vide).

- [x] **Tâche 5 — Page d'accueil `home.tsx` + route contrôleur** (AC1–AC5)
  - [x] 5.1 `home.tsx` réécrite : `<h1>` tagline visible, SearchBar hero centrée, FilterBar, 2 `<section>` (`<h2>`) en grille `1→2→3` colonnes de `ProductionCard`.
  - [x] 5.2 État vide `home.empty` (`text-stone-500`) ; SearchBar + FilterBar restent visibles.
  - [x] 5.3 Hérite de `PublicLayout` (pas de `.layout`).
  - [x] 5.4 `start/routes.ts` : `router.get('/', [controllers.public.Home, 'index']).as('home')`.

- [x] **Tâche 6 — Stub `/productions` + i18n + utilitaire police** (AC5)
  - [x] 6.1 Créé `app/controllers/public/productions_controller.ts` (stub) renvoyant `{ q, category }`.
  - [x] 6.2 Créé `inertia/pages/productions.tsx` (stub) : SearchBar + placeholder factuel (paramètres actifs + "résultats à venir").
  - [x] 6.3 Route `router.get('/productions', [controllers.public.Productions, 'index']).as('productions')`.
  - [x] 6.4 Utilitaire `.font-display` ajouté dans `app.css` (`@layer components`).
  - [x] 6.5 Clés i18n ajoutées FR/EN (parité) : `home.tagline`, `home.search_placeholder`, `home.empty`, `home.sections.*`, `search.*`, `filters.label`, `production_card.*`, `productions.active_search/active_category/results_pending`.

- [x] **Tâche 7 — Tests** (AC6)
  - [x] 7.1 `tests/functional/public/home.spec.ts` : `GET /` 200 base vide ; mostViewed trié vues desc, exclut draft ; recent trié antaPublishedAt desc ; limite 6 ; categories distinctes publiées. (Assertions via `extractProps` du HTML `data-page` — pattern `productions_list.spec.ts`.)
  - [x] 7.2 `tests/functional/public/productions.spec.ts` : `GET /productions?q&category` 200 + props `q`/`category` (et null sans param).
  - [x] 7.3 `tests/unit/components/search_bar.spec.ts` + `filter_chip.spec.ts` (Node-pur) : `role="search"`, `aria-label`, `onSubmit`/`preventDefault`, `aria-pressed`, `/productions?category=`, `encodeURIComponent`, `role="group"`.
  - [x] 7.4 Helpers de fixture in-spec (`createProduction`, `addViews`) ; rollback transactionnel par group hooks. NB : `createdById` nullable → pas besoin d'AdminUser pour les fixtures de production publique.

- [x] **Tâche 8 — Validation finale**
  - [x] 8.1 `node ace test` → 265/265 verts (aucun échec ; flaky GIN non reproduit).
  - [x] 8.2 `npm run lint` → 0 erreur.
  - [x] 8.3 `npm run typecheck` → 0 erreur (codegen `.adonisjs` régénéré : registry `controllers.public.*` + page `productions`).
  - [ ] 8.4 Test manuel `npm run dev` (**à faire par l'utilisateur** — navigateur) : `/` affiche SearchBar + FilterBar + 2 sections (ou états vides) ; saisie + Entrée → `/productions?q=...` ; clic chip → `/productions?category=...`

## Dev Notes

### Architecture cible (synthèse)

- **`HomeController` (lecture seule)** dans `app/controllers/public/` — nouveau namespace `public/` miroir de `admin/`. Le registry Tuyau exposera `controllers.public.Home` et `controllers.public.Productions` (sous-dossier niché — **même gotcha que `controllers.admin.Auth`**, cf. Story 2.1 : utiliser le chemin nesté dans `start/routes.ts`).
- **Agrégats de vues/téléchargements** : il n'existe **PAS** de colonne `views_count` sur `productions`. Les vues/téléchargements sont des lignes dans `stats_views` / `stats_downloads` (modèles `StatsView`/`StatsDownload` déjà présents, FK `production_id`). On ajoute deux relations `hasMany` au modèle `Production` et on agrège via `withAggregate(... count(*) ...)`. Échelle Anta faible → performance OK (NFR : page < 3s).
- **Catégories = texte libre** : il n'y a **pas** d'enum/taxonomie de catégories. La colonne `category` est `string | null`. Les FilterChips de la homepage sont donc les **catégories distinctes des productions publiées** (requête `distinct`).
- **SearchBar/FilterBar = navigation, pas recherche** (en 5.2) : la homepage ne fait **pas** la recherche tsvector (Story 5.3) ni le listing (Story 5.4). Elle **navigue** vers `/productions?q=&category=`. Un stub `/productions` garantit un 200 et sera remplacé par le vrai contrôleur/page en 5.3/5.4.
- **Pas de `slug`** sur `productions` (confirmé `database/schema.ts`) → les liens de carte pointent `/productions/:id`. La **page détail est l'Epic 6** : le lien existera mais sa cible n'est implémentée qu'en Epic 6 (dépendance cross-epic assumée — voir question en fin de story).

### État existant à RESPECTER (ne pas réinventer)

- `inertia/layouts/PublicLayout.tsx` (Story 5.1) — header + LanguageSwitcher + footer déjà en place ; la homepage et `/productions` en héritent automatiquement (HOC `app.tsx`).
- `inertia/components/shared/LanguageSwitcher.tsx`, `inertia/components/shared/Pagination.tsx` — précédents de composants partagés. Les composants **publics spécifiques** (SearchBar/FilterBar/FilterChip/ProductionCard) vont dans `inertia/components/public/` (miroir de `components/admin/`).
- `app/models/production.ts` — colonnes : `title, summary, authors[], tags[], category, domain, subdomain, language, publicationCountry, ..., status, antaPublishedAt`. Relations existantes : `files`, `links`, `createdBy`. **Ajouter** `statsViews`, `statsDownloads`.
- `app/enums/production_status.ts` — utiliser `ProductionStatus.PUBLISHED` (jamais la string `'published'` en dur).
- `app/models/stats_view.ts` / `stats_download.ts` — `productionId`, `recordedAt`/`downloadedAt`, `ipHash`. Pas à modifier.
- `app/controllers/admin/productions_controller.ts` — **pattern de référence** pour : bornage `page`, sérialisation plate des props Inertia, `paginate`, validation des query params contre l'enum. S'en inspirer pour `HomeController`.
- `inertia/css/app.css` — `--color-primary` green-700, `h1, h2` déjà en Playfair Display. Ajouter l'utilitaire `.font-display` pour les titres de carte (`h3`).
- `inertia/locales/public/{fr,en}.json` — déjà : `nav` (dont `search`), `actions` (dont `search`, `filter`, `clear_filters`), `language_switcher`, `footer`, `privacy`. **Réutiliser** `actions.*`/`nav.search` quand pertinent ; ajouter les clés `home.*`, `search.*`, `filters.*`, `production_card.*`.
- `start/routes.ts` — route `home` actuelle via `renderInertia` ; route `/privacy-policy` (5.1). Les routes publiques restent **hors** des groupes `/admin` et legacy.
- `lucide-react` — déjà utilisé (icônes `FolderOpen`, `ChevronLeft`…). Utiliser `Search`, `Eye`, `Download`, `X`.

### Conventions et patterns

- **i18n** : 100% des textes via `useTranslation()`/`t()`. Parité FR/EN stricte (`translations.spec.ts` casse sinon — `assert.deepEqual` clés triées).
- **Props Inertia plates** (pas de wrapper) — cf. `architecture.md#Formats d'Échange` et `admin/productions_controller.ts`. Dates → `.toISO()`. Agrégats → `Number(p.$extras.alias)`.
- **Nommage** : contrôleurs `public/home_controller.ts` (snake_case fichier, classe `HomeController`) ; composants React PascalCase dans `components/public/` ; pages publiques **à plat** kebab-case (`home.tsx`, `productions.tsx`, `privacy-policy.tsx`).
- **Inertia `inertia.render('page', props)`** : toujours 2 args. Navigation client : `router.visit(url)` (`@inertiajs/react`).
- **Layout HOC** : ne PAS définir `.layout` sur les pages publiques (le HOC `app.tsx` applique `PublicLayout`).
- **`<Link>` Inertia** : `import { Link } from '@adonisjs/inertia/react'` pour la nav interne (cartes, chips).
- **Accessibilité** : `role="search"` sur la SearchBar, `aria-pressed` sur FilterChip, `role="group"` + `aria-label` sur FilterBar, `aria-label` descriptif sur compteurs, `<article>` pour les cartes, **un seul `<h1>`** par page, sections en `<h2>`, titres de carte en `<h3>`. (Audit a11y complet = Story 5.6.)
- **Tests** : Japa ; fonctionnels dans `tests/functional/public/`, unitaires dans `tests/unit/components/`. Pour les pages Inertia, asserter le JSON via `.header('X-Inertia','true').header('X-Inertia-Version','1')` puis `response.body().props`. Fallback Node-pur (lecture du source) pour les composants React (pas de testing-library).

### Gotcha codegen `.adonisjs` (IMPORTANT)

Ajouter une page (`productions.tsx`) et des contrôleurs (`public/*`) modifie les fichiers générés :
- `.adonisjs/server/pages.d.ts` — doit contenir `'productions'` (et `'home'` déjà présent). Si le typecheck échoue avec `'"productions"' is not assignable to keyof InertiaPages`, ajouter l'entrée manuellement OU laisser `node ace test`/le boot régénérer (`codegen: created N file(s)`), puis **committer** les fichiers `.adonisjs/server/*` + `database/schema.ts` régénérés. (Précédent vécu en Story 5.1.)
- Le registry Tuyau (`#generated/controllers`) doit exposer `controllers.public.Home`/`controllers.public.Productions` — régénéré au boot. Vérifier via `node ace list:routes`.

### Anti-patterns à éviter

- ❌ Implémenter la recherche tsvector ou le listing complet (tri/toggle/pagination/count) ici — c'est 5.3/5.4. La homepage **navigue** seulement.
- ❌ Ajouter une migration pour un `views_count` — agréger `stats_views` via relation, pas de dénormalisation.
- ❌ Hardcoder une liste de catégories — les dériver des productions publiées.
- ❌ Inclure des productions `draft` dans les sections — filtrer `status = PUBLISHED`.
- ❌ Enregistrer des vues sur la homepage (le `ViewTracker` 10s est Epic 6) — lecture seule.
- ❌ `withCount` sans alias explicite puis tri sur un nom d'extra deviné — préférer `withAggregate(...).as('viewsCount')` et trier sur l'alias.
- ❌ Recréer un layout / re-wrapper `PublicLayout` / ajouter `.layout` sur les pages publiques.
- ❌ Construire un `ProductionCard` variante `list` ou un `ListingToggle` — Story 5.4.
- ❌ Texte en dur dans le JSX (placeholder, libellés, états vides) — tout via i18n.
- ❌ Débounce/live-filter dans la SearchBar — soumission explicite uniquement en 5.2.

### Sécurité / conformité

- Pages publiques **indexables** (pas de `noindex`). Lecture seule, aucune mutation.
- Filtrer **strictement** `status = PUBLISHED` : ne jamais exposer un brouillon sur le site public.
- `category` provient de query param utilisateur côté `/productions` (stub) — pas d'injection : Lucid bind les valeurs ; le stub ne fait que ré-afficher (échappé par React).

### Project Structure Notes

**Fichiers créés :**

- `app/controllers/public/home_controller.ts`
- `app/controllers/public/productions_controller.ts` (stub)
- `inertia/components/public/ProductionCard.tsx`
- `inertia/components/public/SearchBar.tsx`
- `inertia/components/public/FilterBar.tsx`
- `inertia/components/public/FilterChip.tsx`
- `inertia/pages/productions.tsx` (stub)
- `tests/functional/public/home.spec.ts`
- `tests/functional/public/productions.spec.ts`
- `tests/unit/components/search_bar.spec.ts`
- `tests/unit/components/filter_chip.spec.ts`

**Fichiers modifiés :**

- `app/models/production.ts` — ajout relations `statsViews`, `statsDownloads`
- `inertia/pages/home.tsx` — réécriture complète (hero + 2 sections + filtres)
- `inertia/css/app.css` — utilitaire `.font-display`
- `inertia/locales/public/fr.json` / `en.json` — clés `home.*`, `search.*`, `filters.*`, `production_card.*`, `productions.*`
- `start/routes.ts` — `/` passe en route contrôleur + ajout `/productions`
- `.adonisjs/server/pages.d.ts` + `database/schema.ts` — régénérés (codegen), à committer

**Variance architecture vs base de code :** l'`architecture.md` place les pages publiques sous `inertia/pages/public/` et les contrôleurs sous `app/controllers/public/`. La base de code réelle garde les **pages publiques à plat** (`home.tsx`, `privacy-policy.tsx`) — on suit cette convention pour les pages, mais on **introduit le namespace `app/controllers/public/`** (miroir de `admin/`) car un contrôleur est nécessaire ici. Cohérent avec le nesting Tuyau déjà utilisé pour `admin/`.

### Previous Story Intelligence (5.1 + Epic 2/4)

- **Story 5.1 (juste livrée)** : `PublicLayout` enrichi (header/footer/LanguageSwitcher), composants partagés dans `shared/`, tests Node-pur pour composants React, route `renderInertia` pour pages statiques. **Gotcha codegen `.adonisjs/server/pages.d.ts`** rencontré et résolu (ajout manuel de l'entrée page) — anticiper ici pour `productions`.
- **Story 2.1** : registry Tuyau **niche les contrôleurs sous-dossier** → `controllers.public.Home` (pas `controllers.PublicHome`). `@japa/api-client` suit 5 redirects par défaut (ici on attend des 200, OK). `client.loginAs` dispo via `authApiClient`/`sessionApiClient` (déjà dans `tests/bootstrap.ts`) — utile pour créer des fixtures admin (nécessaire au `createdById` d'une production).
- **Story 4.x** : `admin/productions_controller.ts` = référence pour pagination, bornage des query params, sérialisation plate. `ProductionService` gère publish/unpublish (`antaPublishedAt` figé à la 1ʳᵉ publication — fiable pour le tri "récentes").
- **Flaky connu** : `tests/unit/models/production.spec.ts` (index GIN, planner Postgres sur table vide) — non lié ; ne pas s'en alarmer s'il apparaît isolément.

### Latest Tech Information

- **AdonisJS Lucid `withAggregate`** : `query.withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))` ajoute `viewsCount` dans `$extras`. Trier ensuite via `.orderBy('viewsCount', 'desc')` (Postgres accepte l'alias en ORDER BY). Caster `Number(p.$extras.viewsCount)` (Postgres renvoie un bigint/string).
- **Inertia 2.x (`@inertiajs/react`)** : `router.visit(url)` pour naviguer programmatiquement ; `usePage().props` pour lire les props serveur.
- **react-i18next** : `useTranslation()` → `{ t }` ; clés nichées `home.sections.most_viewed`.
- **lucide-react** : `import { Search, Eye, Download, X } from 'lucide-react'`.

### Questions / clarifications (pour l'utilisateur)

1. **Lien des cartes vers le détail (`/productions/:id`)** : la page détail est l'**Epic 6**. En attendant, le clic sur une carte mènera à une route inexistante (404) si l'Epic 6 n'est pas encore fait. Options : (a) lien actif vers `/productions/:id` dès maintenant (assumant Epic 6 proche) ; (b) carte non cliquable jusqu'à l'Epic 6 ; (c) lien désactivé visuellement. **Recommandation : (a)** pour ne pas refaire le markup plus tard. Confirmes-tu ?
2. **`<h1>` de la homepage** : préfères-tu un titre/tagline **visible** (ex. "Anta — Bibliothèque communautaire") ou un `<h1 className="sr-only">` (hero = SearchBar) ? **Recommandation : tagline visible** discrète au-dessus de la SearchBar.
3. **Profondeur du stub `/productions`** : OK pour un stub minimal (écho des paramètres + "résultats à venir") que 5.3/5.4 remplaceront, plutôt que d'avancer le listing dans 5.2 ?

### References

- [Source: epics.md#Story 5.2] — Acceptance Criteria d'origine (FR9, UX-DR23)
- [Source: epics.md#Story 5.3, 5.4] — Périmètre recherche/listing (NE PAS empiéter)
- [Source: epics.md#Epic 5] — FR1–FR9, FR16 (listing), NFR1 (<3s)
- [Source: ux-design-specification.md#Homepage — Mode Découverte] — Wireframe : SearchBar centrée + FilterBar chips + 2 sections, aucune recherche active
- [Source: ux-design-specification.md#SearchBar / FilterChip / FilterBar / ProductionCard] — Specs composants (role/aria, variantes, compteurs)
- [Source: ux-design-specification.md#États Vides] — Ton factuel, `text-stone-300/500`, pas d'illustration
- [Source: architecture.md#Contrôleurs (Backend)] — `public/HomeController`, `public/ProductionsController`
- [Source: architecture.md#Frontières des Routes] — Site public préfixe `/`, aucun middleware
- [Source: architecture.md#Formats d'Échange] — Props Inertia plates, pas de wrapper
- [Source: app/models/production.ts] — Colonnes + relations (ajout stats à faire)
- [Source: app/models/stats_view.ts, stats_download.ts] — Source des compteurs
- [Source: app/controllers/admin/productions_controller.ts] — Pattern contrôleur/sérialisation
- [Source: app/enums/production_status.ts] — `ProductionStatus.PUBLISHED`
- [Source: database/schema.ts] — `searchVector` présent, pas de `slug`
- [Source: inertia/css/app.css] — Tokens couleurs + Playfair sur h1/h2
- [Source: Story 5.1] — PublicLayout, composants partagés, gotcha codegen pages.d.ts
- [Source: Story 2.1] — Nesting registry Tuyau, fixtures de test, redirects api-client

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Codegen `.adonisjs` (registry + pages)** : après ajout des contrôleurs `public/*` et de la page `productions.tsx`, le typecheck échouait (`controllers.public` inexistant + `'productions'` absent de `InertiaPages`). Résolu en lançant `node ace test` qui régénère le codegen (`controllers.ts`, `pages.d.ts`, `routes.d.ts`, `schema.ts`). Ces fichiers générés doivent être committés (build Render/Vite en dépend — cf. Story 5.1).
- **Décisions sur les 3 questions ouvertes (appliquées par défaut, recommandations de la story)** : (1) cartes liées à `/productions/:id` dès maintenant ; (2) `<h1>` tagline visible (`home.tagline`) ; (3) stub `/productions` minimal (écho des paramètres). À confirmer/ajuster par l'utilisateur en review.

### Completion Notes List

- AC1–AC5 satisfaits ; AC6 (tests) vert (265/265)
- Relations `statsViews`/`statsDownloads` ajoutées au modèle `Production` (aucune migration)
- `HomeController` : agrégation des vues/téléchargements via `withAggregate` (alias `viewsCount`/`downloadsCount`), tri vues desc / `antaPublishedAt` desc, 6 max/section, productions publiées uniquement, catégories distinctes
- Composants publics créés dans `inertia/components/public/` : `SearchBar`, `FilterBar`, `FilterChip`, `ProductionCard` (variante grille)
- Homepage `home.tsx` réécrite (hero SearchBar + FilterBar + 2 sections + états vides) ; route `/` passée en route contrôleur
- Stub `/productions` (contrôleur + page) pour que la navigation SearchBar/chip aboutisse en 200 — listing réel en 5.3/5.4
- Utilitaire CSS `.font-display` (Playfair Display hors h1/h2)
- i18n FR/EN enrichies (parité préservée — `translations.spec.ts` vert)
- Tests : 265/265, lint 0, typecheck 0
- Tâche 8.4 (test manuel navigateur) restante — à faire par l'utilisateur
- `home.tagline` ("La bibliothèque numérique de la communauté Anta") et `productions.results_pending` sont des libellés provisoires — ajustables

### File List

**Créés :**
- `app/controllers/public/home_controller.ts`
- `app/controllers/public/productions_controller.ts` (stub)
- `inertia/components/public/ProductionCard.tsx`
- `inertia/components/public/SearchBar.tsx`
- `inertia/components/public/FilterBar.tsx`
- `inertia/components/public/FilterChip.tsx`
- `inertia/pages/productions.tsx` (stub)
- `tests/functional/public/home.spec.ts`
- `tests/functional/public/productions.spec.ts`
- `tests/unit/components/search_bar.spec.ts`
- `tests/unit/components/filter_chip.spec.ts`

**Modifiés :**
- `app/models/production.ts` — relations `statsViews`, `statsDownloads`
- `inertia/pages/home.tsx` — réécriture complète (hero + 2 sections + filtres)
- `inertia/css/app.css` — utilitaire `.font-display`
- `inertia/locales/public/fr.json` / `en.json` — clés `home.*`, `search.*`, `filters.*`, `production_card.*`, `productions.*`
- `start/routes.ts` — `/` en route contrôleur + ajout `/productions`
- `.adonisjs/server/{controllers.ts,pages.d.ts,routes.d.ts}` + `.adonisjs/client/*` + `database/schema.ts` — régénérés (codegen), à committer

### Change Log

- 2026-06-01 : Implémentation Story 5.2 (Page d'accueil — deux sections + filtres visibles). Relations stats sur `Production`, `HomeController` public (sections "plus consultées"/"récemment ajoutées" via `withAggregate`, catégories distinctes), composants publics `SearchBar`/`FilterBar`/`FilterChip`/`ProductionCard`, homepage réécrite, stub `/productions`, utilitaire `.font-display`, i18n FR/EN. 11 fichiers créés, 6 modifiés (+ codegen). Tests : 265/265 verts, lint+typecheck verts.
