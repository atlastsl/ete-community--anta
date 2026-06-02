# Story 5.5 : SEO — Meta tags côté serveur

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que moteur de recherche,
Je veux accéder aux meta tags de chaque page directement dans le HTML,
Afin d'indexer correctement le contenu et d'afficher un aperçu riche lors du partage (FR36).

> **5ᵉ story de l'Epic 5.** Elle met en place l'**infrastructure de meta tags injectés côté serveur** (SSR partiel) et l'applique aux pages publiques **existantes** : accueil (`/`), listing (`/productions`), politique de confidentialité (`/privacy-policy`).
>
> ⚠️ **Périmètre — la page détail `/productions/:slug` est l'Epic 6** : elle n'existe pas encore. L'AC d'origine la référence, mais 5.5 livre le **mécanisme réutilisable** (`SeoService` + rendu edge) + les **meta génériques** des pages existantes. L'Epic 6 ajoutera `SeoService.forProduction()` (og:type=article, titre/description issus de la production) en réutilisant ce mécanisme. Cette story documente ce point de jonction.

## Acceptance Criteria

**AC1 — Meta tags injectés dans le HTML shell (avant hydratation React)**

- **Given** un client (moteur de recherche / scraper social) accède à une page publique
- **When** AdonisJS génère le HTML shell (edge `inertia_layout.edge`)
- **Then** les balises sont présentes dans le **HTML initial** (avant tout JS) : `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:type">`
- **And** ces balises sont rendues **côté serveur** (visibles dans `response.text()` brut), **pas** via le client React (`ssr: false` → un `<Head>` React ne suffirait pas pour les crawlers)

**AC2 — Meta génériques sur accueil et listing (FR36, AC3 d'origine)**

- **Given** l'accueil (`/`) ou le listing (`/productions`) est accédé
- **When** le HTML est généré
- **Then** des meta génériques sont injectés : titre du site (« Anta »), description de la bibliothèque, `og:type="website"`

**AC3 — Open Graph présent pour le partage social**

- **Given** un lien public est partagé sur un réseau social
- **When** le scraper accède à la page
- **Then** les balises Open Graph (`og:title`, `og:description`, `og:type`) sont présentes dans le HTML initial

**AC4 — Meta localisés (FR/EN) selon le cookie `i18n_lang`**

- **Given** le visiteur a choisi une langue (cookie `i18n_lang` = `fr` ou `en`)
- **When** le HTML est généré côté serveur
- **Then** les meta (titre/description) sont rendus dans la langue correspondante (défaut `fr` si cookie absent/invalide)
- **And** l'attribut `<html lang>` reflète la langue active

**AC5 — Mécanisme prêt pour la page détail (Epic 6)**

- **Given** l'infrastructure `SeoService` + rendu edge est en place
- **When** l'Epic 6 implémentera `/productions/:slug`
- **Then** il suffira d'ajouter `SeoService.forProduction(locale, production)` (`og:type="article"`, titre/description de la production) et de passer le prop `meta` — **sans** retoucher l'edge ni le mécanisme
- _(Cette AC est une exigence de conception/documentation, pas une page à livrer dans 5.5.)_

**AC6 — Tests automatisés**

- **Given** la suite de tests est exécutée (`node ace test`)
- **When** les specs de cette story tournent
- **Then** au minimum :
  - `GET /` (HTML brut) contient `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:type" content="website">`
  - `GET /productions` (HTML brut) contient les meta génériques
  - Cookie `i18n_lang=en` → description en anglais ; absent/`fr` → français ; `<html lang>` correct
  - `SeoService` (unitaire) : `resolveLocale`, `site(locale)`, `listing(locale, q?)` produisent les bons champs

## Tasks / Subtasks

- [x] **Tâche 1 — `SeoService` (constructeur de meta tags localisés)** (AC2, AC4, AC5)
  - [x] 1.1 Créé `app/services/seo_service.ts` ; types `MetaTags`/`Locale` exportés.
  - [x] 1.2 Dictionnaire serveur FR/EN (nom + description bibliothèque) — indépendant des locales React.
  - [x] 1.3 `resolveLocale(value)` + **`localeFromCookieHeader(cookieHeader)`** (voir Debug Log — lecture du cookie brut via l'en-tête).
  - [x] 1.4 `site(locale)` → `ogType: 'website'`.
  - [x] 1.5 `listing(locale, q?)` → titre avec/sans terme, `ogType: 'website'`.
  - [x] 1.6 `forProduction` non implémenté (Epic 6) — signature documentée en commentaire.

- [x] **Tâche 2 — Rendu des meta dans l'edge `inertia_layout.edge`** (AC1, AC3, AC4)
  - [x] 2.1 Lecture via `page.props.meta` (confirmé : root view rendu avec `{ page: pageObject }` en `ssr:false`).
  - [x] 2.2 `<html lang="{{ page.props.meta ? page.props.meta.locale : 'fr' }}">`.
  - [x] 2.3 `<title inertia>{{ page.props.meta ? page.props.meta.title : 'Anta' }}</title>`.
  - [x] 2.4 Bloc `@if(page.props.meta)` : description + og:title/description/type.
  - [x] 2.5 Placé avant `@inertiaHead()`/`@vite()`.

- [x] **Tâche 3 — Lecture de la locale serveur (cookie `i18n_lang`)** (AC4)
  - [x] 3.1 **Révision** : `request.plainCookie(..., false)` ne lit pas un cookie brut posé par JS de façon fiable (jar api-client). → Lecture **directe de l'en-tête** `request.header('cookie')` + regex `i18n_lang=(fr|en)` dans `SeoService.localeFromCookieHeader` (robuste pour le cookie i18next réel).
  - [x] 3.2 Contrôleurs : `const locale = SeoService.localeFromCookieHeader(request.header('cookie'))`.

- [x] **Tâche 4 — Brancher le prop `meta` sur les pages existantes** (AC2)
  - [x] 4.1 `home_controller` → `meta: SeoService.site(locale)`.
  - [x] 4.2 `productions_controller` → `meta: SeoService.listing(locale, q)`.
  - [x] 4.3 `/privacy-policy` **converti en mini-contrôleur** `PagesController.privacy` (lit la locale, rend `meta`). Route mise à jour.
  - [x] 4.4 Pages sans `meta` (admin/erreurs) → fallback edge `<title>Anta</title>`, pas d'OG. Aucune régression.

- [x] **Tâche 5 — i18n / contenu / typage**
  - [x] 5.1 Chaînes meta côté serveur (`SeoService`) — locales React inchangées, `translations.spec.ts` vert.
  - [x] 5.2 Page `privacy-policy` inchangée côté rendu.
  - [x] 5.3 **Typage InertiaPages** : ajout d'une prop optionnelle `meta?: SeoMeta` (nouveau `inertia/lib/seo.ts`) aux types de props de `home.tsx`, `productions.tsx`, `privacy-policy.tsx` (sinon `inertia.render(..., { meta })` ne typecheck pas — les props autorisées sont dérivées du composant React).

- [x] **Tâche 6 — Tests** (AC6)
  - [x] 6.1 `tests/functional/public/seo.spec.ts` : `/`, `/productions`, `/privacy-policy` → meta dans le HTML brut (title, description, og:title/description/type=website).
  - [x] 6.2 Locale EN : cookie brut injecté via `request.cookiesJar` (le serializer api-client `prepare` le transmet tel quel) → `<html lang="en"` + description anglaise ; sans cookie → `fr`.
  - [x] 6.3 `tests/unit/services/seo_service.spec.ts` : `resolveLocale`, `localeFromCookieHeader` (en/fr/multi-cookies/fallback), `site`, `listing`.
  - [x] 6.4 Pages admin/404 non cassées (fallback `Anta`) — vérifié par la suite complète verte.

- [x] **Tâche 7 — Validation finale**
  - [x] 7.1 `node ace test` → 312/312 verts.
  - [x] 7.2 `npm run lint` → 0 erreur.
  - [x] 7.3 `npm run typecheck` → 0 erreur.
  - [ ] 7.4 Test manuel (**utilisateur**) : « Afficher la source » de `/` montre les meta/OG dans le HTML **avant** JS ; changer la langue (FR↔EN) puis recharger → meta traduits.

## Dev Notes

### Architecture cible — pourquoi côté serveur (et pas via React)

- **`ssr: false`** (cf. `config/inertia.ts`) : les pages React **ne sont pas rendues côté serveur**. Un `<Head>` Inertia (client) n'injecterait les meta **qu'après hydratation JS** → **invisible pour les crawlers / scrapers sociaux** qui lisent le HTML brut. **Conclusion : les meta DOIVENT être rendus par l'edge `inertia_layout.edge` (serveur).** C'est exactement le « SSR partiel » de l'architecture (`architecture.md#SSR Partiel`).
- **Mécanisme** : en mode `ssr:false`, `@adonisjs/inertia` rend le root view via `view.render(rootView, { page: pageObject })` (vérifié dans `inertia_manager`). `pageObject.props` contient les props Inertia → l'edge lit **`page.props.meta`**. On passe donc `meta` comme **prop Inertia** depuis les contrôleurs ; l'edge le rend dans `<head>`.
- **Pourquoi un prop (et pas un 3ᵉ argument `viewProps`)** : `inertia.render` accepte un 3ᵉ arg `viewProps` (étalé dans l'edge), mais passer `meta` comme **prop** est uniforme (fonctionne aussi pour `renderInertia`), lisible dans l'edge via `page.props.meta`, et réutilisable client-side plus tard. Le léger surcoût dans `data-page` est négligeable (meta = petit objet public).

### Locale serveur — gotcha cookie

- Le cookie `i18n_lang` est écrit par **i18next côté client** (`document.cookie`), donc **non signé / non encodé** par AdonisJS. `request.cookie()` (jar signé) **ne le verra pas**. Lire en brut : **`request.plainCookie('i18n_lang', 'fr', false)`** (signature `plainCookie(key, defaultValue?, encoded?)` — `encoded = false` désactive le décodage base64 AdonisJS). Valider ensuite (`'en'` sinon `'fr'`).
- Le cookie config (`inertia/lib/i18n/shared.ts`) documente déjà : « cookie `i18n_lang` lisible côté serveur AdonisJS pour le SSR partiel des meta tags » — c'est exactement cet usage.

### État existant à RESPECTER

- `resources/views/inertia_layout.edge` — shell HTML actuel : `<title inertia>Anta</title>`, `@inertiaHead()`, `@vite(['inertia/app.tsx'])`. **Enrichir** le `<head>` (meta), ne pas casser l'ordre `@viteReactRefresh()` → `@vite()` → `@inertiaHead()`.
- `app/controllers/public/home_controller.ts` (5.2) & `productions_controller.ts` (5.3/5.4) — ajouter le prop `meta`. Ne pas toucher à la logique de listing/recherche/tri.
- `start/routes.ts` — route `/privacy-policy` en `renderInertia` (5.1) → à convertir en contrôleur léger pour injecter `meta` (ou laisser le fallback générique si on accepte un titre « Anta » sur privacy — mais AC2 vise accueil+listing, privacy est un bonus).
- `app/services/*` — pattern services statiques (`ProductionService`, `SearchService`, `ActivityLogService`). `SeoService` suit le même.
- `inertia/lib/i18n/shared.ts` — cookie `i18n_lang` (`fr`/`en`), détection client. Ne pas modifier.
- `inertia/locales/*` — **inchangés** (les meta serveur ne passent pas par react-i18next).

### Conventions et patterns

- **Service statique** `SeoService` (classe, méthodes `static`), `app/services/seo_service.ts`.
- **Edge** : expressions `{{ }}` (auto-échappées), `@if(...) @end`. Garder une forme défensive sur `page.props.meta` (peut être absent).
- **Props Inertia plates** : `meta` = objet plat sérialisable.
- **Validation** : locale via whitelist (`resolveLocale`), pas d'injection (les meta sont des chaînes serveur + le terme `q` échappé par edge).
- **Tests** : fonctionnels `tests/functional/public/`, unitaires `tests/unit/services/`. Pour le SEO, asserter le **HTML brut** (`response.text()`) — c'est tout l'intérêt (présence avant JS).

### Anti-patterns à éviter

- ❌ Injecter les meta via un `<Head>` React (Inertia) → invisible pour les crawlers en `ssr:false`. **Doit** être dans l'edge serveur.
- ❌ Lire `i18n_lang` via `request.cookie()` (signé) → renverra `undefined`. Utiliser `plainCookie(..., false)`.
- ❌ Dupliquer les chaînes meta dans les locales React — elles vivent côté serveur (`SeoService`).
- ❌ Implémenter `/productions/:slug` ou `forProduction()` ici — c'est l'Epic 6 (documenter seulement le point de jonction).
- ❌ Casser le fallback edge pour les pages sans `meta` (admin/404) — garder `<title>Anta</title>` + bloc og conditionnel.
- ❌ Interpoler le terme `q` dans le HTML sans échappement — l'edge `{{ }}` échappe ; ne pas utiliser `{{{ }}}` (raw).
- ❌ Changer l'ordre des directives Vite/Inertia dans l'edge.

### Sécurité / conformité

- Le terme de recherche `q` apparaît dans `<title>`/og du listing → **échappement edge obligatoire** (`{{ }}`, jamais `{{{ }}}`) pour éviter une injection HTML via l'URL.
- Pages publiques **indexables** (le panel admin reste noindex — story 2.5 / `robots.txt`). Ne pas ajouter de `noindex` sur les pages publiques.
- Lecture seule, aucune donnée sensible dans les meta.

### Project Structure Notes

**Fichiers créés :**

- `app/services/seo_service.ts`
- `tests/functional/public/seo.spec.ts`
- `tests/unit/services/seo_service.spec.ts`
- (éventuellement) `app/controllers/public/pages_controller.ts` — mini-contrôleur pour `/privacy-policy` (méthode `privacy`), si conversion choisie

**Fichiers modifiés :**

- `resources/views/inertia_layout.edge` — rendu des meta depuis `page.props.meta` + `<html lang>`
- `app/controllers/public/home_controller.ts` — prop `meta` (`SeoService.site`)
- `app/controllers/public/productions_controller.ts` — prop `meta` (`SeoService.listing`)
- `start/routes.ts` — `/privacy-policy` → contrôleur (si conversion) pour passer `meta`
- `.adonisjs/*` — régénérés si nouveau contrôleur/route (codegen), à committer

**Pas de migration, pas de modèle, pas de changement i18n React.**

### Previous Story Intelligence (5.1–5.4 + Epic 1)

- **Story 5.1** : route `/privacy-policy` via `renderInertia` (pas de contrôleur). Cookie `i18n_lang` + persistance déjà en place (shared.ts). Gotcha codegen `.adonisjs/server/pages.d.ts` (si nouvelle page — ici pas de nouvelle page, mais possible nouveau contrôleur).
- **Story 5.2/5.3/5.4** : `home_controller` et `productions_controller` existent et rendent `home`/`productions` ; y ajouter le prop `meta`. Le contrôleur productions a déjà `q`/`sort`/filtres — `meta` = `SeoService.listing(locale, q)`.
- **Epic 1** : l'edge `inertia_layout.edge` charge `inertia/app.tsx` (public). Les polices (Inter/Playfair) sont chargées via `<link>` Google Fonts dans le head.
- **Nesting registry Tuyau** (Story 2.1) : un nouveau contrôleur `public/pages_controller.ts` serait exposé `controllers.public.Pages` (chemin nesté dans `start/routes.ts`).
- **Flaky connu** : `production.spec.ts` GIN — isolé, non lié.

### Latest Tech Information

- **`@adonisjs/inertia` (ssr off)** : root view rendu avec `{ page: pageObject }` ; `page.props` = props Inertia. Accès edge : `page.props.meta`.
- **AdonisJS `request.plainCookie(key, default?, encoded?)`** : lire un cookie brut non signé (`encoded = false`).
- **Edge.js** : `@if(...) @end`, interpolation `{{ }}` (échappée). Garder `page.props.meta` derrière un `@if`.
- **Open Graph** : `og:title`, `og:description`, `og:type` (`website` pour accueil/listing ; `article` réservé aux pages détail — Epic 6).

### Questions / clarifications (pour l'utilisateur)

1. **Page `/privacy-policy`** : la convertir en mini-contrôleur pour lui donner des meta dédiés (recommandé, cohérent), ou la laisser sur le fallback générique « Anta » (hors périmètre strict de l'AC2 qui ne vise qu'accueil + listing) ?
2. **Textes meta du site** (titre + description de la bibliothèque, FR/EN) : as-tu une formulation officielle à utiliser, ou je rédige une description sobre par défaut (ex. « Anta — bibliothèque numérique communautaire ») ?
3. **`og:image`** : non requis par l'AC (qui liste title/description/type). L'ajouter (logo Anta) maintenant ou le réserver à l'Epic 6 (image par production) ? *Reco : réserver, ajouter une image OG par défaut en option.*

### References

- [Source: epics.md#Story 5.5] — Acceptance Criteria d'origine (FR36)
- [Source: epics.md#Story 5.6] — Périmètre a11y/responsive (NE PAS empiéter ; `<html lang>` ici est minimal pour le SEO)
- [Source: architecture.md#SSR Partiel (meta tags)] — AdonisJS injecte title/description/og:* dans le shell, React hydrate
- [Source: architecture.md#Référencement (FR36–FR37)] — Meta tags SSR, panel admin noindexé
- [Source: config/inertia.ts] — `ssr.enabled: false` (donc meta = edge serveur obligatoire)
- [Source: resources/views/inertia_layout.edge] — Shell HTML à enrichir
- [Source: node_modules/@adonisjs/inertia inertia_manager] — root view rendu avec `{ page: pageObject }`, `page.props` dispo
- [Source: inertia/lib/i18n/shared.ts] — cookie `i18n_lang` « lisible côté serveur pour le SSR partiel des meta tags »
- [Source: app/controllers/public/home_controller.ts, productions_controller.ts] — points d'injection du prop `meta`
- [Source: Story 5.1] — route privacy `renderInertia`, cookie i18n
- [Source: Story 5.4] — `productions_controller` (q/sort/filtres) → `SeoService.listing(locale, q)`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Lecture du cookie `i18n_lang` — révision vs la story** : la story prévoyait `request.plainCookie('i18n_lang', 'fr', false)`. À l'usage, ce n'est PAS fiable pour un cookie posé par le JS client (le jar de l'api-client encode/signe ; côté serveur le décodage ne retombe pas sur la valeur brute). **Solution retenue** : lecture **directe de l'en-tête** `request.header('cookie')` + regex `i18n_lang=(fr|en)` (`SeoService.localeFromCookieHeader`). C'est exactement le format posé par i18next en production, et c'est une fonction pure unit-testable.
- **Test EN end-to-end** : le harness api-client ne permet pas d'envoyer un cookie brut via `.cookie()`/`.plainCookie()` (signature/encodage) ni `.header('cookie',...)` (écrasé par le jar — Shield injecte XSRF). Le serializer api-client `prepare(_, value) => value` transmet toutefois le jar **tel quel** → on insère `request.cookiesJar['i18n_lang'] = { name, value: 'en' }` pour simuler le cookie brut. Vérifié vert.
- **Typage `InertiaPages`** : `inertia.render('home', { ..., meta })` échouait au typecheck (TS2353) car les props autorisées sont dérivées du composant React (qui ne déclarait pas `meta`). Ajout d'une prop optionnelle `meta?: SeoMeta` (`inertia/lib/seo.ts`) aux 3 pages publiques. `meta` reste server-only (rendu edge), non utilisé par React.
- **Test edge existant (Story 1.7)** : `design_system.spec.ts` assertait `<html lang="fr"` en dur ; le `lang` étant désormais dynamique (fallback fr), l'assertion a été adaptée (`<html lang="{{` + `'fr'`).
- **Décisions sur les 3 questions ouvertes (recommandations appliquées)** : (1) `/privacy-policy` converti en mini-contrôleur pour meta dédiés ; (2) description sobre par défaut FR/EN rédigée ; (3) `og:image` réservé à l'Epic 6 (non ajouté).

### Completion Notes List

- AC1–AC4 satisfaits ; AC5 = mécanisme prêt pour l'Epic 6 (documenté) ; AC6 (tests) vert (312/312)
- Meta injectés **côté serveur** dans l'edge (`page.props.meta`) → visibles avant hydratation (crawlers/scrapers), conforme `ssr:false`
- `SeoService` : `site`/`listing` localisés FR/EN, `localeFromCookieHeader` (lecture cookie brut robuste)
- Contrôleurs publics (`home`, `productions`) + nouveau `PagesController.privacy` passent le prop `meta`
- `og:type=website` sur accueil/listing/privacy ; `article` réservé aux pages détail (Epic 6 via `forProduction`)
- `<html lang>` dynamique selon la locale (fallback fr)
- Échappement edge `{{ }}` sur le terme `q` du listing (anti-injection)
- Aucune modification des locales React ; aucune migration
- Tests : 312/312, lint 0, typecheck 0
- Tâche 7.4 (test manuel « afficher la source ») restante — utilisateur
- Textes meta provisoires (descriptions FR/EN) — ajustables

### File List

**Créés :**
- `app/services/seo_service.ts`
- `app/controllers/public/pages_controller.ts` (route `/privacy-policy`)
- `inertia/lib/seo.ts` (type `SeoMeta` partagé)
- `tests/functional/public/seo.spec.ts`
- `tests/unit/services/seo_service.spec.ts`

**Modifiés :**
- `resources/views/inertia_layout.edge` — meta SEO + `<html lang>` depuis `page.props.meta`
- `app/controllers/public/home_controller.ts` — prop `meta` (`SeoService.site`)
- `app/controllers/public/productions_controller.ts` — prop `meta` (`SeoService.listing`)
- `start/routes.ts` — `/privacy-policy` → `controllers.public.Pages.privacy`
- `inertia/pages/home.tsx` / `productions.tsx` / `privacy-policy.tsx` — prop `meta?: SeoMeta` (typage)
- `tests/unit/design_system/design_system.spec.ts` — assertion `lang` adaptée (dynamique)
- `.adonisjs/*` — régénérés (codegen : nouveau contrôleur `public.Pages`), à committer

### Change Log

- 2026-06-01 : Implémentation Story 5.5 (SEO — meta tags côté serveur). `SeoService` (meta localisés FR/EN + lecture cookie brut), rendu des meta/OG dans l'edge `inertia_layout.edge` via `page.props.meta` (SSR partiel, `ssr:false`), prop `meta` sur accueil/listing, `/privacy-policy` converti en contrôleur, `<html lang>` dynamique, type `SeoMeta`. Mécanisme prêt pour la page détail (Epic 6). Aucune migration. 5 fichiers créés, 7 modifiés. Tests : 312/312 verts, lint+typecheck verts.

### Review Findings (code review 2026-06-01)

- [x] [Review][Defer] `<title>`/meta non mis à jour lors de la navigation SPA Inertia [resources/views/inertia_layout.edge] — deferred. Les meta vivent uniquement dans l'edge (serveur) ; lors d'un `router.visit` client (home→listing…), le `<title>`/og ne sont pas rafraîchis. **L'objectif SEO (crawlers, premier chargement) EST atteint** (AC5.5 satisfaits) ; il s'agit d'un confort UX (titre d'onglet) / partage de deep-link post-navigation. Solution éventuelle : `<Head>` Inertia côté pages (gestion titre client) — amélioration, hors AC. (blind)
- [x] [Review][Defer] `<title>` de `/privacy-policy` générique « Anta » [app/controllers/public/pages_controller.ts] — deferred, conforme à la story (meta privacy = bonus). Amélioration mineure : titre dédié pour la page de confidentialité. (auditor)
