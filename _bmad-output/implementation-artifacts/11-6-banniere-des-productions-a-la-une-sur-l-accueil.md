---
baseline_commit: 4836acc
---

# Story 11.6 : Bannière des productions à la une sur l'accueil

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **voir en tête de l'accueil les productions mises à la une**,
afin de **découvrir les productions que l'association met en avant** (FR48, FR49, FR59, D9, D35, parcours 5).

## Décision de périmètre (lire en premier)

- Story **sans migration**, **sans dépendance npm**, sans composant shadcn ajouté.
- **DANS 11.6** :
  - prop `featured` de `home` (`HomeController.index`) : productions à la une **publiées** pourvues d'une image affichable, dans l'ordre des positions, lues à chaque requête (aucun cache, P2.3) ; forme publique stricte FR49 (`FeaturedService.banner()`) ;
  - branchement public de la bannière partagée de 11.4 (`inertia/components/shared/FeaturedBanner.tsx`, D-11.4-9) par un point d'entrée public `inertia/components/public/FeaturedBanner.tsx` : région nommée par un `<h2>` masqué, `AuthorByline` (liens distincts, FR59), `srcSet` / `sizes` par `bannerImage` (`inertia/lib/media.ts`), lien de titre vers le détail ;
  - ajustements du rendu partagé exigés par le public : image étirée de l'emplacement `lead` sans influence sur la hauteur de la grille, `sizes` de `lead` recalculés (report de la revue 11.2), lien Inertia, contour de focus sur toute la carte (DESIGN.md:360) ;
  - i18n public fr/en `featured.*` ;
  - placement sous le hero de `home.tsx` ; les sections actuelles (« Les plus consultées », « Récemment publiées », puces de catégories) **restent en place** jusqu'à l'Epic 12.
- **HORS 11.6 (ne PAS implémenter)** :
  - refonte de l'accueil (blocs 365 j, « Les plus téléchargées », « Auteurs les plus consultés », suppression des puces `categories`, `RankingService`) → **Epic 12** ;
  - suite de tests transverse « vignettes et une » → **11.7** (ici : tests de la story seulement) ;
  - toute `og:image` de production (D37, P2-17) : `SeoService.site` inchangé ;
  - blocage de la suppression de la vidéo d'une production à la une sans vignette (D-11.5-6, question PO maintenue) : ici seulement la tolérance côté bannière (D-11.6-2).

## Acceptance Criteria

1. **Prop `featured`** — **Given** `GET /`, **When** l'accueil est rendu, **Then** la prop `featured` contient les productions à la une **publiées**, dans l'ordre des positions, lues à chaque requête (non cachée) : une sélection enregistrée par `PUT /admin/featured` est visible à la requête suivante **and** chaque élément a exactement la forme `{ id, slug, title, authors: { name, slug | null }[], imageUrl, viewsCount, downloadsCount }` (FR49) : `imageUrl` = base publique `/media/thumbnails/<id>/<token>` (vignette) sinon `/media/posters/<fileId>/<token>` (image extraite du premier MP4 pourvu d'un poster, D-11.3-2), par `MediaService.productionImageUrl` ; totaux = toutes les vues / tous les téléchargements ; auteurs = byline publique (`PublicBylineService`, profils visibles seulement liés).
2. **Exclusions** — **Given** une ligne de `featured_productions` dont la production est un brouillon ou dépubliée, ou une production publiée sans image affichable (vidéo et poster supprimés, D-11.5-6), **When** l'accueil est rendu, **Then** elle est absente de `featured` et la disposition est calculée sur les éléments restants (D-11.6-2) ; sans production à la une, `featured` = `[]`.
3. **Région et disposition (FR48, D35)** — **Given** au moins un élément, **When** `FeaturedBanner` se rend sous le hero, **Then** c'est une `<section aria-labelledby>` nommée « Productions à la une » par un `<h2 class="sr-only">` (ordre des titres h1 → h2 → h3, cartes en `h3`), sans titre visible (*amendé à la revue*) ; à partir de `lg` : 1 = pleine largeur, 2 = deux colonnes égales, 3 = la 1re sur 2/3 (image étirée), les deux suivantes empilées dans le tiers restant, même hauteur totale ; en dessous de `lg`, empilées dans l'ordre ; pas de carrousel ni de rotation **and** sans élément, aucune bannière ni espace réservé.
4. **Carte (FR49, D9)** — **Given** une carte, **When** elle s'affiche, **Then** elle montre uniquement l'image, le titre, les auteurs et les totaux, texte sous l'image sur carte blanche **and** le titre est l'unique lien principal (stretched link vers `/productions/:slug`), les auteurs sont rendus par `AuthorByline` (3 puis « et {n} autres », liens au-dessus du lien étiré, jamais imbriqués), ordre de tabulation titre puis auteurs **and** l'image 16:9 `object-cover` a `alt=""` **and** compteurs avec libellés complets pour lecteurs d'écran (« Vues : », « Téléchargements : ») et icônes `aria-hidden` **and** focus clavier du titre → contour 2 px `ring` sur toute la carte.
5. **Images (LCP, P2.5)** — **Given** les images, **When** elles se rendent, **Then** `src` / `srcSet` (`w400`, `w800`, `w1600`) / `sizes` viennent de `bannerImage(imageUrl, slot)` avec l'emplacement de la carte (`full`, `half`, `lead`, `side`) ; `width` / `height` renseignés ; la 1re image en `loading="eager"` + `fetchpriority="high"`, les autres `lazy` ; une image en erreur laisse une zone `muted` vide, texte intact **and** les `sizes` de `lead` tiennent compte de l'image étirée (`object-cover` sur une zone plus haute que 16:9, D-11.6-3).
6. **SEO (D37)** — **Given** l'accueil avec des productions à la une, **When** son `<head>` est lu, **Then** aucune `og:image` (ni `twitter:image`) n'est émise.
7. **Existant** — **Given** l'accueil, **When** il est rendu, **Then** `mostViewed`, `recent`, `categories`, `meta` et leurs sections restent inchangés ; l'aperçu admin (`BannerPreview`) garde son rendu (sans lien, non interactif).
8. **i18n** — **Given** `inertia/locales/public/{fr,en}.json`, **When** ils sont lus, **Then** `featured.region` (« Productions à la une » / « Featured productions », EXPERIENCE.md:70), `featured.by`, `featured.views`, `featured.downloads` existent avec parité fr/en.

## Tasks / Subtasks

- [x] **T1 — Serveur** (AC 1, 2, 6, 7)
  - [x] 1.1 `FeaturedService.bannerRows()` : jointure `featured_productions` → productions publiées, ordre des positions, agrégats vues / téléchargements, fichiers MP4 à poster préchargés, `imageUrl` par `MediaService.productionImageUrl`, éléments sans image écartés ; `bannerItems(rows)` → `FeaturedBannerItem` (bylines attachées par l'appelant, revue).
  - [x] 1.2 `HomeController.index` : prop `featured` ; un seul `PublicBylineService.attach` pour les blocs et la bannière (revue).
- [x] **T2 — Front** (AC 3–5, 7, 8)
  - [x] 2.1 `inertia/lib/media.ts` : `bannerSlot(index, count)` (pur), `sizes` de `lead` recalculés.
  - [x] 2.2 `inertia/components/shared/FeaturedBanner.tsx` : `FeaturedCard` extrait, image étirée en position absolue à partir de `lg`, `width` / `height` par carte, lien `Link`, contour de focus de carte, `renderAuthors`.
  - [x] 2.3 `inertia/components/public/FeaturedBanner.tsx` (point d'entrée public) et `inertia/pages/home.tsx` (prop `featured`, sous le hero).
  - [x] 2.4 i18n public fr/en `featured.*` (aucun codegen Tuyau nécessaire : les props de `home` sont déduites du composant par `ExtractProps`).
- [x] **T3 — Tests** (tous les AC)
  - [x] 3.1 Functional `tests/functional/public/home.spec.ts` : vide, ordre, forme exacte, poster en repli, brouillon / dépubliée / sans image exclus, totaux et byline, mise à jour immédiate après `PUT /admin/featured`, aucune `og:image`, sections existantes intactes.
  - [x] 3.2 Unit `tests/unit/lib/media_behavior.spec.ts` (`bannerSlot`, `sizes` de `lead`) ; composants par lecture de source (`tests/unit/components/home_featured_banner.spec.ts` ; `featured_page.spec.ts` inchangé, toujours vert) ; parité i18n.
  - [x] 3.3 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/controllers/public/home_controller.ts` : `mostViewed` / `recent` (6 éléments, agrégats `withAggregate`), `PublicBylineService.attach`, `categories`, `meta: SeoService.site(locale)` (aucune image).
- `inertia/pages/home.tsx` : hero (h1, `SearchBar`, `FilterBar`) puis deux `Section` (`mt-12`, h2).
- `inertia/components/shared/FeaturedBanner.tsx` (11.4, D-11.4-9) : rendu partagé (grille D35, carte FR49, `fetchPriority`, `failed` → zone vide, `href` → lien étiré `<a>`, `renderAuthors`, `ariaLabel`), sans i18n ; utilisé par `BannerPreview` sans `href`.
- `inertia/lib/media.ts` (11.2) : `bannerImage(imageUrl, slot)`, `BANNER_IMAGE_SIZES` ; report « `sizes` de `lead` » (deferred-work.md:156).
- `inertia/lib/featured.ts` : `bannerLayout(count)` (`none` / `single` / `columns` / `lead`).
- `app/services/media_service.ts` : `productionImageUrl({ status, thumbnailKey, files })` (vignette, sinon poster `PosterService.displayed`).
- `app/services/public_byline_service.ts` : `attach(productions)` → `$extras.byline`, `of(production)`.
- `inertia/components/public/AuthorByline.tsx` : rendu inline seulement ; l'appelant possède le « Par … » hors de tout lien.

### Garde-fous

- Aucune URL signée ni clé brute dans la prop publique : seules des bases `/media/…` (P2-10), et uniquement pour des productions publiées (`productionImageUrl` renvoie `null` sinon).
- Bannière non cachée (P2.3, parcours 5) : aucune mémorisation.
- Pas d'`og:image` de production (D37) ; cartes des sections existantes toujours sans image.
- Composants `inertia/` testés par lecture de source ; logique pure (`bannerSlot`) dans `inertia/lib/media.ts` (sans import) testée à l'exécution.
- Le rendu partagé reste sans clé i18n (instances admin / public distinctes) ; l'aperçu admin ne doit gagner ni lien ni focus.
- Dépôt public : données fictives dans les tests.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.6] ; en-tête Epic 11 (règle d'image P2.1).
- [Source: architecture.md#P2.5 « Front »] (srcset, `width`/`height`, `eager` + `fetchpriority`), P2.3 (cache : la une non cachée), P2.6 (`home` : prop `featured`), P2-10, P2-17 (D37).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md:176–185, 317, 330, 338, 360, 391–392] ; [EXPERIENCE.md:32, 70, 104–108, 137, 141–142, 168, 176, 188–190] ; maquette `mockups/home.html:51–86`.
- [Source: 11-2-…md] D-11.2-3, D-11.2-4, `[Review][Defer]` `sizes` de `lead` ; [11-3-…md] D-11.3-2 ; [11-4-…md] D-11.4-9, D-11.4-15, question 2 ; [11-5-…md] D-11.5-6.

## Décisions (D-11.6-n)

- **D-11.6-1** : point d'entrée public `inertia/components/public/FeaturedBanner.tsx` (nom de l'architecture) qui ne fait que brancher le rendu partagé `shared/FeaturedBanner` (i18n, `AuthorByline`, `bannerImage`, `href`) ; `FeaturedCard` est le composant de carte du fichier partagé, pas un second rendu : la bannière publique et l'aperçu admin ne peuvent pas diverger.
- **D-11.6-2** : une production à la une **sans image affichable** (vidéo supprimée, D-11.5-6) est **écartée** de la prop `featured` (disposition recalculée), plutôt que montrée avec une zone vide : c'est ce que montre déjà l'aperçu admin (seuls les emplacements valides, badge « Vignette manquante » au lieu de « Affichée »), et FR49 fait de l'image le premier élément de la carte. La zone `muted` vide reste réservée à l'image en erreur de chargement (EXPERIENCE.md:142). Question PO (reprise de 11.4 / 11.5).
- **D-11.6-3** : image étirée de `lead` (3 éléments, à partir de `lg`) en **position absolue** dans sa zone (`lg:relative` / `lg:absolute lg:inset-0`) : elle ne participe plus à la hauteur intrinsèque de la carte, la hauteur des deux lignes est fixée par les cartes empilées (DESIGN.md:338). `sizes` de `lead` = largeur rendue par `object-cover` (image recadrée en hauteur, donc plus large que la zone) : mesurée au navigateur (Chromium headless, 1024 / 1440 px) à 966 / 1137 px pour des colonnes de 642 / 813 px, soit 2 colonnes latérales + 345 px ; un titre de `lead` sur une ligne ajoute 55 px → retenu **`(min-width: 1280px) 1195px, (min-width: 1024px) calc((100vw - 88px) * 2 / 3 + 400px)`** (couvre les cas mesurés ; au-delà de 800 px le navigateur choisit toujours `w1600` ; à 1024 px il charge désormais `w1600` au lieu de `w800`, revue). `width` / `height` restent 1600×900 (rapport intrinsèque ; la taille rendue vient du CSS).
- **D-11.6-4** : forme publique `FeaturedBannerItem` = `{ id, slug, title, authors, imageUrl, viewsCount, downloadsCount }` : ni catégorie, ni résumé, ni date (FR49) ; `authors` = byline publique (`AuthorCredit`), pas la forme admin.
- **D-11.6-5** : lien de titre par `Link` d'Inertia (navigation client comme `ProductionCard`), contour de focus porté par la carte (`has-[[data-featured-link]:focus-visible]`), celui du lien supprimé seulement sous `@supports selector(:has(*))` (`app.css`, revue) ; les liens d'auteurs gardent leur propre contour.
- **D-11.6-6** : auteurs de la bannière tronqués comme les cartes (3 puis « et {n} autres », D36, EXPERIENCE.md:108).
- **D-11.6-7** : bannière à `mt-8` sous le hero (maquette `home.html:51`), avant les sections existantes (`mt-12`) ; aucun titre visible.

## Review Findings

- [x] [Review][Patch] Ordre des titres h1 → h3 → h2 sur l'accueil [inertia/components/shared/FeaturedBanner.tsx, public/FeaturedBanner.tsx] — `<h2 class="sr-only">` (`featured.region`) référencé par `aria-labelledby` (prop `heading`, `useId`), cartes en `h3` ; l'aperçu admin reste sous son `h2` « Aperçu de la bannière ».
- [x] [Review][Patch] `PublicBylineService.attach` appelé deux fois par visite [app/services/featured_service.ts, home_controller.ts] — `bannerRows()` + `bannerItems(rows)`, un seul `attach` pour blocs et bannière ; docstring corrigée (deux requêtes, bylines à part).
- [x] [Review][Patch] Byline de la bannière non testée avec des fiches [tests/functional/public/home.spec.ts] — auteur consentant visible (slug, lié) + non consentant (slug null, « Prénom NOM », D34), identique à la carte des blocs.
- [x] [Review][Patch] Contour de focus perdu sans `:has()` [inertia/css/app.css, FeaturedBanner.tsx] — `focus-visible:outline-none` retiré du lien ; contour supprimé seulement sous `@supports selector(:has(*))` ; test de source.
- [x] [Review][Patch] Échelle de `BannerPreview` [inertia/components/admin/BannerPreview.tsx] — largeur publique 1232 px (`max-w-7xl` − `px-6`), et non 1152 (D-11.4-9 citait 1152) ; test de source.
- [x] [Review][Patch] Documentation [story, inertia/lib/media.ts] — T2.4 (pas de codegen) et T3.2 (`featured_page.spec.ts` inchangé) reformulées ; « jamais sous-estimé » adouci (cas mesurés couverts, > 800 px → `w1600`).
- [ ] [Review][PO] Production à la une sans image affichable : écartée de la bannière (D-11.6-2, cohérent avec l'aperçu admin) plutôt que montrée avec une zone vide — à confirmer, avec la question de 11.4 / 11.5 (bloquer la suppression de la vidéo ?).
- [ ] [Review][PO] Annonce des compteurs « Vues : 1 214 » (maquette) plutôt que la forme pluralisée des cartes (« 1 214 vues ») — conservée telle que la maquette.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : 8 tests fonctionnels de `home.spec.ts` écrits avant le code ; contrôleur d'origine → 7 échecs (prop `featured` absente ; le test `og:image` passe déjà, D37 inchangé).
- Rendu vérifié en local (base Postgres jetable `anta_preview` sur le port 5433, supprimée ensuite ; `node ace serve` sans Doppler ; `/media/**` intercepté par Playwright avec des SVG générés, aucun appel R2) à 375 / 1024 / 1440 px : à 1024 px la carte `lead` mesure 704 px = 2 × 342 + 20 (même hauteur totale que les deux empilées), à 1440 px 800 = 2 × 390 + 20 ; 2 éléments → deux colonnes égales ; image en erreur → zone `muted` vide ; focus clavier du titre → contour 2 px sur la carte. Captures : `work/11-6/` du topic (hors dépôt).
- Lint : `@unicorn/no-await-expression-member` sur `(await client.get('/')).text()` → helpers `homeHtml` / `homeProps`.
- Suite complète `npm run test:local` : **1271 tests verts** (baseline 1253, +18), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Rien contre Supabase ni R2.
- Revue (6 correctifs) : **1274 tests verts** (+3), `npm run test:local` code 0, lint 0, typecheck 0, build 0 (échecs Resend 401 journalisés seulement, préexistants).

### Completion Notes List

- `FeaturedService.bannerRows()` : deux requêtes (jointure `featured_productions` avec agrégats en sous-requêtes, puis fichiers MP4 à poster), `imageUrl` par `MediaService.productionImageUrl` ; productions sans image écartées (D-11.6-2) ; `bannerItems(rows)` → `FeaturedBannerItem` strict FR49, bylines attachées une seule fois par le contrôleur pour toute la page (revue).
- `HomeController.index` : prop `featured` lue à chaque requête (aucun cache) ; `mostViewed`, `recent`, `categories`, `meta` inchangés (pas d'`og:image`).
- Rendu partagé : `FeaturedCard` extrait (état d'erreur d'image par carte), image étirée de `lead` en position absolue dès `lg` (D-11.6-3), lien de titre `Link` d'Inertia avec `data-featured-link`, contour de focus sur la carte (D-11.6-5, repli : contour du lien conservé sans `:has()`, `app.css`), `<h2>` masqué nommant la région (`heading`) ; l'aperçu admin (sans `href`) est inchangé.
- Point d'entrée public `components/public/FeaturedBanner.tsx` : `<section aria-labelledby>` + `<h2 class="sr-only">` (`featured.region`), `AuthorByline` (3 puis « et {n} autres »), `bannerImage(imageUrl, bannerSlot(index, count))`, `urlFor('production.show')`, `mt-8` sous le hero ; rien sans élément.
- `inertia/lib/media.ts` : `bannerSlot(index, count)` (pur), `sizes` de `lead` recalculés.
- i18n public fr/en `featured.region` / `by` / `views` / `downloads`.
- `deferred-work.md` et 11.2 : report « `sizes` de `lead` » marqué résolu ; note D-11.6-2 sur la suppression de la vidéo.

### File List

- app/services/featured_service.ts
- app/controllers/public/home_controller.ts
- inertia/components/shared/FeaturedBanner.tsx
- inertia/components/public/FeaturedBanner.tsx (nouveau)
- inertia/components/admin/BannerPreview.tsx (revue)
- inertia/css/app.css (revue)
- inertia/pages/home.tsx
- inertia/lib/media.ts
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/functional/public/home.spec.ts
- tests/unit/lib/media_behavior.spec.ts
- tests/unit/components/home_featured_banner.spec.ts (nouveau)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/11-2-diffusion-publique-des-images-de-la-banniere.md (report coché)
- _bmad-output/implementation-artifacts/11-6-banniere-des-productions-a-la-une-sur-l-accueil.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

Voir les entrées `[Review][PO]` de la section « Review Findings ».

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (prop `featured` via `FeaturedService.banner()`, branchement public de la bannière partagée, image étirée en position absolue et `sizes` de `lead` mesurés, focus de carte, i18n `featured.*`) ; rendu vérifié en local à 375 / 1024 / 1440 px ; 1271 tests verts ; statut review.
- 2026-11-21 : revue de code — 6 correctifs (`<h2>` masqué de la région, un seul passage de bylines, test de byline avec fiches, repli du focus sans `:has()`, échelle de `BannerPreview` 1232 px, documentation), 2 questions PO (`[Review][PO]`) ; 1274 tests verts ; statut done.
