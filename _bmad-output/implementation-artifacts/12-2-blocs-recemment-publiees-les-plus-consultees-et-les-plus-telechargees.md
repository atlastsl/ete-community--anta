---
baseline_commit: 3f0c97b
---

# Story 12.2 : Blocs « Récemment publiées », « Les plus consultées » et « Les plus téléchargées »

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **voir sur l'accueil les productions récentes et les plus consultées ou téléchargées des 12 derniers mois**,
afin de **repérer ce qui intéresse la communauté en ce moment** (FR9, FR45, FR46, D2, D4, D5, D6, D28).

## Décision de périmètre (lire en premier)

- Story **sans migration** (index de la Story 10.5 déjà en place : `idx_stats_views_production_id_recorded_at`, `idx_stats_downloads_production_id_downloaded_at`), **sans dépendance npm**, sans nouvelle route, sans composant shadcn ajouté.
- **DANS 12.2** :
  - `app/services/ranking_service.ts` : classements 365 j « consultées » / « téléchargées » (identifiants ordonnés), cache `Map` du processus (TTL 10 min), `invalidate()` et `invalidateAfterCommit(client)` ;
  - branchement de l'invalidation sur **tous** les chemins de mutation listés (voir « Points d'invalidation ») ;
  - `home_controller.ts` : props `recent`, `mostViewed`, `mostDownloaded` (3 éléments chacune) à la place des deux sections 6 + 6 ;
  - composant `HomeBlock` (`inertia/components/public/HomeBlock.tsx`), générique (réutilisé par 12.3 pour les `AuthorCard`) ;
  - i18n public `home.blocks.*` (FR/EN) ; clés `home.sections.*` et `home.empty` retirées.
- **HORS 12.2 (ne PAS implémenter)** :
  - bloc « Auteurs les plus consultés » / `topAuthors` → **12.3** (le cache et `HomeBlock` sont conçus pour l'accueillir : clé de cache `topAuthors`, `HomeBlock` générique) ;
  - suggestions → 12.4 ; seeder démo étalé sur 540 j, `EXPLAIN ANALYZE`, suite transverse de l'invalidation → 12.5 (12.2 couvre déjà la dépublication, la publication, la suppression et un test par point d'invalidation) ;
  - tris du listing (12.1, inchangés).

## Acceptance Criteria

1. **Classements 365 j (D5, P2.3)** — **Given** `RankingService`, **When** « consultées » / « téléchargées » sont calculés, **Then** ils comptent les vues (`stats_views.recorded_at`) / téléchargements (`stats_downloads.downloaded_at`) `>= now() - interval '365 days'` par jointure **interne** (production à 0 sur la fenêtre exclue), productions `published` seulement ; ordre : compte sur la fenêtre ↓, `anta_published_at` ↓ (`NULLS LAST`), `id` ↑ ; 3 éléments.
2. **Cartes (FR46, D4, D37)** — les cartes sont hydratées par `ProductionCardTransformer` avec les **totaux** de vues et de téléchargements (agrégats `withAggregate`), byline publique (`PublicBylineService.attach`), sans image.
3. **Récemment publiées** — les 3 productions publiées les plus récentes sur Anta (`anta_published_at` ↓, puis `id` ↑), **non cachées**.
4. **Cache (P2-06)** — les identifiants ordonnés des deux classements sont mémorisés dans une `Map` du processus (TTL 10 min) ; « Récemment publiées » et la une ne sont pas cachées.
5. **Invalidation** — `RankingService.invalidate()` est appelé **après le commit** par : publication, dépublication (y compris la dépublication automatique de l'édition), suppression d'une production, `ProductionAuthorService.sync` (pivot modifié), confirmation et retrait du consentement, modification et suppression d'une fiche auteur.
6. **Props** — `home_controller.ts` rend `featured`, `recent`, `mostViewed`, `mostDownloaded`, `meta` ; plus de section 6 + 6.
7. **HomeBlock** — titre `h2` (« Récemment publiées », « Les plus consultées », « Les plus téléchargées »), sous-titre discret « sur les 12 derniers mois » pour les blocs classés (D4), grille `grid-cols-1 md:grid-cols-3` (D2, D35), `ProductionCard` identiques au listing (D37) ; ordre FR9 sous la bannière.
8. **Blocs partiels / vides (FR46, D5)** — un bloc à 1–2 éléments est affiché avec « Voir plus » (cellules vides conservées : la grille garde 3 colonnes) ; un bloc à 0 élément est absent, titre compris ; catalogue vide → seul le hero reste (aucun message).
9. **Voir plus (D28, a11y)** — mène à `/productions?sort=date`, `?sort=views`, `?sort=downloads` ; nom accessible complet « Voir plus : {titre du bloc} » (complément masqué `sr-only`), cible ≥ 44 px (`min-h-11`).
10. **Pas de dédoublonnage** avec la bannière (D6).

## Tasks / Subtasks

- [x] **T1 — `RankingService`** (AC 1, 4, 5)
  - [x] 1.1 `RankingCache` (TTL, horloge injectable, génération anti-écriture périmée, D-12.2-2) exporté pour les tests unitaires.
  - [x] 1.2 `mostViewedIds()`, `mostDownloadedIds()` (SQL de P2.3, `db.rawQuery`, statut paramétré).
  - [x] 1.3 `invalidate()`, `invalidateAfterCommit(client?)` (D-12.2-3).
- [x] **T2 — Branchement de l'invalidation** (AC 5)
  - [x] 2.1 `ProductionService.publish` / `unpublish` / `delete`.
  - [x] 2.2 `ProductionAuthorService.sync` (pivot modifié).
  - [x] 2.3 `Admin ProductionsController.update` (dépublication automatique).
  - [x] 2.4 `AuthorService.update` / `confirmConsent` / `withdrawConsent` / `delete`.
  - [x] 2.5 `AuthorConversionService.apply` (écriture du pivot hors `sync`, D-12.2-4).
- [x] **T3 — Accueil serveur** (AC 2, 3, 6, 10) — `home_controller.ts` : `recent` (3), `mostViewed`, `mostDownloaded` hydratés dans l'ordre du cache, re-filtrés `published`.
- [x] **T4 — Front** (AC 7–9)
  - [x] 4.1 `inertia/components/public/HomeBlock.tsx` (générique `items` + `renderItem`, `null` si vide).
  - [x] 4.2 `inertia/pages/home.tsx` : trois `HomeBlock` dans l'ordre FR9, `Section` retirée.
  - [x] 4.3 i18n fr/en `home.blocks.*` ; `home.sections.*`, `home.empty` retirées.
- [x] **T5 — Tests** (tous les AC)
  - [x] 5.1 Unit `tests/unit/services/ranking_service.spec.ts` (TTL, `invalidate`, génération, `invalidateAfterCommit`).
  - [x] 5.2 Functional `home.spec.ts` : 366 j ignorés, 0 exclu, ex æquo par `anta_published_at` puis `id`, totaux ≠ compte 365 j, bloc vide absent, brouillon exclu, 3 éléments, cache invalidé après dépublication / publication / suppression.
  - [x] 5.3 Invalidation par point : tests **unitaires** appelant les services (`ranking_invalidation.spec.ts` : sync, publish, unpublish, delete, consentement, fiche auteur) ; HTTP seulement pour dépublication, publication, suppression et édition avec dépublication automatique (`home.spec.ts`) ; couverture HTTP du consentement et des fiches auteur → 12.5.
  - [x] 5.4 Composant `HomeBlock` + accueil par lecture de source ; specs existantes adaptées (bannière, a11y h1, i18n).
  - [x] 5.5 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/controllers/public/home_controller.ts` : `publishedWithCounts()` (agrégats `viewsCount` / `downloadsCount`), `mostViewed` (totaux, 6), `recent` (6), `featured` (11.6, non caché), `meta`. Une seule passe `PublicBylineService.attach` pour toutes les lignes (à conserver).
- `inertia/pages/home.tsx` : hero (12.1), `FeaturedBanner`, `Section` locale (h2 + `home.empty` si vide, grille `sm:grid-cols-2 lg:grid-cols-3`) × 2.
- `app/services/production_service.ts` : `publish(production)` (appelée dans la transaction de `ProductionsController.publish` : `production.$trx`), `unpublish` (transaction propre), `delete` (transaction propre).
- `app/controllers/admin/productions_controller.ts` : `update` (transaction : `sync` si `authorIds`, dépublication automatique en écrivant `status` directement), `store` (brouillon + `sync`).
- `app/services/production_author_service.ts` : `sync(productionId, ids, trx)` → `{ protected, changed }`.
- `app/services/author_service.ts` : `update`, `confirmConsent`, `withdrawConsent`, `delete` (chacun sa transaction) ; `create` (fiche neuve, sans production : aucun effet sur un classement).
- `app/services/author_conversion_service.ts` : `apply` écrit le pivot directement (`DELETE` / `INSERT production_authors`), transaction propre, lancé par l'Ace `authors:apply`.

### Points d'invalidation (recensés par `grep`, aucune action groupée dans l'admin)

| Mutation | Site | Moment |
|---|---|---|
| Publication | `ProductionService.publish` | `after('commit')` de `production.$trx`, sinon immédiat |
| Dépublication | `ProductionService.unpublish` | après sa transaction |
| Dépublication automatique (édition) | `ProductionsController.update` | après la transaction, si `autoUnpublished` |
| Suppression | `ProductionService.delete` | après sa transaction |
| `sync` | `ProductionAuthorService.sync` | `after('commit')` du `trx` appelant, si `changed` |
| Consentement confirmé / retiré | `AuthorService.confirmConsent` / `withdrawConsent` / `update` (case « consentement ») | après la transaction, si l'état a changé |
| Modification / suppression de fiche | `AuthorService.update` / `delete` | après la transaction (suppression : si `deleted`) |
| Conversion des auteurs | `AuthorConversionService.apply` | après commit (sans effet sur le processus web, D-12.2-4) |

Aucune commande Ace ne publie ni ne dépublie (`thumbnails:extract-video-frames` n'écrit que les posters). Le seeder démo passe par `sync` (processus séparé, sans effet).

### Garde-fous

- Invalider **après** le commit : invalider dans la transaction laisserait un rendu concurrent recalculer l'ancien état et le cacher 10 min. Lucid : `trx.after('commit', cb)` (déjà utilisé par `FeaturedService`) ; sous la transaction globale des tests, le commit du savepoint déclenche le hook.
- `RankingService` n'importe aucun service ni modèle (seulement `db` et `ProductionStatus`) : il est importé par `ProductionAuthorService` / `AuthorService` / `ProductionService` sans cycle.
- Cache partagé par tout le processus de test : chaque test fonctionnel commence avec un cache vide (hook de suite dans `tests/bootstrap.ts`, D-12.2-8), sinon des identifiants d'un test annulé fuiraient dans le suivant.
- Tests sans contrainte d'horloge réelle : horloge injectée dans `RankingCache`.
- `ProductionCard` inchangée ; `PublicBylineService.attach` une seule fois pour toutes les lignes (bannière comprise).
- Composants `inertia/` testés par lecture de source (TS6305).
- Dépôt public : données fictives.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2] ; en-tête Epic 12 (ordre FR9) ; Story 12.3 (même cache / invalidation).
- [Source: architecture.md#P2.3] (SQL, cache, invalidation), P2-06, P2.1 (index 10.5, migration `1775918751000_add_stats_window_indexes.ts`).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:32, 67–68, 106, 138–139, 191, 196, 204, 211] ; [DESIGN.md:215–218, 297, 359, 361] ; maquette `mockups/home.html:88–186`.
- [Source: 12-1-…md] (hero, `Section` conservées pour 12.2) ; [11-6-…md] (bannière non cachée, sections jusqu'à l'Epic 12) ; [11-2-…md] (cartes sans image, D37).

## Décisions (D-12.2-n)

- **D-12.2-1** : le cache ne garde que les **identifiants ordonnés** par clé (`mostViewed`, `mostDownloaded`, puis `topAuthors` en 12.3) ; les cartes sont hydratées à chaque rendu (titres, bylines, totaux toujours frais). L'hydratation re-filtre `status = 'published'` et ignore un identifiant disparu : un bloc peut compter moins de 3 cartes jusqu'à l'expiration si une mutation n'a pas pu invalider ce processus (D-12.2-4).
- **D-12.2-2** : compteur de **génération** : `invalidate()` vide la `Map` et incrémente la génération ; un calcul commencé avant une invalidation n'écrit pas son résultat (il est servi une fois, pas mémorisé). Évite qu'un rendu concurrent recache l'état d'avant le commit.
- **D-12.2-3** : `invalidateAfterCommit(client?)` : transaction en cours → `after('commit')` ; sinon invalidation immédiate. Branché dans les **services** (pas les contrôleurs) pour couvrir tout appelant ; seule exception, la dépublication automatique de `ProductionsController.update`, qui écrit `status` elle-même.
- **D-12.2-4** : les commandes Ace (`authors:apply`) et le seeder tournent dans un **autre processus** : leur invalidation ne touche pas le cache du serveur web ; le TTL de 10 min borne l'écart (accepté par P2.3 pour plusieurs réplicas). `apply` appelle tout de même `invalidateAfterCommit` (cohérence, sans coût).
- **D-12.2-5** : l'enregistrement d'une vue ou d'un téléchargement n'invalide pas (fraîcheur de 10 min acceptée, P2.3) ; `AuthorService.create` non plus (fiche neuve sans production ; son rattachement passe par `sync`).
- **D-12.2-6** : `sync` n'invalide que si le pivot a changé (`changed`) ; une sauvegarde qui ne touche pas aux auteurs ne vide pas le cache. Les consentements n'invalident que sur changement d'état (`confirmed` / `withdrawn`, ou case cochée dans `update`) ; `AuthorService.update` invalide dès qu'il écrit (renommage, photo, affiliations : affichage des auteurs en 12.3).
- **D-12.2-7** : `HomeBlock` générique (`items`, `renderItem`, `title`, `windowed`, `seeMoreHref`) : `null` si `items` est vide ; `h2` relié par `aria-labelledby` (`useId`), « Voir plus » toujours présent (maquette : aussi avec 3 éléments), lien Inertia `Link`. Hrefs littéraux de l'AC (`/productions?sort=date` même si `date` est le tri par défaut sans `q` : D28 prime sur l'omission de 12.1, le serveur l'accepte).
- **D-12.2-8** : `tests/bootstrap.ts` vide le cache avant chaque test des suites `functional` / `browser` / `e2e` (`suite.onTest` + `suite.onGroup` → `each.setup`, import paresseux).
- **D-12.2-9** : i18n `home.blocks.{recent,most_viewed,most_downloaded,window,see_more}` (FR « Récemment publiées », EN « Recently published ») ; `home.sections.*` et `home.empty` retirées (plus d'usage ; catalogue vide = hero seul, AC 8).

## Review Findings

- [x] [Review][Patch] Ruée sur cache froid : après une expiration ou une invalidation, N rendus concurrents relançaient chacun les agrégations [app/services/ranking_service.ts] — calcul en vol partagé par clé et génération ; une promesse rejetée est oubliée ; un calcul commencé avant `invalidate()` n'est toujours pas mémorisé et les appelants suivants en lancent un nouveau (D-12.2-2) ; 3 tests unitaires.
- [x] [Review][Patch] Transactions imbriquées : `after('commit')` d'un savepoint s'exécute à sa libération, avant le COMMIT externe [app/services/ranking_service.ts] — Lucid ne garde aucun lien vers la transaction parente, knex si (`parentTransaction`, non documenté) : seconde invalidation quand `executionPromise` de la transaction la plus externe se règle (COMMIT ou ROLLBACK indiscernables : un ROLLBACK ne coûte qu'un défaut de cache) ; limite documentée dans le code ; 2 tests sans transaction globale.
- [x] [Review][Patch] Suffixe « : {title} » codé en dur dans `HomeBlock` [inertia/components/public/HomeBlock.tsx] — clé `home.blocks.see_more_named` (FR « Voir plus : {{title}} », EN « See more: {{title}} ») en `sr-only`, « Voir plus » visible en `aria-hidden` ; tests de source et i18n mis à jour.
- [x] [Review][Patch] Tests manquants : invalidation par `authors:apply` (et conservation en `--dry-run`) [tests/functional/admin/authors_conversion.spec.ts] ; départage par `id` de « Récemment publiées » [tests/functional/public/home.spec.ts].
- [x] [Review][Patch] Libellé de la tâche 5.3 (« functional » → tests unitaires des services ; HTTP du consentement et des fiches auteur en 12.5).
- [x] [Review][Defer] Savepoints : la seconde invalidation repose sur des champs internes de knex — consigné dans deferred-work.md (test de détection en place).
- [x] [Review][Defer][PO] Les commandes Ace (`authors:apply`) ne peuvent pas invalider le cache du processus web : `topAuthors` (12.3) et les blocs peuvent rester périmés jusqu'à 10 min après la conversion (D-12.2-4) — PO 2026-11-25 : accepté sans code ; attendre 10 min ou redémarrer l'application après `authors:apply`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites d'abord (`home.spec.ts` réécrit, `ranking_invalidation.spec.ts`, `home_blocks.spec.ts`) ; `RankingService` écrit avant le premier lancement (le runner reste bloqué sur un module absent : `ranking_service.spec.ts` est donc vert dès le départ) → **30 échecs sur 55** (tous les tests d'accueil, d'invalidation et de composant ; « publication → cache invalidé » passait déjà : l'ancien tri sur les totaux donnait le même ordre).
- Un fichier lu par `readFileSync` absent bloque aussi le runner : `home_blocks.spec.ts` lit `''` pour un fichier manquant.
- Phase verte ciblée : 82 tests verts (6 fichiers).
- Suite complète `npm run test:local` : **1385 tests verts** (baseline 1344, +41), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, aucun codegen Tuyau nécessaire, rien contre Supabase ni R2.
- Revue (5 correctifs, 2 reports) : **1392 tests verts** (+7), `npm run test:local` code 0, lint 0, typecheck 0, build 0. (Un premier essai du calcul en vol différait `compute` par `Promise.resolve().then` : les appelants concurrents ne le voyaient pas encore → lancé de façon synchrone.)

### Completion Notes List

- `RankingService` (`app/services/ranking_service.ts`) : `mostViewedIds()` / `mostDownloadedIds()` (SQL P2.3, jointure interne sur la fenêtre `now() - interval '365 days'`, ordre compte ↓, `anta_published_at` ↓ NULLS LAST, `id` ↑, 3 éléments) ; `RankingCache` (`Map`, TTL 10 min, horloge injectable, génération D-12.2-2) ; `invalidate()`, `invalidateAfterCommit(client?)` (D-12.2-3), `cachedKeys()` (tests). Clé `RankingKey` prête pour `topAuthors` (12.3). Aucun import de service ni de modèle.
- Invalidation après commit : `ProductionService.publish` (`after('commit')` de `production.$trx`), `unpublish`, `delete` ; `ProductionAuthorService.sync` (si pivot modifié) ; `ProductionsController.update` (dépublication automatique) ; `AuthorService.update` (si écriture), `confirmConsent` / `withdrawConsent` (si changement), `delete` (si supprimée) ; `AuthorConversionService.apply` (après commit, processus Ace : D-12.2-4). Recensement par grep : aucune action groupée, aucune commande Ace qui publie / dépublie.
- `HomeController` : `recent` (3, non caché), `mostViewed`, `mostDownloaded` (ids du cache hydratés dans l'ordre, re-filtrés `published`, totaux), `featured`, `meta` ; une passe de byline pour toute la page.
- `HomeBlock` générique (`items`, `itemKey`, `renderItem`, `windowed`, `seeMoreHref`) : `null` si vide, `h2` + `aria-labelledby`, sous-titre D4, « Voir plus » (`Link`, `min-h-11`, complément `sr-only` « : {titre} », `ArrowRight`), grille `grid-cols-1 md:grid-cols-3` ; classes de la maquette `home.html`.
- `home.tsx` : `Section` retirée, trois `HomeBlock` dans l'ordre FR9 sous la bannière, hrefs `/productions?sort=date|views|downloads`.
- i18n fr/en `home.blocks.*` ; `home.sections.*` et `home.empty` retirées (D-12.2-9).
- `tests/bootstrap.ts` : cache vidé avant chaque test des suites HTTP (D-12.2-8).
- Rendu non vérifié au navigateur (pas de serveur lancé) : contrôle visuel des blocs à 375 / 1024 px et du nom accessible de « Voir plus » au test PO.
- Portes manuelles / reports : `EXPLAIN ANALYZE` sur la base locale remplie et seeder 540 j → 12.5 ; Lighthouse accueil sur le staging → PO.

### File List

- app/services/ranking_service.ts (nouveau)
- app/services/production_service.ts
- app/services/production_author_service.ts
- app/services/author_service.ts
- app/services/author_conversion_service.ts
- app/controllers/admin/productions_controller.ts
- app/controllers/public/home_controller.ts
- inertia/components/public/HomeBlock.tsx (nouveau)
- inertia/pages/home.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/bootstrap.ts
- tests/functional/public/home.spec.ts
- tests/unit/services/ranking_service.spec.ts (nouveau)
- tests/unit/services/ranking_invalidation.spec.ts (nouveau)
- tests/unit/components/home_blocks.spec.ts (nouveau)
- tests/unit/components/home_featured_banner.spec.ts
- tests/unit/components/a11y_components.spec.ts
- tests/functional/admin/authors_conversion.spec.ts (revue)
- _bmad-output/implementation-artifacts/deferred-work.md (revue)
- _bmad-output/implementation-artifacts/12-2-blocs-recemment-publiees-les-plus-consultees-et-les-plus-telechargees.md (nouveau)

## Change Log

- 2026-11-24 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-24 : implémentation (`RankingService` + cache 10 min + invalidation après commit sur tous les chemins de mutation, props `recent` / `mostViewed` / `mostDownloaded`, `HomeBlock`, i18n `home.blocks.*`) ; 1385 tests verts ; statut review.
- 2026-11-24 : revue de code — 5 correctifs (calcul en vol partagé, seconde invalidation à la fin de la transaction externe, `see_more_named` i18n, tests `authors:apply` et départage de « Récemment publiées », libellé 5.3), 2 reports (champs knex internes, cache périmé après une commande Ace) ; statut done.
- 2026-11-25 : décision PO — cache web et commandes Ace : pas de code, redémarrage de l'application après `authors:apply` si besoin.
