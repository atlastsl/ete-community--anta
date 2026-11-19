---
baseline_commit: 8155ca4
---

# Story 10.7 : Référencement des pages auteurs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur arrivant d'un moteur de recherche ou d'un partage,
je veux que les pages auteurs aient un titre, une description et un aperçu corrects,
afin de reconnaître le profil avant de cliquer (FR36).

## Décision de périmètre (lire en premier)

- **Aucune migration, aucune route nouvelle, aucune dépendance npm.** `.adonisjs` ne change pas (aucune route ne bouge).
- **Déjà livré (ne pas refaire)** : `SeoService.forAuthor` forme minimale (10.3 : titre, description FR/EN avec singulier, `profile`, `ogUrl`) ; `SeoService.authorsList` minimal (10.5 : titre, description) ; `<Head>` de `PublicLayout` (10.4 : titre d'onglet) ; meta de production = noms de la byline (10.4, D-10.4-6) ; variante `og.jpg` 600×600 des photos (9.3, `AUTHOR_PHOTO_VARIANTS`) servie par `/media` aux seuls profils publics (10.2).
- **Ce que 10.7 ajoute** : `MetaTags.ogImage` ; `forAuthor` construit `ogImage` = `APP_URL` + base photo publique + `/og.jpg` ; `authorsList(locale, appUrl)` gagne `ogUrl` absolue `/authors` ; l'edge rend `og:image` (si présente) et `twitter:card` (`summary_large_image` avec image, sinon `summary`) ; tests unitaires et `seo.spec.ts` (profil, liste, production sans donnée d'auteur non public).
- **Image = `og.jpg`, pas `w384.webp`** : l'architecture (P2.5, P2.7) et l'epic fixent `og.jpg` (JPEG 600×600, lu par tous les robots de partage ; WebP mal supporté par certains). La consigne de lancement mentionnait w384 : la spec prime (D-10.7-1).
- **D37** : aucune `og:image` de production ; seules les pages de profil en ont (`twitter:card=summary` partout ailleurs).
- **Visibilité à source unique** : `ogImage` part de `MediaService.authorPhotoUrl(author)` (photo + consentement) et n'est calculée que dans `AuthorsController.show`, après `findVisibleBySlug` (scope `visibleOnSite`). Un profil non visible → 404 `SeoService.notFound` (aucune meta d'auteur).
- **Hors périmètre** (non demandé par l'epic / l'architecture) : JSON-LD, `<link rel="canonical">`, `noindex` des variantes filtrées/paginées, `hreflang` (pas d'URL par langue : la langue est un cookie), `sitemap.xml` (facultatif, dernière story de l'épique SEO/accessibilité, P2.7), synchronisation client des `og:*` (sans effet pour les robots, deferred-work). Questions PO en fin de fichier.
- Aucun nom réel dans le code ou les tests (noms fictifs « Awa Marie FICTIVE »). Aucun hôte codé en dur dans le code ; les tests construisent l'URL attendue depuis `env.get('APP_URL')` (unitaires : `https://anta.example.org`, domaine réservé).

## Acceptance Criteria

1. **`forAuthor` — image** — `SeoService.forAuthor(locale, author, appUrl)` accepte `photoBase?: string | null` (base publique `MediaService.authorPhotoUrl`, `/media/authors/<id>/<token>`) ; avec une base photo **et** `appUrl` : `ogImage` = `{appUrl sans / final}{photoBase}/og.jpg` ; sans photo, sans `appUrl`, ou base hors `/media/authors/` → `ogImage` absent. Titre, description, `ogType: 'profile'`, `ogUrl` inchangés (10.3).
2. **`authorsList`** — `SeoService.authorsList(locale, appUrl?)` : titre « Auteurs — Anta » / « Authors — Anta », description = phrase d'introduction FR/EN, `website`, `ogUrl` = `{appUrl}/authors` (sans paramètres de filtre/tri/page) si `appUrl`, jamais d'`ogImage`.
3. **Edge** — `resources/views/inertia_layout.edge` : quand `page.props.meta.ogImage` existe, `<meta property="og:image" content="…">` ; toujours (si `meta`) `<meta name="twitter:card" content="summary_large_image">` avec image, `summary` sans. Valeurs échappées par `{{ }}` (un nom contenant `"`, `<`, `</script>` ne casse pas le `<head>`).
4. **Profil** — `GET /authors/:slug` d'un auteur visible avec photo : HTML contient `og:type=profile`, `og:url` absolue `/authors/:slug`, `og:image` = `APP_URL/media/authors/<id>/<token>/og.jpg`, `twitter:card=summary_large_image`, `<title>` « Prénom NOM — Anta », description « {institution principale} — {n} productions publiées sur Anta ». Sans photo : pas d'`og:image`, `twitter:card=summary`.
5. **Liste** — `GET /authors` : titre, description, `og:url` absolue `/authors` (même avec `?q=…&page=…`), `twitter:card=summary`, pas d'`og:image`.
6. **Production** — `GET /productions/:slug` : pas d'`og:image`, `twitter:card=summary` (D37) ; les meta ne contiennent aucune donnée d'un auteur non public autre que son nom affiché sur la page (ni slug, ni photo `/media/authors`, ni institution).
7. **Pages génériques** — accueil, listing, politique, 404 : `twitter:card=summary`, pas d'`og:image`.

## Tasks / Subtasks

- [x] **T1 — Tests rouges** (AC 1–7)
  - [x] `tests/unit/services/seo_service.spec.ts` : `forAuthor` avec photo + appUrl (slash final toléré) → `ogImage` ; sans photo / sans appUrl / base hors `/media/authors/` → absent ; `authorsList` avec/sans appUrl → `ogUrl`, jamais `ogImage` ; `forProduction`/`site`/`listing` → `ogImage` absent.
  - [x] `tests/functional/public/seo.spec.ts` : profil avec photo + affiliation (balises complètes) ; profil sans photo ; nom piégé (`"`, `<script>`) échappé dans le `<head>` ; liste (avec paramètres) ; production liée à un auteur non public avec photo et affiliation + à un auteur public avec photo (aucune `og:image`, aucun slug / `/media/authors` / institution de l'auteur non public dans le `<head>`) ; pages génériques `summary`. Données isolées par transaction globale.
  - [x] Vérifier qu'ils échouent avant implémentation.
- [x] **T2 — Service** `app/services/seo_service.ts` : `MetaTags.ogImage?: string` ; `forAuthor` (`photoBase`) ; `authorsList(locale, appUrl?)` ; helper privé `absoluteUrl(appUrl, path)`.
- [x] **T3 — Contrôleur** `app/controllers/public/authors_controller.ts` : `photoBase: MediaService.authorPhotoUrl(author)` passé à `forAuthor` (même valeur que la prop) ; `authorsList(locale, env.get('APP_URL'))`.
- [x] **T4 — Edge** `resources/views/inertia_layout.edge` : `og:image`, `twitter:card`.
- [x] **T5 — Vérifications** : `npm run test:local` (base 1000 + nouveaux), lint, typecheck, build (codes de sortie) ; statut `review`.

## Dev Notes

### État actuel (fichiers UPDATE, lus)

- `app/services/seo_service.ts` : `MetaTags` (`title`, `description`, `ogTitle`, `ogDescription`, `ogType`, `ogUrl?`, `locale`) ; `site`, `privacy`, `notFound`, `authorsList` (sans `ogUrl`), `listing`, `forProduction` (`ogUrl` = `appUrl` sans `/` final + `/productions/:slug`), `forAuthor` (forme minimale 10.3, `formatAuthorName`). Pur, sans base : testable en unitaire. **Préserver** toutes les formes existantes (tests 10.1/10.3/10.5).
- `app/controllers/public/authors_controller.ts` : `index` (`meta: SeoService.authorsList(locale)`), `show` (`findVisibleBySlug` → 404 sinon ; `photoBase: MediaService.authorPhotoUrl(author)` dans les props ; `meta: forAuthor(…, env.get('APP_URL'))` avec `primaryInstitution = affiliations[0]` et `publishedCount = stats.productions`). **Préserver** les 404 (dont la course « dernière production dépubliée »), les redirections hors limites.
- `app/services/media_service.ts` : `authorPhotoUrl` = `/media/${photoKey}` seulement si photo **et** consentement ; `/media/authors/<id>/<token>/og.jpg` servi par `MediaController` (clé courante, profil public, `image/jpeg`).
- `resources/views/inertia_layout.edge` : `<title inertia>`, `description`, `og:title`, `og:description`, `og:type`, `og:url` si présent. `admin_layout.edge` non concerné (noindex).
- `app/controllers/public/productions_controller.ts` `show` : `forProduction` avec les noms de la byline (`PublicBylineService`) — déjà conforme à AC 6, à couvrir par test.

### Garde-fous

- `{{ }}` d'Edge échappe `& < > " '` : ne jamais utiliser `{{{ }}}` pour les meta.
- L'URL `og:image` vient de la clé `photo_key` (générée serveur : `authors/<uuid>/<token base64url>`) : aucun caractère à encoder ; garde `startsWith('/media/authors/')` en défense.
- Tests `inertia/` inchangés (pas de code client). Japa : `db.beginGlobalTransaction()` par test ; `refreshDenormalizedNames` après insertion pivot ; extraire le `<head>` (`html.split('</head>')[0]`) pour les assertions de non-fuite (le `data-page` du `<body>` contient légitimement la byline).

### Décisions par défaut (D-10.7-x)

- **D-10.7-1** `og:image` = variante `og.jpg` (600×600 JPEG) conformément à P2.5/P2.7, pas `w384.webp`.
- **D-10.7-2** `twitter:card=summary_large_image` avec la photo carrée, comme l'exige l'epic (aperçu recadré par X ; `summary` serait plus fidèle au carré — question PO).
- **D-10.7-3** `ogUrl` de la liste = `/authors` nu, quels que soient filtres et page (URL canonique de partage).
- **D-10.7-4** Pas de `og:image:alt`, `og:image:width/height`, `twitter:title` (les robots retombent sur `og:*`) : hors spec.

### Review Findings

- [x] [Review][Patch] Tests de non-exposition [seo.spec.ts] — auteur avec photo dont le consentement est retiré, et auteur avec photo et consentement sans production publiée (brouillon seul) → 404, `<head>` sans `og:image`, sans `/media/authors`, sans le nom (verts dès l'écriture : garde de régression, la visibilité passe par `findVisibleBySlug`).
- [x] [Review][Patch] Type client [inertia/lib/seo.ts] — `SeoMeta.ogImage?: string` (miroir de `MetaTags`).
- [x] [Review][Patch] Dimensions de l'aperçu [inertia_layout.edge] — `og:image:width=600`, `og:image:height=600`, `og:image:type=image/jpeg` quand `ogImage` existe (variante fixe) ; test rouge puis vert, absents sans photo (amende D-10.7-4).
- [x] [Review][Note] `/media` sert les photos sur le seul consentement (sans exiger de production publiée) : question PO de 10.2, inchangée ; l'`og:image` n'est de toute façon émise que sur un profil visible.
- [ ] [Review][PO] Recadrage 2:1 de X avec `summary_large_image` sur une photo carrée (D-10.7-2) : reste une question PO.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.7] ; en-tête Epic 10 (visibilité) ; 10.8 (scénarios SEO).
- [Source: architecture.md#P2.5] (« SEO » : `ogImage`, `twitter:card`, D37), #P2.7 (« SEO profil », plan du site facultatif).
- [Source: prd.md] FR36 (modifié Phase 2), FR37.
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] « Rendu » : photo + nom + affiliation principale pour les profils, pas d'`og:image` pour les productions.
- [Source: 10-3-…md] (D-10.3-2), [10-4-…md] (D-10.4-6, `<Head>`), [10-5-…md] (D-10.5-3).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Rouge vérifié : 2 tests unitaires (`ogImage`, `authorsList.ogUrl`) et 6 tests functional (`seo.spec.ts`) en échec avant le code ; verts ensuite (34/34 sur les deux fichiers).
- `npm run test:local` : 1010 tests verts (base 1000) ; `lint`, `typecheck`, `build` : code 0. Aucune route modifiée → `.adonisjs` inchangé.

### Completion Notes List

- `SeoService` : `MetaTags.ogImage?` ; helper `absoluteUrl(appUrl, path)` (slash(s) final(aux) retirés, `undefined` sans URL configurée) utilisé par `forProduction`, `forAuthor`, `authorsList` ; `forAuthor` accepte `photoBase` (base publique de `MediaService.authorPhotoUrl`) → `ogImage` = `{APP_URL}{photoBase}/og.jpg`, seulement si la base commence par `/media/authors/` ; `authorsList(locale, appUrl?)` → `ogUrl` `/authors` nu.
- `AuthorsController` : `photoBase` calculé une fois (prop + meta) ; `authorsList(locale, env.get('APP_URL'))`.
- `inertia_layout.edge` : `og:image` si présente, `twitter:card` (`summary_large_image` / `summary`), valeurs échappées par `{{ }}`.
- Tests : unitaires (image avec/sans photo, sans APP_URL, base hors `/media/authors/`, liste, aucune image hors profil) ; functional (profil avec photo, sans photo, nom piégé échappé, liste avec paramètres, production liée à un auteur non public + un public : ni `og:image` ni slug / id / `/media/authors` / institution de l'auteur non public dans le `<head>`, pages génériques et 404 en `summary`).

### File List

- app/services/seo_service.ts (modifié)
- app/controllers/public/authors_controller.ts (modifié)
- resources/views/inertia_layout.edge (modifié)
- tests/unit/services/seo_service.spec.ts (modifié)
- tests/functional/public/seo.spec.ts (modifié)
- inertia/lib/seo.ts (modifié, revue)
- _bmad-output/implementation-artifacts/10-7-referencement-des-pages-auteurs.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

- `twitter:card=summary_large_image` avec une photo carrée 600×600 (exigé par l'epic) : X recadre en 2:1 ; `summary` (vignette carrée) serait plus fidèle. Garder ? (D-10.7-2)
- JSON-LD `Person`, `<link rel="canonical">`, `noindex` des variantes filtrées/paginées et `sitemap.xml` ne sont pas demandés en Phase 2 (sitemap facultatif, dernière story SEO/accessibilité) : à planifier ?

## Change Log

- 2026-11-19 : story créée (contexte complet, ready-for-dev).
- 2026-11-19 : implémentation (`og:image` og.jpg des profils, `twitter:card`, `og:url` de la liste, tests SEO) ; 1010 tests ; statut review.
- 2026-11-19 : revue de code appliquée (3 correctifs, 1 note, 1 question PO) ; 1012 tests ; statut done.
