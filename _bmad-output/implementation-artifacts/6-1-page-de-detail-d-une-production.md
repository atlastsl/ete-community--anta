# Story 6.1 : Page de détail d'une production

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **consulter la page de détail d'une production via une URL lisible (`/productions/:slug`), avec l'intégralité de ses métadonnées publiques et ses compteurs de vues/téléchargements**,
afin d'**évaluer la pertinence du contenu avant de le lire ou de le télécharger** (FR10, FR16).

## Décision de périmètre (lire en premier)

- **URL = slug lisible** (`/productions/le-titre-de-l-oeuvre`), décision Aurélien 2026-06-02. Conforme aux epics/architecture/SEO. **Le modèle `Production` n'a PAS de colonne `slug` aujourd'hui** → cette story crée l'infrastructure slug (migration + génération + backfill) en plus de la page détail.
- **DANS le périmètre 6.1** : infra slug, route+controller `show`, page détail (métadonnées complètes, layout 2 colonnes, breadcrumb, 404, **affichage** des compteurs), `SeoService.forProduction`, clés i18n, point de montage `ViewTracker` (stub), tests page détail + génération slug + SEO.
- **HORS périmètre (stories suivantes)** : lecteurs média réels (PDF/EPUB/vidéo/audio) = **6.2** ; boutons de téléchargement + `recordDownload` + iframe embed = **6.3** ; logique d'enregistrement de vue (timer 10s + `POST /stats/view`) = **6.4** ; suite de tests complète = **6.5**. En 6.1, la zone fichiers/liens affiche une **liste simple (nom + format)** ; les lecteurs et boutons interactifs viendront en 6.2/6.3.

## Acceptance Criteria

1. **Given** un visiteur accède à `/productions/:slug` d'une production **publiée**, **When** la page se charge, **Then** un **200** est retourné et **toutes les métadonnées publiques** sont affichées : titre, auteur(s), catégorie, domaine, sous-domaine(s), langue, pays, date de publication de l'œuvre, résumé complet, licence, tags, journal/revue, éditeur, ISBN/DOI/ISSN, institution. Les champs nuls/vides sont **omis** (pas de label vide).
2. **Given** la page de détail est affichée, **When** elle se rend, **Then** les **compteurs de vues et de téléchargements** sont visibles (FR16), alimentés par agrégation de `stats_views`/`stats_downloads`.
3. **Given** desktop (≥ 1024px), **When** le layout se rend, **Then** un **layout 2 colonnes** est utilisé : contenu principal (résumé + zone fichiers/liens) à gauche (~2/3), métadonnées secondaires + compteurs à droite (~1/3). **Given** mobile (< 768px), **Then** colonne unique empilée.
4. **Given** la page de détail, **When** le breadcrumb est rendu, **Then** il affiche **Accueil > Productions > {titre tronqué}**, chaque élément (sauf le titre courant) étant un lien cliquable, avec `aria-current="page"` sur l'élément courant.
5. **Given** une production qui **n'existe pas**, est en **brouillon** (`draft`) ou **dépubliée** (`unpublished`), **When** un visiteur accède à son URL, **Then** une page **404** est retournée (jamais de fuite de contenu non publié).
6. **Given** la page se charge, **When** le composant `ViewTracker` est monté avec le `productionId`, **Then** il est présent dans l'arbre (le décompte 10s + l'enregistrement réel relèvent de la Story 6.4 — ici un stub no-op suffit).
7. **Given** le rendu serveur, **When** la page détail est servie, **Then** les balises meta SEO de la production sont injectées (titre, description, `og:title`, `og:description`, `og:type="article"`) via `SeoService.forProduction` (FR36).
8. **Given** un slug, **When** une production est créée (panel admin) ou via le seeder, **Then** un `slug` **unique** est généré à partir du titre ; les **productions existantes** (300 seedées + autres) reçoivent un slug par **backfill** dans la migration ; la colonne est `NOT NULL` + **unique** + indexée. Le slug **ne change jamais** après création (URLs stables).
9. **Given** une carte de production sur l'accueil/listing, **When** on clique sur le titre, **Then** le lien pointe vers `/productions/{slug}` (et non `/:id`).
10. **Given** l'interface, **When** la page est rendue, **Then** tous les textes passent par `react-i18next` (FR/EN, parité stricte) ; **un seul `<h1>`** (le titre) ; landmarks `<nav>` (breadcrumb), `<main>`, `<aside>` ; focus visible conservé (WCAG 2.1 AA).

## Tasks / Subtasks

- [x] **Tâche 1 — Infrastructure slug : migration + backfill** (AC: #8)
  - [x] Créer `database/migrations/{timestamp}_add_slug_to_productions_table.ts` (timestamp > `1775918743000`). `up()` : ajouter `table.string('slug', 255).nullable()` PUIS index unique `table.unique(['slug'])`.
  - [x] **Backfill** dans la même migration via `this.defer(async (db) => { ... })` : charger toutes les productions (`id`, `title`), calculer le slug avec la même logique que `ProductionService.generateSlug` (voir Tâche 2), garantir l'unicité (suffixe `-2`, `-3`… si collision), `UPDATE` chaque ligne. ⚠️ Slugifier en JS (gestion des accents), pas en SQL.
  - [x] Après backfill, rendre la colonne `NOT NULL` (`alterTable` → `table.string('slug', 255).notNullable().alter()`).
  - [x] `down()` réversible : `dropColumn('slug')` (drop l'index unique d'abord si nécessaire).
  - [x] ⚠️ Le **trigger `search_vector`** n'a PAS besoin du slug (ne pas le toucher).

- [x] **Tâche 2 — Génération de slug (service)** (AC: #8)
  - [x] Ajouter `static generateSlug(title: string): string` dans `app/services/production_service.ts` : minuscule, translittération ASCII des accents (é→e, à→a, ç→c…), remplacement des non-alphanumériques par `-`, trim des `-` en bordure, longueur max ~80. Fallback `'production'` si vide.
  - [x] Ajouter `static async generateUniqueSlug(title: string): Promise<string>` : base = `generateSlug(title)`, vérifier collision en base (`Production.findBy('slug', candidate)`), suffixer `-2`, `-3`… jusqu'à unicité.
  - [x] Pas de dépendance externe nécessaire (fonction pure de translittération) — sinon `slugify` est acceptable si déjà présent (vérifier `package.json` avant d'ajouter).

- [x] **Tâche 3 — Modèle + génération à la création** (AC: #8)
  - [x] `app/models/production.ts` : ajouter `@column() declare slug: string`.
  - [x] Générer le slug à la **création** uniquement (pas en édition) : dans `app/controllers/admin/productions_controller.ts` (méthode `store`/`create`), appeler `ProductionService.generateUniqueSlug(title)` avant `Production.create(...)`. **Ne jamais régénérer en `update`** (stabilité des URLs).
  - [x] `database/seeders/production_demo_seeder.ts` : générer un slug par ligne (le multiInsert doit inclure `slug`). Garder l'idempotence (`institution='SEED_DEMO'`).

- [x] **Tâche 4 — Route + contrôleur `show`** (AC: #1, #2, #5, #7)
  - [x] `start/routes.ts` : `router.get('/productions/:slug', [controllers.public.Productions, 'show']).as('production.show')`. **Placer APRÈS** `'/productions'` (le listing) pour éviter tout shadowing.
  - [x] `app/controllers/public/productions_controller.ts` : ajouter `async show({ params, request, inertia, response })`.
    - [x] `Production.query().where('slug', params.slug).where('status', 'published').preload('files').preload('links').withAggregate('statsViews', q => q.count('*').as('viewsCount')).withAggregate('statsDownloads', q => q.count('*').as('downloadsCount')).first()`.
    - [x] Si `null` → `response.notFound()` ou rendre la page 404 (statut 404). **Ne jamais** servir une production `draft`/`unpublished`.
    - [x] Sérialiser via un nouveau `serializeDetail(p)` (tous les champs publics + `files` [id, originalName, mimeType, sizeBytes] + `links` [id, url, label, linkType] + `viewsCount`/`downloadsCount` + `slug`). Dates en ISO (`?.toISO() ?? null`).
    - [x] `meta: SeoService.forProduction(SeoService.localeFromCookieHeader(request.header('cookie')), production)`.
    - [x] `return inertia.render('production', { production: serialized, meta })`.

- [x] **Tâche 5 — `SeoService.forProduction`** (AC: #7)
  - [x] `app/services/seo_service.ts` : `static forProduction(locale: Locale, p: Production): MetaTags` → `title: '{titre} — Anta'`, `description: '{auteurs} — {résumé tronqué ~160}'`, `ogTitle`, `ogDescription`, `ogType: 'article'`, `locale`. Réutiliser le mécanisme existant (`inertia_layout.edge` lit `page.props.meta`). Remplacer le commentaire TODO ligne ~84.

- [x] **Tâche 6 — Page détail Inertia** (AC: #1, #2, #3, #4, #6, #10)
  - [x] Créer `inertia/pages/production.tsx` (page publique, layout `PublicLayout` comme `home.tsx`/`productions.tsx`).
  - [x] **Breadcrumb** `<nav aria-label>` : Accueil (`/`) > Productions (`/productions`) > {titre tronqué} (`aria-current="page"`).
  - [x] `<h1>` = titre (Playfair via `.font-display`). Sous-titre auteurs (`production_card.by`).
  - [x] **Layout 2 colonnes** desktop (`grid lg:grid-cols-3`, contenu `lg:col-span-2`, aside `lg:col-span-1`), empilé mobile.
  - [x] **Colonne principale** : résumé complet ; **section fichiers/liens en liste simple** (nom + badge format pour `files` ; libellé + type pour `links`) — placeholder pour 6.2/6.3 (pas de lecteur ni bouton de téléchargement actif ici).
  - [x] **Aside** : compteurs vues/téléchargements (icônes Lucide `Eye`/`Download`, `aria-label`) ; métadonnées structurées (catégorie/domaine/sous-domaines = `Badge` ; langue, pays, date œuvre `dd/mm/yyyy`, licence = `Badge`, journal, éditeur, ISBN/DOI/ISSN, institution). **Omettre tout champ nul/vide.**
  - [x] Tags = chips/badges (affichage seul en 6.1).
  - [x] Monter `<ViewTracker productionId={production.id} />` (stub).
  - [x] Tous les libellés via `useTranslation()` namespace public.

- [x] **Tâche 7 — `ViewTracker` (stub)** (AC: #6)
  - [x] Créer `inertia/components/public/ViewTracker.tsx` : `function ViewTracker({ productionId }: { productionId: string })` qui rend `null`. Ajouter un commentaire « logique timer 10s + POST /stats/view implémentée en Story 6.4 ». Pas d'effet de bord en 6.1.

- [x] **Tâche 8 — Carte → slug** (AC: #9)
  - [x] `inertia/components/public/ProductionCard.tsx` : ajouter `slug: string` à `ProductionCardData` ; le lien titre pointe vers `/productions/${slug}` (ligne ~37).
  - [x] `serialize(p)` dans `productions_controller.ts` ET dans `home_controller.ts` : ajouter `slug: p.slug`. Vérifier que `home`/`listing` chargent bien `slug` (présent par défaut sur le modèle).

- [x] **Tâche 9 — i18n (parité FR/EN stricte)** (AC: #10)
  - [x] `inertia/locales/public/{fr,en}.json` : ajouter les clés (ex.) `production_detail.breadcrumb_home`, `…breadcrumb_productions`, `…views`, `…downloads`, `…summary`, `…metadata`, `…files`, `…external_links`, `…not_found_*`, `…license.{member,free_license,external_link}`, labels champs (`category`, `domain`, `subdomain`, `language`, `country`, `work_published_at`, `journal`, `publisher`, `identifier`, `institution`). Respecter `tests/unit/i18n/translations.spec.ts` (parité des clés).

- [x] **Tâche 10 — Tests** (AC: #1, #5, #8)
  - [x] `tests/functional/public/productions.spec.ts` (étendre) : production publiée par slug → 200 + props métadonnées complètes (via `extractProps`) ; `draft` → 404 ; `unpublished` → 404 ; slug inexistant → 404. Réutiliser `createProduction` + transactions globales.
  - [x] `tests/unit/services/production_service.spec.ts` (étendre) : `generateSlug` (accents, casse, ponctuation, vide→fallback) ; `generateUniqueSlug` (collision → suffixe). ⚠️ tourne contre Supabase en local (cf. gotcha) — vert en CI propre.
  - [x] `tests/unit/services/seo_service.spec.ts` (étendre) : `forProduction` → `ogType: 'article'` + titre/description corrects.
  - [x] Vérifier `node ace test unit` ET `node ace test functional` (suites positionnelles). Lint + typecheck verts.

## Dev Notes

### Stack & contraintes (rappel)
- **AdonisJS 6 + Inertia 2 + React 19 + TypeScript, `ssr: false`** : le React est client-side ; **meta SEO et structure a11y testées par source / via la prop `meta`** rendue dans `inertia_layout.edge` (PAS via le DOM React). [Source: architecture.md#SSR Partiel ; project_anta_status.md#Gotchas Epic 5]
- **rootView** : `(ctx) => ctx.request.url().startsWith('/admin') ? 'admin_layout' : 'inertia_layout'`. La page détail publique passe par `inertia_layout.edge` (charge `@vite(['inertia/app.tsx'])`). [Source: config/inertia.ts]
- **Props Inertia directes** (pas de wrapper `{ data: { ... } }`). [Source: architecture.md#Routes API/Inertia]
- **Dates** : props en ISO 8601 ; affichage `dd/mm/yyyy`. [Source: architecture.md#Formats de Dates]
- **i18n** : `react-i18next`, clés `snake_case` hiérarchiques, `inertia/locales/public/{fr,en}.json`, parité enforced par `translations.spec.ts`. [Source: architecture.md#Internationalisation]
- **Design** : Tailwind v4 + shadcn/ui ; primaire `green-700`, texte `stone-900`, fond `stone-50` ; titres `.font-display` (Playfair). Réutiliser `Badge`, `Button`, `Card`. **Ne pas réintroduire de hover ambre** (corrigé en Epic 5). [Source: ux-design-specification.md#Design System ; inertia/css/app.css]

### Modèle de données (existant — NE PAS réinventer)
- `Production` (`app/models/production.ts`) : `id` (uuid), `title`, `summary`, `authors`/`tags`/`subdomain` (**jsonb arrays**, `prepare`/`consume`), `category`, `domain`, `language`, `publicationCountry`, `journal`, `publisher`, `isbnDoiIssn`, `institution`, `licenseStatus` (`member`|`free_license`|`external_link`), `status` (`draft`|`published`|`unpublished`), `workPublishedAt` (date), `antaPublishedAt` (dateTime), `createdById`. Relations : `files` (HasMany `ProductionFile`), `links` (HasMany `ProductionLink`), `statsViews`, `statsDownloads`. **→ ajouter `slug`.** [Source: app/models/production.ts]
- `ProductionFile` : `id`, `productionId`, `fileKey`, `originalName`, `mimeType`, `sizeBytes`, `storageProvider`. [Source: app/models/production_file.ts]
- `ProductionLink` : `id`, `productionId`, `url`, `linkType` (`embed`|`simple`), `label`. [Source: app/models/production_link.ts]
- `StatsView` : `productionId`, `recordedAt`, `ipHash`, `sessionId`. `StatsDownload` : `productionId`, `downloadedAt`, `ipHash`. [Source: app/models/stats_view.ts, stats_download.ts]

### Patterns à réutiliser (anti-réinvention)
- **Compteurs** : `withAggregate('statsViews', q => q.count('*').as('viewsCount'))` + `p.$extras.viewsCount` — déjà utilisé par `index`/`HomeController`. Coalescer `Number(p.$extras.viewsCount ?? 0)`. [Source: app/controllers/public/productions_controller.ts:12-24]
- **Sérialisation** : suivre le style de `serialize(p)` existant ; créer `serializeDetail(p)` (plus complet). Inclure `slug`. [Source: productions_controller.ts]
- **SEO** : `MetaTags` type + `localeFromCookieHeader` + pattern `listing()` déjà en place ; ajouter `forProduction()`. Le edge lit `page.props.meta`. [Source: app/services/seo_service.ts:8-82 ; resources/views/inertia_layout.edge]
- **Page publique** : copier la structure de `inertia/pages/productions.tsx` / `home.tsx` (import `useTranslation`, type `Props` avec `meta?`, layout `PublicLayout`). [Source: inertia/pages/home.tsx]
- **Cookie `i18n_lang`** : lu via `request.header('cookie')` + regex (PAS `request.cookie()`). [Source: project_anta_status.md#Gotchas Epic 5]

### Routing — attention au shadowing
- Déclarer `/productions/:slug` **après** `/productions`. Le listing reste sur `/productions` ; le détail capture `/productions/<quelque-chose>`. Pas de conflit puisque le listing n'a pas de segment additionnel. [Source: start/routes.ts]

### 404 — sécurité (NFR12)
- La requête `show` filtre `status = 'published'`. Toute production `draft`/`unpublished`/inexistante → **404** (jamais 200 avec contenu masqué). Tester explicitement les 3 cas.

### Project Structure Notes
- **Variance résolue (slug vs id)** : les artefacts de planification prévoyaient `/productions/:slug` mais l'Epic 5 livré utilise `/productions/:id` (ProductionCard) sans colonne `slug`. **Décision Aurélien : slug.** Cette story réconcilie en ajoutant l'infra slug et en mettant `ProductionCard` à jour. Aucune régression attendue sur le listing (les cartes recalculent juste leur `href`). [Source: décision 2026-06-02]
- Nouveaux fichiers : `database/migrations/{ts}_add_slug_to_productions_table.ts`, `inertia/pages/production.tsx`, `inertia/components/public/ViewTracker.tsx`. Modifiés : `production.ts`, `productions_controller.ts`, `home_controller.ts`, `production_service.ts`, `seo_service.ts`, `ProductionCard.tsx`, `production_demo_seeder.ts`, `routes.ts`, locales publiques, specs.
- Nom de page Inertia : `'production'` (singulier) — rendu par `app.tsx` (resolver `./pages/${name}.tsx`). Codegen `.adonisjs/server/pages.d.ts` régénéré au `node ace test` → committer.

### Frontière TS `inertia/` (TS6305)
- Les composants/pages clients se testent par **lecture de source** (`readFileSync` + assert), jamais par import dans un test serveur (cf. `notify.spec`, `search_query.spec`). `ViewTracker`/`production.tsx` → pas de test d'import serveur. [Source: project_anta_status.md#Gotchas Epic 5]

### Gotcha tests/BDD (connu)
- `node ace test` local tourne contre **Supabase** (`.env`), pas une BDD de test dédiée → certains tests data-dépendants échouent en local mais passent en **CI propre**. Ne pas « corriger » ces échecs locaux. La suite **functional** est `continue-on-error` en CI (fix prévu Epic 8) — viser le vert localement quand la BDD le permet, et ne pas régresser l'unit. [Source: project_anta_status.md]

### Stories suivantes (ne PAS implémenter ici)
- 6.2 lecteurs média (PDF/EPUB/MP4/MP3/AAC, URL signée R2 1h) ; 6.3 téléchargement (`FileStorageService.signedUrl` + `StatsService.recordDownload`) + iframe embed ; 6.4 `ViewTracker` réel (timer 10s, `POST /stats/view`, `clearTimeout` au unmount, échec silencieux) ; 6.5 tests complets. `FileStorageService.signedUrl(fileKey): Promise<string>` (TTL 1h) existe déjà pour 6.2/6.3. [Source: epics.md#Epic 6 ; app/services/file_storage_service.ts:65-68]

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] — AC, user story
- [Source: _bmad-output/planning-artifacts/architecture.md#Routes API/Inertia, #SSR Partiel, #Formats de Dates, #Internationalisation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Stratégie Responsive, #Navigation/Breadcrumb, #Accessibilité, #Design System]
- [Source: _bmad-output/planning-artifacts/prd.md#FR10, #FR16, #FR36, #NFR12]
- [Source: app/models/production.ts, production_file.ts, production_link.ts, stats_view.ts, stats_download.ts]
- [Source: app/controllers/public/productions_controller.ts:12-103]
- [Source: app/services/seo_service.ts:8-84]
- [Source: inertia/components/public/ProductionCard.tsx:5-37]
- [Source: start/routes.ts]
- [Source: tests/functional/public/productions.spec.ts, listing.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context)

### Debug Log References

- `node ace migration:run` → migration slug appliquée + backfill des 300 productions seedées (BDD dev Supabase).
- `node ace test functional --files=productions.spec.ts` → 8/8 (3 contrat de base + 5 page détail).
- `node ace test unit --files=production_service.spec.ts seo_service.spec.ts translations.spec.ts` → 26/26.
- `npm run typecheck` ✅ · `npm run lint` ✅.
- Suite complète : unit 201✓/14✗ (14 = échecs connus pollution Supabase : 12 search_service + 2 super_admin, 0 nouveau) ; functional 121✓/26✗ (26 = pollution connue, +5 nouveaux verts). Aucune régression introduite.

### Completion Notes List

- **Décision d'implémentation (surensemble de la story)** : génération du slug via un hook **`@beforeCreate`** sur le modèle `Production` (et non uniquement dans le controller admin). Couvre uniformément l'admin `store`, les fixtures de test et tout futur `Production.create` → évite les violations `NOT NULL` après ajout de la colonne. Le seeder (multiInsert raw, hors hook) et la migration (backfill) posent le slug explicitement.
- **Slug** : `ProductionService.generateSlug` (pur, translittération ASCII NFD + `[̀-ͯ]`) + `generateUniqueSlug` (suffixe `-2`,`-3`… anti-collision). Logique dupliquée à l'identique dans la migration (contexte raw). Slug **stable** (jamais régénéré en `update`).
- **404 sécurisé** : `show` filtre `status = 'published'` → brouillon/dépubliée/inexistante rendent `errors/not_found` avec statut 404 (testé). Pas de fuite de contenu non publié.
- **Périmètre respecté** : page détail = métadonnées + 2 colonnes + breadcrumb + compteurs (affichage) + `ViewTracker` stub. Lecteurs média (6.2), téléchargement/embed (6.3), enregistrement de vue 10s (6.4) NON implémentés (placeholders : liste simple fichiers/liens).
- **Codegen** : `.adonisjs/server/pages.d.ts` régénéré (ajout de la page `production`) + `database/schema.ts` régénéré (colonne slug) au boot ace → à committer.
- **i18n** : bloc `production_detail` ajouté en FR/EN (parité validée par `translations.spec`).

### File List

**Créés :**
- `database/migrations/1775918744000_add_slug_to_productions_table.ts`
- `inertia/pages/production.tsx`
- `inertia/components/public/ViewTracker.tsx`

**Modifiés :**
- `app/models/production.ts` (colonne `slug` + hook `@beforeCreate`)
- `app/services/production_service.ts` (`generateSlug` + `generateUniqueSlug`)
- `app/services/seo_service.ts` (`forProduction`)
- `app/controllers/public/productions_controller.ts` (`show`, `serializeDetail`, `slug` dans `serialize`, import runtime + `ProductionStatus`)
- `app/controllers/public/home_controller.ts` (`slug` dans la sérialisation)
- `inertia/components/public/ProductionCard.tsx` (`slug` → lien `/productions/:slug`)
- `database/seeders/production_demo_seeder.ts` (`slug` par ligne)
- `start/routes.ts` (route `production.show`)
- `inertia/locales/public/fr.json`, `inertia/locales/public/en.json` (bloc `production_detail`)
- `tests/functional/public/productions.spec.ts` (tests page détail + helper)
- `tests/unit/services/production_service.spec.ts` (tests slug)
- `tests/unit/services/seo_service.spec.ts` (tests `forProduction`)
- **Régénérés (codegen)** : `.adonisjs/server/pages.d.ts`, `database/schema.ts` (+ autres `.adonisjs/*` éventuels)

### Change Log

- 2026-06-02 : Implémentation Story 6.1 — page de détail `/productions/:slug` (infra slug + métadonnées + breadcrumb + compteurs + SEO article + ViewTracker stub). Statut → review.
