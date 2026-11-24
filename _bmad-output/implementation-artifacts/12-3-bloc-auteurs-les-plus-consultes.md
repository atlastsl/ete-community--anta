---
baseline_commit: d5cff59
---

# Story 12.3 : Bloc « Auteurs les plus consultés »

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **voir sur l'accueil les auteurs les plus consultés des 12 derniers mois**,
afin d'**accéder à leur profil en deux clics** (FR45, FR46, FR53, D3, D5, D36).

## Décision de périmètre (lire en premier)

- Story **sans migration** (index `idx_stats_views_production_id_recorded_at` de la Story 10.5 ; clé primaire du pivot `(production_id, author_id)`), **sans dépendance npm**, sans nouvelle route, sans composant shadcn ajouté.
- **DANS 12.3** :
  - classement `topAuthors` : requête dans `PublicAuthorService` (portée `Author.visibleOnSite` + même agrégat de vues que `/authors`), mis en cache par `RankingService.topAuthorIds()` sous la clé `topAuthors` (même `RankingCache`, même TTL, même invalidation que 12.2) ;
  - hydratation des cartes `PublicAuthorService.cardsByIds(ids)` (mêmes champs et même **total** de vues que la liste `/authors`) ;
  - `home_controller.ts` : prop `topAuthors` (3 éléments au plus) ;
  - 4e `HomeBlock` « Auteurs les plus consultés » d'`AuthorCard`, « Voir plus » → `/authors` ;
  - `AuthorCard` : niveau de titre paramétrable (`h3` sous le `h2` du bloc, maquette `home.html`) ;
  - i18n public `home.blocks.authors` (FR/EN).
- **HORS 12.3 (ne PAS implémenter)** : suggestions → 12.4 ; seeder démo étalé sur 540 j, `EXPLAIN ANALYZE`, suite transverse de l'invalidation (HTTP du consentement et des fiches auteur au complet) → 12.5 ; tris de `/authors` (10.5, inchangés) ; invalidation du cache web par les commandes Ace ([Defer][PO] de 12.2, toujours ouvert).

## Acceptance Criteria

1. **Classement (P2.3, D5, D36)** — **Given** `RankingService.topAuthorIds()`, **When** il est calculé, **Then** il retient les auteurs à profil public (`Author.visibleOnSite` : consentement confirmé **et** ≥ 1 production publiée liée) dont les vues des 365 derniers jours (`stats_views.recorded_at >= now() - interval '365 days'`) sur leurs productions **publiées** (pivot `production_authors`) sont > 0 ; ordre : vues sur la fenêtre ↓, puis date de leur dernière production publiée sur Anta (`max(anta_published_at)` de **toutes** leurs productions publiées) ↓ `NULLS LAST`, puis `last_names`, `first_names`, `id` ↑ ; 3 éléments.
2. **Pas de double comptage** — une vue compte une fois par auteur (clé primaire du pivot `(production_id, author_id)`) ; une vue d'une production co-signée compte pour chacun de ses auteurs ; vues d'une production brouillon ou dépubliée ignorées.
3. **Cache (P2-06)** — identifiants ordonnés mémorisés sous la clé `topAuthors` du `RankingCache` (TTL 10 min), invalidés par les mêmes mutations que 12.2 (publication, dépublication, suppression, `sync`, consentement confirmé / retiré, modification / suppression de fiche, `authors:apply`).
4. **Props** — `home_controller.ts` rend `topAuthors` (cartes `AuthorCardData` : `slug`, `firstNames`, `lastNames`, `photoBase`, `primaryInstitution`, `productionsCount`, `viewsCount`) dans l'ordre du classement ; `viewsCount` = **total** des vues des productions publiées, calculé comme sur `/authors` (D3, FR46).
5. **Bloc** — 4e `HomeBlock` après « Les plus téléchargées » : titre `h2` « Auteurs les plus consultés », sous-titre « sur les 12 derniers mois » (`windowed`), `AuthorCard` (titre de carte en `h3`), grille 3 colonnes dès `md` ; « Voir plus » (nom accessible « Voir plus : Auteurs les plus consultés ») → `/authors` (tri par défaut, FR45) ; 0 élément → bloc absent.
6. **Retrait du consentement (FR53)** — **Given** un administrateur qui retire le consentement d'un auteur présent dans le bloc, **When** l'accueil est rechargé, **Then** l'auteur n'y figure plus (cache invalidé) ; l'hydratation ré-applique `visibleOnSite` (aucun profil non public même si un identifiant périmé restait en cache).

## Tasks / Subtasks

- [x] **T1 — Requêtes `PublicAuthorService`** (AC 1, 2, 4)
  - [x] 1.1 Extraire l'agrégat de vues (LATERAL `total_views` / `window_views`) et la requête de carte (`published_count`, `primary_institution`) de `list()` dans des helpers privés partagés.
  - [x] 1.2 `topViewedAuthorIds(limit)` : `visibleOnSite` + LATERAL, `window_views > 0`, `last_published_at`, ordre D36.
  - [x] 1.3 `cardsByIds(ids)` : cartes dans l'ordre des ids, re-filtrées `visibleOnSite` ; `listCard` inclut désormais `photoBase` (`MediaService.authorPhotoUrl`), utilisé tel quel par `/authors` et l'accueil.
- [x] **T2 — `RankingService.topAuthorIds()`** (AC 3) — clé `topAuthors`, import paresseux de `PublicAuthorService` (cycle `Production` → `ProductionService` → `RankingService`).
- [x] **T3 — Accueil serveur** (AC 4) — prop `topAuthors`.
- [x] **T4 — Front** (AC 5)
  - [x] 4.1 `AuthorCard` : prop `headingLevel` (`'h2'` par défaut, `/authors` inchangé).
  - [x] 4.2 `home.tsx` : 4e `HomeBlock` (`windowed`, `seeMoreHref="/authors"`, `AuthorCard headingLevel="h3"`).
  - [x] 4.3 i18n fr/en `home.blocks.authors`.
- [x] **T5 — Tests** (tous les AC)
  - [x] 5.1 Functional `home.spec.ts` : profil non public exclu (sans consentement ; consentement sans production publiée), 0 vue sur 365 j exclu, vues d'un brouillon ignorées, départage par dernière publication puis nom / prénom, total affiché ≠ compte 365 j et égal à `/authors`, co-signature sans double comptage, 3 éléments, retrait du consentement par `POST /admin/authors/:id/withdraw-consent` → absent immédiatement, identifiant périmé non public ignoré, cache `topAuthors`.
  - [x] 5.2 Unit `ranking_invalidation.spec.ts` : `topAuthors` vidé par le retrait du consentement.
  - [x] 5.3 Composants par lecture de source : 4e bloc (ordre, lien, `windowed`), `AuthorCard` `headingLevel`, i18n.
  - [x] 5.4 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/services/ranking_service.ts` (12.2) : `RankingCache` (clés `RankingKey`, génération, calcul en vol partagé), `mostViewedIds()`, `mostDownloadedIds()`, `invalidate()`, `invalidateAfterCommit()`, `cachedKeys()`. N'importe ni modèle ni service (importé par `ProductionService`, lui-même importé par le modèle `Production`).
- `app/services/public_author_service.ts` (10.5) : `list(filters, sort, page)` — `visibleOnSite` + `LEFT JOIN LATERAL` (`total_views`, `window_views` sur `WINDOW`), `published_count`, `primary_institution` ; `listCard(author)` ; importe `AuthorService` (→ `RankingService`).
- `app/controllers/public/home_controller.ts` (12.2) : `recent`, `mostViewed`, `mostDownloaded`, `featured`, `meta`.
- `app/controllers/public/authors_controller.ts` : `listCard` + `photoBase: MediaService.authorPhotoUrl(author)`.
- `inertia/components/public/AuthorCard.tsx` (10.5) : nom en `h2` (page `/authors` : `h1` puis cartes).
- `inertia/components/public/HomeBlock.tsx` (12.2) : générique, `null` si vide.
- `inertia/pages/home.tsx` : trois `HomeBlock`.

### Garde-fous

- Visibilité publique = **une seule source** (`Author.visibleOnSite`) : ni la requête de classement ni l'hydratation ne réécrivent la règle du consentement.
- Total de la carte = même expression que `/authors` (helper partagé) → les deux pages affichent le même nombre.
- Cache partagé par le processus : vidé avant chaque test HTTP (`tests/bootstrap.ts`, D-12.2-8) ; tests sans horloge réelle.
- Composants `inertia/` testés par lecture de source (TS6305).
- Dépôt public : noms fictifs.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.3] ; en-tête Epic 12 (ordre FR9).
- [Source: architecture.md#P2.3] (requête auteurs, départage D36, cache, invalidation), P2-06.
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:34, 106, 109, 205] ; [DESIGN.md:362] ; maquette `mockups/home.html:186–220` (cartes en `h3`).
- [Source: 12-2-…md] (D-12.2-1 à 9, `[Review][Defer][PO]` Ace) ; [10-5-…md] (`AuthorCard`, tri par défaut `views`) ; modèle `Author.visibleOnSite` (10.3/10.4).

## Décisions (D-12.3-n)

- **D-12.3-1** : la requête de classement vit dans `PublicAuthorService.topViewedAuthorIds()` (Lucid, portée `visibleOnSite`, même LATERAL que `list()`), et non en SQL brut dans `RankingService` : la règle de visibilité et l'agrégat de vues restent uniques. `RankingService.topAuthorIds()` la met en cache (clé `topAuthors`) et charge `PublicAuthorService` **paresseusement** (`await import`) : un import statique créerait le cycle `RankingService` → `PublicAuthorService` → `AuthorService` → `RankingService` (et `Author` → `Production` → `ProductionService` → `RankingService`).
- **D-12.3-2** : pas de double comptage : le LATERAL part des vues et joint le pivot sur `pa.author_id = authors.id` ; la clé primaire `(production_id, author_id)` garantit une ligne de pivot par couple, donc chaque vue compte une fois par auteur. La jointure de `visibleOnSite` est un `EXISTS` (`whereHas`) : elle ne multiplie pas les lignes.
- **D-12.3-3** : « dernière production publiée » = `max(anta_published_at)` sur **toutes** les productions publiées de l'auteur (vues ou non, P2.3), sous-requête corrélée ; `NULLS LAST` (une publiée sans date ne passe pas devant).
- **D-12.3-4** : `cardsByIds(ids)` ré-applique `visibleOnSite` : un identifiant resté en cache (processus Ace, autre réplica, course avant commit) ne rend jamais un profil non public ; le bloc peut alors compter moins de 3 cartes jusqu'à l'invalidation ou au TTL (comme D-12.2-1). FR53 ne dépend donc pas du seul cache.
- **D-12.3-5** : `AuthorCard` reçoit `headingLevel?: 'h2' | 'h3'` (défaut `h2`, `/authors` inchangé) ; l'accueil passe `h3` (maquette, hiérarchie sous le `h2` du bloc, comme `ProductionCard`).
- **D-12.3-6** : « Voir plus » → `/authors` littéral (tri par défaut `views` omis de l'URL, comme `authorsListPath`).
- **D-12.3-7** : aucun nouveau point d'invalidation : les mutations de 12.2 couvrent tout ce qui change le classement ou la visibilité ; renommage / photo / affiliations n'en changent que l'affichage, hydraté à chaque rendu (`AuthorService.update` invalide quand même, D-12.2-6). L'enregistrement d'une vue n'invalide pas (D-12.2-5).
- **D-12.3-8** : i18n `home.blocks.authors` (FR « Auteurs les plus consultés », EN « Most viewed authors ») ; les libellés de carte restent `authors.list.card.*`.

## Review Findings

- [x] [Review][Patch] Le test FR53 (« retrait du consentement par l'admin ») restait vert sans l'invalidation de `withdrawConsent` : `cardsByIds` filtrait l'identifiant périmé [tests/functional/public/home.spec.ts] — réécrit avec 4 auteurs : après le POST, la clé `topAuthors` a disparu du cache et le 4e remonte dans le top 3 (impossible par le seul re-filtrage) ; vérifié par mutation (invalidation retirée → le test échoue).
- [x] [Review][Patch] Départage D36 : une production dépubliée qui garde son `anta_published_at` ne doit pas compter dans `last_published_at` [tests/functional/public/home.spec.ts] — test ajouté.
- [x] [Review][Patch] Le test de co-signature ne garde que ce qu'impose la clé primaire du pivot : conservé comme garde-fou de non-régression, commentaire ajouté ; il ne couvre pas la logique de la requête.
- [x] [Review][Decision] D-12.3-1 : écart accepté avec l'épique (`RankingService.topAuthors()`) → `RankingService.topAuthorIds()` (cache) + `PublicAuthorService.topViewedAuthorIds()` / `cardsByIds()` (requête et cartes) ; `architecture.md` non modifié.
- [x] [Review][Decision] D-12.3-3 : tri `last_published_at DESC NULLS LAST`, alors que le SQL de P2.3 s'appuie sur le `NULLS FIRST` implicite de Postgres pour `DESC` ; le code est correct, la documentation (P2.3) sera amendée plus tard.
- [ ] [Review][Defer][PO] `/authors` (tri par défaut `views`) départage les ex æquo par nom seulement, sans le départage D36 : après « Voir plus », l'ordre d'auteurs ex æquo peut différer de l'accueil — consigné dans deferred-work.md.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites d'abord (12 tests fonctionnels `home.spec.ts`, 1 unitaire `ranking_invalidation.spec.ts`, 3 de lecture de source `home_blocks.spec.ts`, attentes `cachedKeys` / i18n / `windowed` adaptées) → **30 échecs sur 62** (dont tout `ranking_invalidation.spec.ts`, dont `primeCache` appelle `topAuthorIds`).
- `--files` se répète par fichier (`--files a --files b`) ; sinon le runner reste bloqué.
- Phase verte ciblée (5 fichiers, dont les specs `/authors`) : **109 verts**.
- Suite complète `npm run test:local` : **1408 tests verts** (baseline 1392, +16), code 0. `npm run lint` : 0 (après 2 correctifs de lint dans les specs). `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, aucun codegen, rien contre Supabase ni R2.
- Revue (3 correctifs de tests, 2 décisions, 1 report PO) : test FR53 vérifié par mutation (invalidation retirée → échec) ; **1409 tests verts** (+1 net : départage avec dépubliée datée ; le test FR53 est réécrit), `npm run test:local` code 0, lint 0, typecheck 0, build 0.

### Completion Notes List

- `PublicAuthorService` : agrégat de vues (LATERAL `total_views` / `window_views`, portée `visibleOnSite`) extrait dans `visibleWithViews()` et colonnes de carte dans `cardQuery()`, partagés par `list()` (comportement inchangé), `topViewedAuthorIds(limit)` (vues 365 j > 0, ordre D36 : fenêtre ↓, `max(anta_published_at)` de toutes les publiées ↓ NULLS LAST, nom, prénom, id) et `cardsByIds(ids)` (ordre du cache, re-filtré `visibleOnSite`). `listCard` porte `photoBase` → la carte de l'accueil est identique à celle de `/authors` (test d'égalité stricte).
- `RankingService.topAuthorIds()` : clé `topAuthors` du même `RankingCache` (TTL, génération, calcul en vol partagé), import paresseux de `PublicAuthorService` (D-12.3-1). Invalidation : points de 12.2 inchangés (D-12.3-7).
- `HomeController` : prop `topAuthors`. `home.tsx` : 4e `HomeBlock` (`windowed`, `/authors`), `AuthorCard headingLevel="h3"` ; `AuthorCard` : prop `headingLevel` (défaut `h2`). i18n `home.blocks.authors` FR/EN.
- Rendu non vérifié au navigateur (pas de serveur lancé) : contrôle visuel du bloc auteurs à 375 / 1024 px au test PO. `EXPLAIN ANALYZE` de la requête auteurs sur la base remplie → 12.5.
- Toujours ouvert : `[Review][Defer][PO]` de 12.2 (commandes Ace → cache web périmé ≤ 10 min) ; pour `topAuthors`, un profil devenu non public n'est de toute façon jamais affiché (D-12.3-4).

### File List

- app/services/public_author_service.ts
- app/services/ranking_service.ts
- app/controllers/public/home_controller.ts
- app/controllers/public/authors_controller.ts
- inertia/components/public/AuthorCard.tsx
- inertia/pages/home.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/functional/public/home.spec.ts
- tests/unit/services/ranking_invalidation.spec.ts
- tests/unit/components/home_blocks.spec.ts
- _bmad-output/implementation-artifacts/12-3-bloc-auteurs-les-plus-consultes.md (nouveau)

## Change Log

- 2026-11-24 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-24 : implémentation (`topViewedAuthorIds` / `cardsByIds` sur la portée `visibleOnSite` et l'agrégat partagé de `/authors`, cache `topAuthors`, prop `topAuthors`, 4e `HomeBlock`, `AuthorCard` `headingLevel`, i18n) ; statut review.
- 2026-11-24 : revue de code — 3 correctifs de tests (FR53 sans invalidation détectée, dépubliée datée ignorée au départage, portée du test de co-signature), 2 écarts documentés (D-12.3-1, D-12.3-3), 1 report PO (départage de `/authors`) ; statut done.
