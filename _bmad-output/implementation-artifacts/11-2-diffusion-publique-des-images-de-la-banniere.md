---
baseline_commit: 46ddaee
---

# Story 11.2 : Diffusion publique des images de la bannière

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **que les images de la bannière à la une se chargent vite et restent en cache**,
afin que **l'accueil reste rapide** (FR50, D37, NFR17).

## Décision de périmètre (lire en premier)

- Story **sans migration, sans dépendance npm, sans nouvelle route** : `GET|HEAD /media/*` existe (10.2, servi par `MediaMiddleware` avant le routeur) ; `.adonisjs` inchangé.
- **DANS 11.2** :
  - extension de `MediaService` au préfixe `thumbnails/<productionId>/<token 20>/<variante>` (variantes `THUMBNAIL_VARIANTS` : `w400.webp`, `w800.webp`, `w1600.webp`) : servi si le préfixe est le `thumbnail_key` **courant** d'une production `published`, avec `Cache-Control: public, max-age=31536000, immutable` ; sinon 404 `no-store` (comportement de refus de 10.2 inchangé) ;
  - base publique serveur `MediaService.productionImageUrl({ status, thumbnailKey })` → `/media/<thumbnail_key>` ou `null` (calquée sur `authorPhotoUrl`) ; **aucune prop ne l'expose encore** : premier consommateur = prop `featured` de l'accueil (11.6) ;
  - `inertia/lib/media.ts` : `THUMBNAIL_WIDTHS`, `BANNER_IMAGE_SIZES` par emplacement, `bannerImage(imageUrl, slot)` → `{ src, srcSet, sizes, width, height }` (16:9) ;
  - vérification par tests de D37 : cartes texte (transformer, accueil, listing, profil) et détail sans `og:image` ni clé de vignette, même quand la production a une vignette.
- **HORS 11.2 (ne PAS implémenter)** :
  - cartes des **suggestions** citées par l'AC de l'épique : elles n'existent pas encore → vérification D37 reportée à l'Epic 12 (même transformer, aucune image) ;
  - `posters/…`, repli sur `poster_key` dans la base `imageUrl` → **11.3** (le dispatch par préfixe de `MediaService` doit permettre de l'ajouter sans réécrire le contrôleur) ;
  - condition « à la une » pour la diffusion : l'AC dit « production publiée » (P2.5) — pas de table `featured_productions` avant 11.4 ;
  - composant `FeaturedBanner` / `FeaturedCard`, `loading="eager"` + `fetchpriority="high"`, prop `featured` → **11.6** ;
  - aperçus admin : restent en URL signée (`ThumbnailService.signedUrl`, P2.5) ; aucune bascule vers `/media`.

## Acceptance Criteria

1. **Diffusion** — **Given** `GET /media/thumbnails/<productionId>/<token>/<variante>`, **When** `thumbnails/<productionId>/<token>` est le `thumbnail_key` courant d'une production `status = 'published'` (même `id`), **Then** le flux R2 est diffusé avec `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`, `ETag` (304 sur `If-None-Match`) et, en `HEAD`, les en-têtes sans corps — mêmes mécanismes que les photos d'auteurs (10.2).
2. **Refus** — **Given** une production brouillon ou dépubliée, une ancienne clé (vignette remplacée ou retirée), le jeton d'une production sous l'id d'une autre, une variante inconnue (`w128.webp`, `og.jpg`, `original.png`), un id non UUID, un jeton mal formé, un segment manquant ou surnuméraire, **When** la clé est demandée, **Then** 404 vide `Cache-Control: no-store` (jamais d'exception ni de page HTML) ; clé mal formée → aucune requête base ni R2 ; objet absent de R2 → 404 `no-store` ; panne du stockage → 503 `no-store` (inchangé).
3. **Base serveur** — `MediaService.productionImageUrl({ status, thumbnailKey })` renvoie `/media/<thumbnail_key>` pour une production publiée avec vignette, `null` sinon (jamais la clé d'une production non publiée).
4. **`inertia/lib/media.ts`** — **Given** une base `imageUrl` (`/media/…`), **When** une image 16:9 de la bannière est rendue, **Then** `bannerImage(imageUrl, slot)` renvoie `src` (`w800.webp`), `srcSet` (`…/w400.webp 400w, …/w800.webp 800w, …/w1600.webp 1600w`), les `sizes` de l'emplacement (`full` : bannière à 1 élément ; `half` : 2 éléments ; `lead` : élément 1 d'une bannière à 3 ; `side` : éléments 2–3) et `width`/`height` toujours renseignés en 16:9 ; base hors `/media/` → `null` (comme `authorPhotoImage`).
5. **D37** — **Given** une production publiée **avec** `thumbnail_key`, **When** une carte est sérialisée (`production_card_transformer.ts` : blocs d'accueil, listing, profil) ou la page de détail est rendue, **Then** aucune image ni clé de vignette n'est exposée (forme exacte des cartes inchangée ; ni `thumbnails/` ni `/media/thumbnails` dans le HTML de l'accueil, du listing, du profil et du détail) **and** la page de détail n'a pas d'`og:image` (`twitter:card=summary`).
6. **Photos d'auteurs inchangées** — toute la suite `media.spec.ts` / `media_service.spec.ts` de 10.2 reste verte (`max-age=3600`, refus).

## Tasks / Subtasks

- [x] **T1 — `MediaService` : préfixe `thumbnails/`** (AC 1, 2, 3, 6)
  - [x] 1.1 `THUMBNAIL_CACHE_CONTROL = 'public, max-age=31536000, immutable'` ; table de types des variantes vignette dérivée de `THUMBNAIL_VARIANTS` (source unique).
  - [x] 1.2 `parseThumbnailKey(segments)` : exactement 4 segments `thumbnails` / UUID / jeton base64url 20 / variante vignette → `{ productionId, prefix, key, contentType }` ou `null`.
  - [x] 1.3 `resolve(segments)` : dispatch par premier segment (`authors` → requête auteur inchangée ; `thumbnails` → `productions.id = id AND thumbnail_key = prefix AND status = 'published'`, une requête) ; autre préfixe → `null` sans requête.
  - [x] 1.4 `productionImageUrl({ status, thumbnailKey })`.
  - [x] 1.5 Docblocks de `MediaService` (préfixes servis, cache par préfixe) et `MediaController` mis à jour ; `MediaMiddleware` complété à la revue (préfixes, `nosniff`, segments bruts).
- [x] **T2 — `inertia/lib/media.ts`** (AC 4)
  - [x] 2.1 `THUMBNAIL_WIDTHS = [400, 800, 1600]`, `BannerSlot = 'full' | 'half' | 'lead' | 'side'`, `BANNER_IMAGE_SIZES` (conteneur `max-w-7xl` − `px-6`, `gap-5`, colonnes dès `lg`, DESIGN.md « Layout & Spacing »), `bannerImage(imageUrl, slot)`.
  - [x] 2.2 Le module reste sans import (chargé à l'exécution par les tests).
- [x] **T3 — Tests** (tous les AC)
  - [x] 3.1 `tests/unit/services/media_service.spec.ts` : `parseThumbnailKey` (valide, refus), `resolve` vignettes (publiée, brouillon, dépubliée, ancienne clé, sans vignette, id croisé), `productionImageUrl`.
  - [x] 3.2 `tests/functional/public/media.spec.ts` : groupe vignettes (200 + en-têtes + corps des 3 variantes, 304, HEAD, brouillon / dépubliée / ancienne clé / retirée / variante inconnue / id croisé → 404 `no-store`, objet absent → 404, retrait après un 200 → revalidation 404).
  - [x] 3.3 D37 : `tests/unit/transformers/production_card_transformer.spec.ts` (forme exacte inchangée avec `thumbnailKey`) ; functional accueil / listing / profil / détail sans `thumbnails/` ; `seo.spec.ts` détail avec vignette sans `og:image`, `twitter:card=summary`.
  - [x] 3.4 `tests/unit/lib/media_behavior.spec.ts` (import à l'exécution) : `srcSet`, `src`, `sizes` par emplacement, `width`/`height` 16:9, base invalide → `null`, barre finale retirée ; `authorPhotoImage` inchangé.
  - [x] 3.5 Suite complète `npm run test:local`, `npm run lint`, `npm run typecheck`, build — tous verts.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/services/media_service.ts` (10.2) : `parseAuthorKey`, `resolve` (auteurs seulement, `consent_confirmed_at IS NOT NULL`, cache `AUTHOR_PHOTO_CACHE_CONTROL`), `authorPhotoUrl`. `TOKEN = /^[A-Za-z0-9_-]{20}$/` déjà compatible avec `ThumbnailService` (`string.generateRandom(20)`).
- `app/controllers/public/media_controller.ts` : générique (prend `contentType` / `cacheControl` de `ServedMedia`) — **aucune modification de logique nécessaire** ; métadonnées → `ETag`/304 → `HEAD` → flux, refus 404/503 `no-store`.
- `app/middleware/media_middleware.ts` : segments bruts (non décodés) → la liste blanche refuse tout `%`.
- `app/services/image_service.ts` : `THUMBNAIL_VARIANTS` (w400 400×225, w800 800×450, w1600 1600×900, WebP).
- `app/services/thumbnail_service.ts` (11.1) : préfixe `thumbnails/<productionId>/<token20>` ; `keys(prefix)` pour écrire les variantes dans les tests.
- `app/transformers/production_card_transformer.ts` : n'expose déjà aucune image (D37) ; `serializeDetail` (`public/productions_controller.ts`) liste ses champs explicitement (ni `thumbnailKey` ni `posterKey`). `SeoService.forProduction` sans `ogImage`.
- `inertia/lib/media.ts` (10.2) : `authorPhotoImage`, `MEDIA_PREFIX`, type `ResponsiveImage` ; aucun import.

### Garde-fous

- Le jeton rend l'URL non devinable mais **la base fait foi** : `id` + `thumbnail_key` + `status` dans la même requête.
- `immutable` est cohérent avec les préfixes neufs à chaque téléversement (P2.5, P2-10) ; une production dépubliée est refusée par le serveur dès la requête suivante, mais un navigateur qui a déjà l'image en cache ne la redemande **jamais** (`immutable`, un an) et continue de l'afficher (voir Review Findings, report).
- `Content-Type` déduit de la variante (table fixe), jamais de l'objet R2.
- Ne jamais servir `productions/…` (fichiers sous licence) ni `posters/…` avant 11.3.

### Tests

- `drive.fake('r2')` + `drive.restore('r2')`, `db.beginGlobalTransaction()` (modèle `media.spec.ts`) ; octets factices (le contrôleur ne décode pas l'image).
- `inertia/lib/media.ts` sans import → chargé à l'exécution par URL calculée (modèle `search_query_behavior.spec.ts`).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.2] ; en-tête de l'Epic 11 (règle d'image P2.1).
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.5] « Portée », « Diffusion », « Front », « SEO » ; [#P2.1] `thumbnail_key` ; P2-08, P2-10, P2-17 ; D37.
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] « Layout & Spacing » (bannière 1/2/3, colonnes dès `lg`, `gap-5`, `max-w-7xl`, `px-6`), FeaturedBanner / FeaturedCard ; [EXPERIENCE.md] LCP, `srcset`, dimensions fixées.
- [Source: 10-2-photos-d-auteurs-publiques-et-composant-avatar.md] diffusion `/media` ; [Source: 11-1-vignette-d-une-production-dans-le-panel-admin.md] préfixe, variantes.

## Décisions (D-11.2-n)

- **D-11.2-1** : dispatch par premier segment dans `MediaService.resolve` (une table de résolveurs `authors` / `thumbnails`) : 11.3 ajoute `posters` sans toucher au contrôleur ni au middleware.
- **D-11.2-2** : condition de diffusion = clé courante d'une production `published`, sans exiger qu'elle soit à la une (texte de l'AC et P2.5) : une vignette conservée hors de la une (P2.1) reste servable mais sa clé n'est exposée par aucune prop hors `featured` (11.6).
- **D-11.2-3** : `src` de repli = `w800.webp` ; `width`/`height` = 1600×900 (dimensions intrinsèques de la plus grande variante, ratio 16:9 exact) pour tous les emplacements — le rendu réel est fixé par le CSS (`w-full`, `aspect-video` / `object-cover`).
- **D-11.2-4** : `sizes` calculés sur le conteneur public (`max-w-7xl` = 1280 px, `px-6`, contenu max 1232 px) et `gap-5` (20 px), colonnes dès `lg` (1024 px) : `full` 1232 px ; `half` 606 px / `calc(50vw - 34px)` ; `lead` 815 px / `calc((100vw - 88px) * 2 / 3 + 20px)` ; `side` 398 px / `calc((100vw - 88px) / 3)` ; sous `lg`, toujours `calc(100vw - 48px)` (éléments empilés).
- **D-11.2-5** : base serveur `productionImageUrl` livrée ici (vignette seulement) pour fixer le contrat `imageUrl` ; le repli `poster_key` s'ajoute en 11.3, signature prévue : `productionImageUrl({ status, thumbnailKey, files })` où `files` = fichiers préchargés, repli sur le `poster_key` du premier `video/mp4` par ordre de création (`created_at`, P2.1) → `/media/posters/<fileId>/<token>`.

## Review Findings

- [x] [Review][Patch] Commentaire de `THUMBNAIL_CACHE_CONTROL` inexact [app/services/media_service.ts] — avec `immutable, max-age=31536000` le navigateur ne redemande jamais l'image : commentaire corrigé ; test If-None-Match renommé (il ne vérifie que le refus serveur).
- [x] [Review][Patch] Tests de clés croisées et encodées [tests/functional/public/media.spec.ts] — `other` a sa propre vignette, croisements dans les deux sens avec objets présents ; chemins à 4 segments encodés (`w400%2Ewebp`, `%32` dans le jeton, `thumbnails%2F`, `/%6Dedia/`) ; 503 vignette ; test unitaire « aucune requête base » (espion `Production.query` / `Author.query`).
- [x] [Review][Patch] Segments bruts non garantis [app/middleware/media_middleware.ts] — **constaté** : `request.url()` passe par `decodeURI`, donc `…/w400%2Ewebp` était servi (200, même ressource, aucune fuite) ; les segments viennent maintenant de l'URL Node brute ; chemin dont la forme brute ne commence pas par `/media/` → 404.
- [x] [Review][Patch] `X-Content-Type-Options: nosniff` absent de `/media` (le middleware passe avant shield) [app/controllers/public/media_controller.ts] — posé en tête de `show` : 200, 304, HEAD, 404, 503 (photos et vignettes), testé.
- [x] [Review][Patch] Test « ratios extrêmes » instable sous charge [tests/unit/services/image_service.spec.ts] — budgets portés à 15 s et `.timeout(30_000)` sur les 3 tests de formats extrêmes (délai unitaire par défaut 2 s).
- [x] [Review][Patch] Story : T1.5 corrigée, suggestions reportées à l'Epic 12, signature future de `productionImageUrl` (D-11.2-5).
- [ ] [Review][Defer] Image d'une production dépubliée encore visible depuis le cache navigateur (jusqu'à un an) pour qui l'a chargée — information PO, accepté selon l'architecture (P2-10) ; évolution possible : `max-age` plus court sans `immutable`.
- [ ] [Review][Defer] 11.6 : les `sizes` et `width`/`height` de l'emplacement `lead` ignorent l'image étirée (DESIGN.md:338, home.html:54 `lg:aspect-auto lg:flex-1`) → à recalculer avec le composant `FeaturedBanner`.

## Questions ouvertes (non bloquantes, défauts retenus)

1. Une production dépubliée puis republiée réutilise la même clé : aucun problème ; mais une image déjà mise en cache reste visible jusqu'à un an chez un visiteur qui l'avait chargée même après dépublication (inhérent à `immutable`, P2.5).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites avant le code ; `media_behavior.spec.ts` → 4 échecs (`bannerImage is not a function`), `parseThumbnailKey` / `productionImageUrl` absents. Après implémentation : 66 tests ciblés verts (media_service 16, media_behavior 5, media lib 3, transformer 4, functional media 23, seo 14 — dont les existants).
- Typecheck : `ProductionStatus` (défaut = valeur seulement) → import nommé du type (`type ProductionStatus as ProductionStatusValue`).
- Suite complète `npm run test:local` : **1112 tests verts** (baseline 1090, +22), code de sortie 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0.
- Un premier passage complet a échoué sur un seul test hors story (`image_service.spec.ts` « ratios extrêmes », 11.1 : délai Japa dépassé sous charge) ; vert seul (9 s pour le fichier) et au second passage complet → consigné dans deferred-work.md.
- Après revue : **1116 tests verts** (+4), lint 0, typecheck 0, build 0. Constat empirique avant correctif : `…/w400%2Ewebp` → 200 (`request.url()` décodé par `decodeURI`).
- Aucune migration, aucune route, `.adonisjs` inchangé ; rien contre Supabase ni R2 (`drive.fake('r2')`).

### Completion Notes List

- `MediaService` : `THUMBNAIL_CACHE_CONTROL` (`public, max-age=31536000, immutable`), `parseThumbnailKey` (types dérivés de `THUMBNAIL_VARIANTS`), `resolve` dispatché par préfixe (`authors` inchangé, `thumbnails` : `id` + `thumbnail_key` courant + `status = 'published'` en une requête ; autre préfixe → `null` sans requête), `productionImageUrl` (non exposée par une prop avant 11.6). `MediaController` / `MediaMiddleware` sans changement de logique (docblock du contrôleur mis à jour).
- `inertia/lib/media.ts` : `THUMBNAIL_WIDTHS`, `BannerSlot`, `BANNER_IMAGE_SIZES`, `bannerImage(imageUrl, slot)` (src w800, srcSet 400/800/1600, 1600×900) ; module toujours sans import.
- D37 vérifié par tests : forme exacte de la carte inchangée avec vignette ; accueil, listing, profil et détail sans `thumbnails/` / `thumbnailKey` / `imageUrl` ; détail sans `og:image`, `twitter:card=summary`. Aucun code de carte ni de SEO modifié (déjà conforme).
- Décisions D-11.2-1 à D-11.2-5 ci-dessus.

### File List

- app/services/media_service.ts
- app/controllers/public/media_controller.ts (docblock ; `nosniff` à la revue)
- app/middleware/media_middleware.ts (revue : segments bruts, docblock)
- tests/unit/services/image_service.spec.ts (revue : délais)
- inertia/lib/media.ts
- tests/unit/services/media_service.spec.ts
- tests/unit/lib/media_behavior.spec.ts (nouveau)
- tests/unit/transformers/production_card_transformer.spec.ts
- tests/functional/public/media.spec.ts
- tests/functional/public/seo.spec.ts
- _bmad-output/implementation-artifacts/11-2-diffusion-publique-des-images-de-la-banniere.md (nouveau)
- _bmad-output/implementation-artifacts/deferred-work.md

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (diffusion `/media/thumbnails/…` des productions publiées avec cache d'un an `immutable`, base `productionImageUrl`, `bannerImage` + `sizes` par emplacement, tests D37) ; 1112 tests verts ; statut review.
- 2026-11-21 : revue de code — 6 correctifs (commentaire du cache `immutable` + test renommé, tests croisés/encodés/503/sans requête, segments bruts réels dans `MediaMiddleware`, `nosniff` sur `/media`, délais des tests de ratios extrêmes, story), 2 reports (cache navigateur après dépublication, `sizes` de `lead` en 11.6) ; 1116 tests verts ; statut done.
