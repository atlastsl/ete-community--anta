# Story 5.7 : Tests site public — Recherche et découverte

Status: review

<!-- Note: Validation optionnelle. Lancer validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que développeur,
Je veux une suite de tests couvrant la recherche, les filtres, la pagination et le SEO,
Afin de garantir la fiabilité du moteur de découverte.

> **7ᵉ et dernière story de l'Epic 5 — consolidation des tests.** La majorité des scénarios fonctionnels sont **déjà couverts** par les specs écrites en 5.2→5.6 (`home.spec.ts`, `search.spec.ts`, `listing.spec.ts`, `productions.spec.ts`, `seo.spec.ts`). Le **manque réel** est un **test unitaire dédié de `SearchService`** (aujourd'hui validé uniquement via HTTP). Cette story : (1) crée le test unitaire `SearchService`, (2) audite la couverture fonctionnelle du `ProductionsController` contre les scénarios de l'epic et **comble les rares trous**, (3) documente la **carte de couverture** pour tracer chaque scénario de l'epic. **Pas de code applicatif** — uniquement des tests.

## Acceptance Criteria

**AC1 — Test unitaire `SearchService`** (`tests/unit/services/search_service.spec.ts`)

- **Given** le test unitaire `SearchService` existe
- **When** `node ace test` est exécuté
- **Then** les scénarios suivants passent :
  - **Recherche tsvector** : `search({ q })` retourne les productions publiées dont `search_vector` matche le terme (titre/résumé/auteurs/catégorie/…) ; un terme sans correspondance → 0 résultat ; une requête multi-mots ne lève pas d'erreur SQL
  - **Application de chaque filtre** : `category`, `domain`, `subdomain`, `language`, `country`, `license`, `author` (jsonb) filtrent correctement (chacun isolément)
  - **Combinaison de filtres** : AND inter-dimensions + OR intra-dimension
  - **Tri** : `views` (vues décroissantes), `downloads` (téléchargements décroissants), `date` (`antaPublishedAt` décroissant), `relevance` (par `ts_rank` quand `q` présent)
  - **Productions publiées uniquement** : un brouillon n'est jamais retourné
  - **(bonus) `facets()`** : valeurs distinctes par dimension (publiées), auteurs aplatis depuis le jsonb

**AC2 — Couverture fonctionnelle `ProductionsController` complète**

- **Given** la suite fonctionnelle publique existe (`tests/functional/public/*`)
- **When** `node ace test` est exécuté
- **Then** les scénarios de l'epic sont **tous couverts** (par une spec existante ou un ajout) :
  - Recherche textuelle → résultats filtrés par tsvector ✅ (`search.spec.ts`)
  - Filtres combinés → résultats corrects ✅ (`search.spec.ts`)
  - **Aucun résultat → état vide retourné** (à garantir explicitement : `?q=<aucune-correspondance>` → `results` vide, `pagination.total === 0`)
  - Pagination → page 2 avec paramètres préservés ✅ (`search.spec.ts` / `listing.spec.ts`)
  - Page d'accueil → 6 plus consultées + 6 récentes ✅ (`home.spec.ts`)
  - Meta tags présents dans le HTML ✅ (`seo.spec.ts`)

**AC3 — Carte de couverture documentée**

- **Given** la story est terminée
- **When** un développeur consulte le fichier story
- **Then** une **table de correspondance** « scénario epic → fichier:test » est fournie (dans les Completion Notes), prouvant que chaque scénario de l'AC d'origine est couvert sans duplication inutile

**AC4 — Suite verte et non-régression**

- **Given** tous les tests sont exécutés
- **When** `node ace test`, `npm run lint`, `npm run typecheck` tournent
- **Then** tout est vert (hors flaky pré-existant connu `production.spec.ts` GIN), 0 erreur lint, 0 erreur typecheck

## Tasks / Subtasks

- [x] **Tâche 1 — Audit de couverture (lecture seule)** (AC2, AC3)
  - [x] 1.1 Specs publiques existantes lues (home/search/listing/productions/seo + search_query + composants).
  - [x] 1.2 Trous confirmés : (a) test unitaire `SearchService` absent ; (b) assertion explicite « aucun résultat » (le 0-résultat n'était couvert que via l'exclusion d'un brouillon).

- [x] **Tâche 2 — Test unitaire `SearchService`** (AC1) — **livrable principal**
  - [x] 2.1 Créé `tests/unit/services/search_service.spec.ts` (import `SearchService`/`EMPTY_FILTERS` via `#services`, rollback transactionnel). DB OK dans la suite `unit`.
  - [x] 2.2 Helpers `createProduction`/`addViews`/`addDownloads`.
  - [x] 2.3 Helper `searchTitles({ q, filters, sort })`.
  - [x] 2.4 tsvector : titre/résumé/auteurs ; 0 sur non-match ; multi-mots sans erreur ; brouillon exclu.
  - [x] 2.5 Filtres isolés : category/domain/subdomain/language/country/license/author (jsonb).
  - [x] 2.6 Combinaison : AND inter-dimensions + OR intra-dimension.
  - [x] 2.7 Tri : views, downloads, date, relevance (match le plus fort en tête — cas à écart net).
  - [x] 2.8 `facets()` : catégories/langues distinctes (publiées) + auteurs aplatis.

- [x] **Tâche 3 — Combler le trou « aucun résultat »** (AC2)
  - [x] 3.1 Ajouté à `search.spec.ts` : `?q=zzzaucunecorrespondance` → `results` vide + `pagination.total === 0`.
  - [x] 3.2 Autres scénarios AC2 confirmés présents (pas de duplication ajoutée).

- [x] **Tâche 4 — Carte de couverture** (AC3) — voir Completion Notes.

- [x] **Tâche 5 — Validation finale** (AC4)
  - [x] 5.1 `node ace test` → 345/345 verts.
  - [x] 5.2 `npm run lint` → 0 erreur.
  - [x] 5.3 `npm run typecheck` → 0 erreur.

## Dev Notes

### Architecture cible (synthèse)

- **Story 100% tests** : aucun fichier applicatif (`app/`, `inertia/`, routes) modifié. On ajoute un test unitaire `SearchService` et, au besoin, une assertion fonctionnelle manquante.
- **`SearchService` testé en isolation avec DB** : le service exécute du SQL (tsvector `websearch_to_tsquery('simple')`, `jsonb @>`, `withAggregate`, `orderBy` sur alias). Le test unitaire l'appelle directement (sans HTTP) avec rollback transactionnel. C'est un test « unitaire de service » au sens du projet (cf. `activity_log_service.spec.ts`), même s'il touche PostgreSQL.
- **Pas de duplication** : les scénarios fonctionnels du `ProductionsController` sont déjà couverts par les specs de 5.2–5.6. On ne recrée pas un `ProductionsController.spec.ts` monolithique ; on **mappe** (la suite publique répartie par fonctionnalité EST la couverture du contrôleur). _Voir question 1._

### Carte de couverture (ébauche — à finaliser en Tâche 4)

| Scénario (epic 5.7) | Couverture |
| --- | --- |
| Recherche textuelle (tsvector) | `tests/functional/public/search.spec.ts` (« ?q matche le titre/résumé/auteurs ») + **nouveau** `search_service.spec.ts` |
| Filtres combinés | `search.spec.ts` (AND/OR) + `search_service.spec.ts` |
| Aucun résultat → état vide | **à ajouter** (`search.spec.ts` : `?q=nomatch` → `results` vide, `total 0`) ; rendu UI : assertions source `productions.tsx`/5.4 + a11y/5.6 |
| Pagination page 2 + params préservés | `search.spec.ts` + `listing.spec.ts` (« ?page=2&sort=views&category=X ») |
| Homepage 6 + 6 | `home.spec.ts` (« limite à 6 items par section », tri vues/récents) |
| Meta tags dans le HTML | `seo.spec.ts` (`/`, `/productions`, `/privacy-policy`) |
| SearchService — construction tsvector | **nouveau** `search_service.spec.ts` |
| SearchService — chaque filtre | **nouveau** `search_service.spec.ts` |
| SearchService — filtres multiples | **nouveau** `search_service.spec.ts` |
| SearchService — tri (pertinence/date/vues/téléchargements) | **nouveau** `search_service.spec.ts` |

> ⚠️ **« Meta tags présents dans le HTML des pages de production »** : les **pages de production (détail `/productions/:slug`) sont l'Epic 6** et n'existent pas encore. La couverture meta porte ici sur les pages publiques **existantes** (`/`, `/productions`, `/privacy-policy`) via `seo.spec.ts`. Les meta de la page détail seront testés en Epic 6 (avec `SeoService.forProduction`).

### État existant à RESPECTER (tests déjà en place)

- `tests/functional/public/home.spec.ts` (5.2) — homepage : sections vides, mostViewed trié vues desc + ≤6 + exclut draft, recent trié antaPublishedAt desc, limite 6, catégories distinctes.
- `tests/functional/public/search.spec.ts` (5.3) — tsvector (titre/résumé/auteur), multi-mots, draft exclu, OR/AND, author jsonb, licence (+ invalide), facettes, `?page=2` + filtres.
- `tests/functional/public/listing.spec.ts` (5.4) — tri views/date/downloads, fallback, défaut, `pagination.total`, `?page=2&sort=views&category=X`.
- `tests/functional/public/productions.spec.ts` (5.3/5.5) — contrat props (`results/facets/activeFilters/pagination/q`).
- `tests/functional/public/seo.spec.ts` (5.5) — meta/OG dans le HTML brut, locale FR/EN, `<html lang>`.
- `tests/unit/lib/search_query.spec.ts` (5.3/5.4) — helpers d'URL (source).
- `tests/unit/services/{seo_service,production_service,activity_log_service}.spec.ts` — pattern de test de service. **`activity_log_service.spec.ts`** = précédent d'un test de service ; **`production_service.spec.ts`** = pur en mémoire (`new Production()`), PAS de DB — mais `SearchService` a besoin de la DB → suivre plutôt le pattern **fonctionnel** (transaction) pour `search_service.spec.ts`.
- `app/services/search_service.ts` — `search({ q, filters, sort, page, perPage })`, `facets()`, exports `EMPTY_FILTERS`, `SORT_OPTIONS`, `ProductionFilters`. **Ne pas modifier.**

### Conventions et patterns

- **Fixtures in-spec** : `createProduction` / `addViews` / `addDownloads` (pattern `home.spec.ts`/`listing.spec.ts`). Email/titre aléatoires si besoin d'unicité. `createdById: null` (FK nullable) — pas besoin d'`AdminUser`.
- **DB rollback** : `group.each.setup(async () => { await db.beginGlobalTransaction(); return () => db.rollbackGlobalTransaction() })`.
- **Appels service** : importer `SearchService`, `EMPTY_FILTERS` depuis `#services/search_service`. Construire `filters` via `{ ...EMPTY_FILTERS, category: ['X'] }`.
- **Assertions tri** : comparer l'ordre des `title` retournés (`paginator.all().map(p => p.title)`).
- **Lecture des agrégats** : le paginator renvoie des modèles `Production` avec `$extras.viewsCount`/`downloadsCount` (le service les sélectionne) — pour vérifier le tri, l'ordre des titres suffit.
- **`relevance`** : `ts_rank` dépend du contenu ; tester avec un terme présent plusieurs fois / dans le titre vs résumé peut être instable. **Assertion robuste** : avec `q`, `relevance` retourne bien les matches (sans erreur) et place le document le plus pertinent en tête si l'écart est net (ex. terme dans titre+résumé vs une seule occurrence). Sinon se limiter à « retourne les bons résultats sans erreur ».

### Anti-patterns à éviter

- ❌ Modifier `SearchService`/contrôleurs/composants — story 100% tests (le code est figé depuis 5.2–5.6).
- ❌ Dupliquer les scénarios déjà couverts (créer un `ProductionsController.spec.ts` monolithique redondant) — mapper + combler les trous.
- ❌ Tester `relevance` avec une assertion d'ordre fragile dépendant d'un `ts_rank` ambigu — choisir un cas à écart net ou assertion souple.
- ❌ Oublier le rollback transactionnel → fuite de données entre tests (et faux positifs sur les facettes/comptages).
- ❌ Tester la page détail `/productions/:slug` (Epic 6 — n'existe pas).
- ❌ Importer un module `inertia/` dans un test serveur (TS6305) — non pertinent ici (on teste `SearchService`, côté serveur).

### Sécurité / conformité

- Tests en lecture seule sur des données de fixture (rollback). Aucune donnée réelle, aucun envoi externe.
- Confirme la garantie de sécurité clé : **brouillons jamais exposés** par la recherche/les filtres (test explicite dans `search_service.spec.ts`).

### Project Structure Notes

**Fichiers créés :**

- `tests/unit/services/search_service.spec.ts` — **livrable principal** (unité `SearchService` + DB)

**Fichiers modifiés :**

- `tests/functional/public/search.spec.ts` — ajout du cas « aucun résultat » (si non déjà présent)
- (le fichier story — carte de couverture dans les Completion Notes)

**Aucun fichier applicatif modifié. Pas de migration, pas de codegen.**

### Previous Story Intelligence (5.2–5.6 + Epic 4)

- **5.3** : `SearchService` créé (tsvector `websearch_to_tsquery('simple')`, filtres AND/OR, author jsonb, facettes). Testé **fonctionnellement** mais **pas en unité** → c'est le trou à combler.
- **5.4** : tri `sort` ajouté (`relevance`/`date`/`views`/`downloads`) — testé fonctionnellement (`listing.spec.ts`) ; à couvrir aussi en unité.
- **5.2** : homepage 6+6 testée (`home.spec.ts`). Fixtures `createProduction`/`addViews` = pattern à réutiliser.
- **5.5** : meta SEO testées (`seo.spec.ts`). Pages détail = Epic 6.
- **Pattern test de service avec DB** : aucun service-unit n'utilise encore `db.beginGlobalTransaction` (production_service = pur mémoire) — `search_service.spec.ts` introduira ce pattern dans `tests/unit/services/` (le `unit` suite boote l'app → DB dispo, pas besoin du httpServer).
- **Flaky connu** : `tests/unit/models/production.spec.ts` (index GIN, planner Postgres sur table vide) — non lié, isolé.
- **CI PostgreSQL** (1.8) : service Postgres réel en CI → tsvector/jsonb s'exécutent comme en local.

### Latest Tech Information

- **Japa** : `tests/unit/services/*.spec.ts` exécutés dans la suite `unit` (boote l'app, DB connectée). `db.beginGlobalTransaction()` fonctionne hors suite `functional` (pas besoin du serveur HTTP).
- **AdonisJS Lucid** : `SearchService.search(...)` → `ModelPaginatorContract<Production>` (`.all()`, `.getMeta()`). `EMPTY_FILTERS` pour la base.
- **PostgreSQL** : `ts_rank` pour le tri pertinence ; `jsonb @> ?::jsonb` pour le filtre auteur ; le trigger `productions_search_vector_trigger` peuple `search_vector` automatiquement à l'INSERT (donc `Production.create(...)` suffit pour rendre une production cherchable).

### Questions / clarifications (pour l'utilisateur)

1. **Nom des fichiers de test** : l'epic nomme `tests/functional/public/ProductionsController.spec.ts`. Notre suite publique est organisée **par fonctionnalité** (`search`, `listing`, `home`, `seo`, `productions`) — plus lisible et déjà en place. Je **conserve cette organisation** + carte de couverture, plutôt que de tout fusionner dans un fichier monolithique. OK pour toi (recommandé), ou tu veux un fichier `productions_controller.spec.ts` consolidé ?
2. **Profondeur du test `relevance`** : OK pour une assertion « souple » (retourne les bons résultats sans erreur, et le plus pertinent en tête sur un cas à écart net), plutôt qu'une vérification d'ordre fine et fragile du `ts_rank` ?

### References

- [Source: epics.md#Story 5.7] — Acceptance Criteria d'origine (scénarios fonctionnels + unitaires)
- [Source: epics.md#Epic 5] — NFR2 (< 1s), périmètre découverte
- [Source: app/services/search_service.ts] — service à tester en unité (search + facets + sort)
- [Source: tests/functional/public/search.spec.ts] — couverture tsvector/filtres/pagination (5.3)
- [Source: tests/functional/public/listing.spec.ts] — couverture tri/pagination (5.4)
- [Source: tests/functional/public/home.spec.ts] — couverture homepage 6+6 (5.2)
- [Source: tests/functional/public/seo.spec.ts] — couverture meta tags (5.5)
- [Source: tests/unit/services/production_service.spec.ts] — pattern test de service (pur)
- [Source: tests/unit/services/activity_log_service.spec.ts] — pattern test de service
- [Source: Story 5.3] — SearchService (tsvector/filtres) non couvert en unité
- [Source: Story 5.4] — tri configurable

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- **Test de service avec DB dans la suite `unit`** : `production_service.spec.ts` est pur (mémoire). `SearchService` exécute du SQL → introduction du pattern `db.beginGlobalTransaction()`/rollback dans `tests/unit/services/`. La suite `unit` boote l'app (DB connectée) sans serveur HTTP — fonctionne sans `testUtils.httpServer()`.
- **`relevance` testé sur un cas à écart net** (recommandation Q2) : doc avec le terme dans titre + résumé (occurrences multiples) vs doc avec une occurrence → `ts_rank` place le premier en tête de façon déterministe. Évite une assertion d'ordre fragile.
- **Décisions sur les 2 questions ouvertes (recommandations appliquées)** : (1) tests **organisés par fonctionnalité** (pas de `ProductionsController.spec.ts` monolithique) + carte de couverture ; (2) assertion `relevance` sur cas à écart net. À confirmer en review.

### Completion Notes List

- AC1–AC4 satisfaits ; suite verte 345/345, lint 0, typecheck 0
- **Livrable principal** : `tests/unit/services/search_service.spec.ts` (18 tests) couvrant tsvector, chaque filtre, combinaisons AND/OR, tri (views/downloads/date/relevance), exclusion des brouillons, `facets()`
- Cas « aucun résultat » ajouté à `search.spec.ts` (contrat de données : `results` vide + `total 0`)
- Aucun code applicatif modifié (story 100% tests)

**Carte de couverture (scénario epic 5.7 → test) :**

| Scénario | Couverture |
| --- | --- |
| Recherche textuelle (tsvector) | `search.spec.ts` (ts:matche titre/résumé/auteurs) + `search_service.spec.ts` (groupe « recherche tsvector ») |
| Filtres combinés | `search.spec.ts` (OR/AND) + `search_service.spec.ts` (groupe « combinaison de filtres ») |
| Aucun résultat → état vide | `search.spec.ts` (« aucun résultat → results vide + total 0 ») ; rendu UI : `productions.tsx` (5.4) + a11y (5.6) |
| Pagination page 2 + params préservés | `search.spec.ts` (« ?page=2 + filtres conservés ») + `listing.spec.ts` (« ?page=2&sort=views&category=X ») |
| Homepage 6 + 6 | `home.spec.ts` (« limite à 6 items », tri vues/récents, exclut draft) |
| Meta tags dans le HTML | `seo.spec.ts` (`/`, `/productions`, `/privacy-policy`) — pages détail = Epic 6 |
| SearchService — construction tsvector | `search_service.spec.ts` (groupe « recherche tsvector ») |
| SearchService — chaque filtre | `search_service.spec.ts` (groupe « filtres isolés ») |
| SearchService — filtres multiples | `search_service.spec.ts` (groupe « combinaison de filtres ») |
| SearchService — tri (pertinence/date/vues/téléchargements) | `search_service.spec.ts` (groupe « tri ») |

### File List

**Créés :**
- `tests/unit/services/search_service.spec.ts` — test unitaire `SearchService` (tsvector + filtres + combinaisons + tri + facettes)

**Modifiés :**
- `tests/functional/public/search.spec.ts` — ajout du cas « aucun résultat » (contrat de données)

**Aucun fichier applicatif modifié. Pas de migration, pas de codegen.**

### Change Log

- 2026-06-01 : Implémentation Story 5.7 (Tests site public — recherche et découverte). Test unitaire `SearchService` (18 tests : tsvector, 7 filtres isolés, combinaisons AND/OR, tri views/downloads/date/relevance, brouillons exclus, facettes) introduisant le pattern test-de-service-avec-DB ; cas « aucun résultat » ajouté au fonctionnel ; carte de couverture documentée. Story 100% tests. 1 fichier créé, 1 modifié. Tests : 345/345 verts, lint+typecheck verts. **Clôture de l'Epic 5.**
