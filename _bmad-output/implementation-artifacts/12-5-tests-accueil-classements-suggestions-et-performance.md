---
baseline_commit: f21dc6d
---

# Story 12.5 : Tests accueil, classements, suggestions et performance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que développeur,
Je veux une suite de tests et des mesures couvrant l'accueil refondu et les suggestions,
Afin de garantir les règles de classement et les seuils de performance (NFR17, NFR18, NFR20).

## Décision de périmètre (lire en premier)

Les stories 12.1–12.4 ont livré leurs tests au fil de l'eau (1444 tests au HEAD `f21dc6d`). L'inventaire ci-dessous
rattache chaque puce de l'AC 1 au test qui la couvre déjà. Comme 10.8 et 11.7, cette story **ne duplique rien** et
n'ajoute que les manques :

1. **Invalidation du cache par HTTP** pour les chemins que 12.2 / 12.3 n'ont couverts qu'en tests unitaires de
   services (`ranking_invalidation.spec.ts`) : `sync` (édition d'une production avec `authorIds`), confirmation du
   consentement (bouton de la liste **et** case « consentement » de la fiche), modification d'une fiche, suppression
   d'une fiche (et suppression refusée → cache conservé). Publication, dépublication, dépublication automatique,
   suppression d'une production et retrait du consentement sont déjà couverts par HTTP (`home.spec.ts`).
2. **Ordre des props** de l'accueil (FR9) : l'ordre de sérialisation `featured`, `recent`, `mostViewed`,
   `mostDownloaded`, `topAuthors`, `meta` n'est vérifié nulle part (seulement la présence, sans `topAuthors`).
3. **Seeder de démo** : `recorded_at` / `downloaded_at` aujourd'hui tous à `now()` (valeur par défaut de la colonne)
   → étalés sur les 540 derniers jours ; garde-fou contre la base partagée (aujourd'hui `environment =
   ['development']` seulement, or l'environnement de dev peut viser une base partagée).
4. **Mesures locales** (base locale `anta_demo` du conteneur `anta-test-db`, port 5433, distincte de `anta_test`) :
   `EXPLAIN ANALYZE` des 3 requêtes de classement de productions (vues, téléchargements) et auteurs, et de la requête
   de suggestions ; test de charge local (50 requêtes simultanées, recherche et filtres) par un petit script Node
   sans dépendance, hors dépôt.
5. **Portes manuelles du PO** (rien de distant depuis cette session) : Lighthouse mobile 4G sur l'accueil complet et
   une page de détail (NFR17, NFR18), test de charge sur le staging partagé avec l'accord d'Aurélien (NFR20).

Hors périmètre : axe / suite `browser` / nouvelle dépendance (décision PO du 2026-11-21) ; Epic 13 (WCAG).

## Acceptance Criteria

1. **Given** `tests/functional/public/home.spec.ts`, `listing.spec.ts`, `suggestions.spec.ts` (et les specs voisines
   de l'inventaire), **When** `npm run test:local -- functional` est exécuté, **Then** passent :
   - Accueil → ordre des props, 3 éléments par bloc, prop `categories` absente
   - Classements → stats à 366 j ignorées, éléments à 0 exclus, ex æquo départagés, totaux affichés, bloc vide absent
   - Auteurs les plus consultés → profils publics seulement, départage D36, retrait du consentement pris en compte
     immédiatement
   - Cache → invalidation par publication, dépublication, suppression, `sync`, consentement, modification et
     suppression d'auteur — **chacune par sa route HTTP admin** (ajout 12.5)
   - Listing → tris `relevance` / `date` / `views` / `downloads` sur les totaux
   - Suggestions → ordre par critère, nombre puis date, exclusions, ≤ 4, 404 brouillon
2. **Given** le seeder de démo, **When** il génère vues et téléchargements, **Then** `recorded_at` et `downloaded_at`
   sont répartis aléatoirement sur les 540 derniers jours (jamais avant la publication sur Anta de la production),
   une partie hors de la fenêtre de 365 j ; **And** il refuse de s'exécuter sur une base non locale.
3. **Given** la base **locale** remplie (seeder démo), **When** `EXPLAIN ANALYZE` est exécuté sur les requêtes de
   classement et de suggestions, **Then** l'usage des index de la Story 10.5 est vérifié et plans / temps sont
   consignés ci-dessous ; un index manquant n'est proposé (migration additive) que si le plan le justifie.
4. *(mesure locale)* Test de charge 50 requêtes simultanées sur la recherche et les filtres contre un serveur local
   (build de production, base `anta_demo`) : p95 consigné (cible NFR20 < 1 s).
5. *(portes manuelles PO)* Lighthouse mobile 4G sur le staging (accueil complet, détail) : LCP < 3 s (NFR17),
   suggestions < 2 s (NFR18) ; test de charge staging (accord d'Aurélien) : p95 < 1 s (NFR20). Résultats à consigner.

## Inventaire de couverture existante (AC 1)

| Exigence | Déjà couvert par |
|---|---|
| Props présentes, `categories` absente | `home.spec.ts` « props : featured, recent… », « categories : prop absente (D8) », « GET / → 200 même base vide » |
| Ordre des props | ordre des blocs à l'écran : `unit/components/home_blocks.spec.ts` « ordre FR9 » ; ensemble exact des props → **ajout 12.5** (D-12.5-2) |
| 3 éléments par bloc | `home.spec.ts` « blocs : 3 éléments au plus… », « recent : 3 publiées… », « vues 365 j ↓, 3 éléments… » (auteurs) |
| 366 j ignorés, 0 exclu | « mostViewed : stats de 366 j ignorées », « mostDownloaded : … 0 exclu », « auteur à 0 vue sur 365 j exclu » |
| Ex æquo | « mostViewed : ex æquo… anta_published_at ↓ », « même compte et même date → id ↑ », « recent : même anta_published_at → id ↑ » |
| Totaux affichés | « mostViewed : … totaux affichés », « mostDownloaded : … totaux », « total des vues identique à la carte de /authors » |
| Bloc vide absent | « blocs : … un classement sans stats sur 365 j est vide », « prop topAuthors : base vide → [] » + `home_blocks.spec.ts` (`null` si vide) |
| Auteurs : profils publics, D36 | « profil non public exclu », « vues d'un brouillon ou d'une dépubliée ignorées », « ex æquo : dernière production publiée », « nom, puis prénom », « dépubliée garde sa date mais ne compte pas » |
| Retrait du consentement immédiat | « retrait du consentement par l'admin → absent, le 4e remonte » (HTTP), « identifiant resté en cache… jamais affiché » |
| Cache : publication / dépublication / suppression | `home.spec.ts` « publication → », « dépublication → », « suppression → cache invalidé », « édition rendant la production incomplète » (HTTP) |
| Cache : `authors:apply` | `functional/admin/authors_conversion.spec.ts` « apply invalidates the home rankings » |
| Cache : `sync`, consentement confirmé, fiche modifiée / supprimée | unitaires seulement (`unit/services/ranking_invalidation.spec.ts`) → **manque HTTP** |
| Listing : 4 tris sur les totaux | `listing.spec.ts` « views et downloads trient sur les totaux… (D7) », « relevance avec q », « relevance sans q retombe sur date », « ?sort=date » |
| Suggestions | `suggestions.spec.ts` (ordre par critère, nombre / date / id, exclusions, 4 au maximum, aucune candidate, 404 brouillon / dépubliée / inconnu, `Cache-Control`) |

## Tasks / Subtasks

- [x] T1 Props de l'accueil (AC 1) — `home.spec.ts` : ensemble exact des props de la page (D-12.5-2)
- [x] T2 Invalidation par HTTP (AC 1) — `home.spec.ts`, groupe « cache invalidé par les routes admin (12.5) »
  - [x] `PUT /admin/productions/:id` avec `authorIds` (pivot changé → `topAuthors` recalculé ; inchangé → conservé)
  - [x] `POST /admin/authors/:id/confirm-consent` (l'auteur entre dans le bloc)
  - [x] `PUT /admin/authors/:id` case `consent` cochée (l'auteur entre dans le bloc) ; renommage → cache vidé
  - [x] `DELETE /admin/authors/:id` (fiche non liée → cache vidé ; fiche liée, refusée → conservé)
  - [x] Preuve d'échec : chaque invalidation retirée temporairement → le test HTTP correspondant échoue
- [x] T3 Seeder (AC 2) — `database/seeders/production_demo_seeder.ts` + `tests/unit/seeders/production_demo_seeder.spec.ts`
  - [x] Dates des stats sur 540 j, bornées par `anta_published_at` (D-12.5-3)
  - [x] Garde-fou base locale (helper pur `assertLocalDatabase`, D-12.5-4)
- [x] T4 `EXPLAIN ANALYZE` sur `anta_demo` (AC 3) ; aucun index manquant (D-12.5-5)
- [x] T5 Test de charge local (AC 4), script hors dépôt ; serveur arrêté ensuite
- [x] T6 Portes manuelles documentées (AC 5) + `deferred-work.md`
- [x] T7 Suite complète, lint, typecheck, build

## Dev Notes

### Garde-fous
- Transaction globale par test ; cache vidé avant chaque test HTTP (`tests/bootstrap.ts`, D-12.2-8) ; `.loginAs()`,
  `.withCsrfToken()`, `.redirects(0)` ; `AdminUser` avec mot de passe en clair.
- `AuthorService.confirmConsent` exige une affiliation (D27) ; `delete` refuse une fiche liée à une production.
- `PUT /admin/productions/:id` : corps complet (`formBody` de `productions_authors.spec.ts`), sinon dépublication
  automatique (déjà testée) ; production publiée complète = pivot + lien.
- Tests HTTP : prouver l'invalidation par un **recalcul observable** (un auteur entre dans le bloc, ce que le
  re-filtrage `visibleOnSite` seul ne peut produire) ou, quand la mutation ne change pas le classement (renommage,
  suppression d'une fiche non liée), par `RankingService.cachedKeys()`.
- Mesures : base `anta_demo` créée dans le conteneur `anta-test-db` (jamais `anta_test`, que la suite suppose vide ;
  jamais Supabase) ; `/tmp/d37/local.sh` avec `DB_DATABASE=anta_demo`. Aucune donnée de mesure dans le dépôt.
- Dépôt public : noms fictifs, aucun hôte ni IP.

### Références
- `_bmad-output/planning-artifacts/epics.md` — Story 12.5 ; `architecture.md` — P2.1 (index 10.5), P2.3, P2.4.
- Stories `12-1` … `12-4` (reports vers 12.5), `11-7`, `10-8` (modèle), `deferred-work.md`.
- Migration `1775918751000_add_stats_window_indexes.ts` (`idx_stats_views_production_id_recorded_at`,
  `idx_stats_downloads_production_id_downloaded_at`, `idx_stats_downloads_downloaded_at`).

## Décisions (D-12.5-n)

- **D-12.5-1** : aucune duplication ; seuls les manques de l'inventaire sont ajoutés (modèle 10.8 / 11.7).
- **D-12.5-2** : « ordre des props » = ordre FR9 **du rendu**, déjà vérifié par lecture de source
  (`home_blocks.spec.ts`). L'ordre des clés du JSON Inertia n'est pas un contrat : constaté, Inertia sérialise les
  props transformées après les autres (`featured`, `topAuthors`, … avant `recent`). Le test fonctionnel vérifie donc
  l'**ensemble exact** des props de la page (`featured`, `recent`, `mostViewed`, `mostDownloaded`, `topAuthors`,
  `meta` + props partagées de toute page publique), sans `categories`.
- **D-12.5-3** : dates des stats de démo uniformes entre `max(now − 540 j, anta_published_at)` et `now` (une date de
  publication future est ramenée à `now`) : jamais de vue avant la publication. Avec des publications étalées sur
  1–720 j, ~12 % des vues tombent hors de la fenêtre de 365 j (1 213 / 9 963 au tirage mesuré) ; la fenêtre est
  exercée.
- **D-12.5-4** : garde-fou du seeder : `environment = ['development']` ne protège pas (l'environnement de dev peut viser
  une base partagée) → `run()` refuse tout hôte de base hors boucle locale (`localhost`, `127.0.0.1`, `::1` :
  conteneur local et CI), **avant** la purge. Volontairement strict (sûr par défaut) : un nom de service Docker
  (`postgres`, `db`) ou un socket Unix est **refusé** aussi (publier le port du conteneur sur `127.0.0.1`) ; pas de
  variable de contournement. Limite connue : un tunnel `localhost` vers une base distante n'est pas détecté.
- **D-12.5-5** : **aucun index ajouté**. Les classements de productions balaient la table de stats (seq scan +
  agrégat) parce que la fenêtre de 365 j couvre 85–88 % des lignes : l'index (forcé) ne gagne que 128 → 96 ms à
  310 k vues, et le résultat est en cache 10 min. La requête auteurs utilise `idx_stats_views_production_id_recorded_at`
  (index-only scan) et `idx_production_authors_author_id` ; les suggestions, l'index unique du pivot. Un index
  `(recorded_at, production_id)` ne deviendrait utile que si la fenêtre devenait une petite fraction de l'historique
  (plusieurs années de stats) : à réévaluer alors, pas maintenant.
- **D-12.5-6** : mesures sur une base `anta_demo` créée dans le conteneur local `anta-test-db` (port 5433), jamais
  `anta_test` (que la suite suppose vide) ni la base partagée ; serveur = build de production local
  (`node bin/server.js`, `NODE_ENV=production`). Script de charge versé au dépôt (`scripts/perf/load.mjs`,
  revue) ; scripts de service et d'`EXPLAIN` hors dépôt (`/tmp/d37/serve-demo.sh`, `/tmp/d37/p125/explain.sql`). La base `anta_demo` est conservée en local (reproductible :
  `migration:run` + seeder avec `DB_DATABASE=anta_demo`).

## Mesures locales (AC 3, AC 4) — 2026-11-24

Environnement : VPS de dev partagé (4 vCPU, charge moyenne ~2,5 pendant les mesures), Postgres 16 Docker local,
un seul processus Node (comme `compose.yaml`). Valeurs indicatives, pas un banc isolé.

### `EXPLAIN (ANALYZE, BUFFERS)` — seeder démo (300 productions dont 250 publiées, 24 auteurs, 9 963 vues, 3 797 téléchargements)

| Requête | Plan (résumé) | Index 10.5 / pivot | Temps |
|---|---|---|---|
| Les plus consultées (`windowRanking`, vues) | Seq Scan `stats_views` (filtre fenêtre, 8 750 / 9 963 lignes) → Hash Join `productions` → HashAggregate → top-N heapsort | non (sélectivité 88 %) | 5,0 ms |
| Les plus téléchargées | idem sur `stats_downloads` (3 258 / 3 797) | non (86 %) | 3,3 ms |
| Auteurs les plus consultés (`topViewedAuthorIds`) | 8 auteurs visibles (semi-join `EXISTS`) × LATERAL : Bitmap `idx_production_authors_author_id` → Index Only Scan **`idx_stats_views_production_id_recorded_at`** (135 boucles) ; sous-plan `last_published_at` par `idx_production_authors_author_id` | oui | 8,5 ms |
| Suggestions (`SuggestionService.idsFor`) | Seq Scan des 250 publiées × sous-plans par candidate : pivot par `production_authors_production_id_position_unique`, tags / sous-domaines par `jsonb_array_elements_text` (Hash Semi Join) | pivot | 7,8 ms (4,7 ms mesurés côté serveur) |

### Montée en charge des stats (copie jetable `anta_demo_x`, supprimée : 309 963 vues, 103 797 téléchargements sur 3 ans)

| Requête | Plan | Temps |
|---|---|---|
| Les plus consultées | Parallel Seq Scan (2 workers) + HashAggregate ; index forcé (`enable_seqscan=off`) : Bitmap `idx_stats_views_recorded_at` → 96 ms | 128 ms (171 ms sans parallélisme) |
| Les plus téléchargées | Seq Scan + HashAggregate | 58 ms |
| Auteurs les plus consultés | Index Only Scan `idx_stats_views_production_id_recorded_at` (1 239 lignes × 135 boucles) | 72 ms |
| Suggestions | inchangé (ne lit pas les stats) | 5,6 ms |

Les trois classements sont calculés au plus une fois par 10 min (cache P2.3) : même à cette échelle, le coût par
rendu de l'accueil est nul hors expiration.

### Test de charge local (`scripts/perf/load.mjs`, `fetch` natif, 50 visiteurs virtuels, build de production, base `anta_demo`)

URLs : 8 recherches (`q`, avec tri / page) et 8 combinaisons de filtres (catégorie, domaine, langue, pays, licence,
tri, page). 0 erreur sur toutes les séries. Latence d'une requête isolée : 20–130 ms (listing), 25–80 ms (accueil).

| Scénario | Requêtes | Débit | p50 | p95 | p99 |
|---|---|---|---|---|---|
| Recherche, 50 visiteurs, réflexion 1–3 s | 1 000 | 21 req/s | 61 ms | **321 ms** | 551 ms |
| Filtres, 50 visiteurs, réflexion 1–3 s | 1 000 | 21 req/s | 61 ms | **463 ms** | 791 ms |
| Accueil, 50 visiteurs, réflexion 1–3 s | 1 000 | 22 req/s | 70 ms | 401 ms | 611 ms |
| Détail, 50 visiteurs, réflexion 1–3 s | 1 000 | 22 req/s | 30 ms | 128 ms | 242 ms |
| Suggestions, 50 visiteurs, réflexion 1–3 s | 1 000 | 21 req/s | 60 ms | 329 ms | 486 ms |
| Suggestions, vagues de 50 requêtes simultanées | 500 | 125 req/s | 341 ms | 533 ms | 545 ms |
| Recherche + filtres, vagues de 50 requêtes simultanées | 500 | 23 req/s | 874 ms | 1 721 ms | 1 796 ms |
| Recherche, saturation (50 requêtes toujours en vol) | 2 000 | 57 req/s | 834 ms | 1 267 ms | 1 461 ms |
| Filtres, saturation | 2 000 | 45 req/s | 967 ms | 1 991 ms | 2 802 ms |

Lecture : avec 50 visiteurs réels (temps de réflexion), **p95 < 0,5 s : NFR20 tenue** ; suggestions servies en
< 0,6 s même en rafale (budget client NFR18 : 2 s). À saturation (50 requêtes en vol en continu, sans pause), le
processus unique plafonne à ~45–57 req/s et le p95 dépasse 1 s (file d'attente : 50 / débit ≈ 0,9–1,1 s) —
**PO 2026-11-25 : la définition retenue est celle des visiteurs avec pauses (NFR20 tenue).** Pour mémoire ; si c'est la saturation qui est visée, il faudra
profiler le rendu du listing (piste, non mesurée : CPU Node du rendu Inertia / Edge et de l'hydratation) avant
d'envisager plusieurs processus (incompatible avec le cache local P2.3 sans revoir l'invalidation).

## Portes manuelles du PO (AC 5) — non exécutées (aucun accès distant depuis cette session)

- **Lighthouse mobile, 4G simulée, sur le staging** après déploiement de l'Epic 12 : accueil complet (bannière +
  4 blocs) et une page de détail ; attendu LCP < 3 s (NFR17) et section « Productions similaires » affichée < 2 s
  (NFR18 ; onglet Performance ou filmstrip). Résultats : —
- **Test de charge sur le staging partagé** (accord d'Aurélien requis) : `scripts/perf/load.mjs` (Node ≥ 18, sans
  dépendance ; usage et liste des URLs en en-tête), lancé depuis une machine hors du serveur :
  - visiteurs avec pauses : `node scripts/perf/load.mjs <URL du staging> 50 20 search 1000 3000`, puis `filters` ;
  - saturation : `node scripts/perf/load.mjs <URL du staging> 50 40 mix` ;
  - rafales : `node scripts/perf/load.mjs <URL du staging> 50 10 mix 1000 1000 1` ;
  - suggestions : `SLUGS=slug-a,slug-b node scripts/perf/load.mjs <URL du staging> 50 10 suggestions 0 0 1`.
  Attendu p95 < 1 s (NFR20) pour les visiteurs avec pauses (définition retenue par le PO le 2026-11-25). Résultat : —

## Review Findings

Revue de code du 2026-11-24 : 5 correctifs, 1 clarification, 3 questions PO.

- [x] [Review][Patch] Test « renommage » sans preuve par le résultat : les cartes sont réhydratées à chaque rendu, `['NOUVEAU']` s'affichait même sans invalidation [tests/functional/public/home.spec.ts] — réécrit : deux co-auteurs ex æquo départagés par le nom (D36), le renommage `ZED` → `ALPHA` ne fait passer l'auteur devant que par un recalcul ; vérifié par mutation (invalidation de `AuthorService.update` retirée **et** assertion `cachedKeys` neutralisée → échec sur l'ordre).
- [x] [Review][Patch] Script de charge hors dépôt, non reproductible par le PO → `scripts/perf/load.mjs` (sans dépendance, en-tête anglais : usage, URLs ; URL de base en argument ou `BASE_URL`, slugs par `SLUGS`, aucun hôte écrit) ; porte manuelle mise à jour avec les commandes.
- [x] [Review][Patch] `out_of_range` comparé à `now()`, figé au début de la transaction du test (instable) [tests/unit/seeders/production_demo_seeder.spec.ts] — `clock_timestamp()`.
- [x] [Review][Patch] Dates écrites par `toSQL({ includeOffset: false })` : sous un fuseau Node non UTC, une date pouvait tomber dans le futur [database/seeders/production_demo_seeder.ts] — `toISO()` (avec décalage) pour `recorded_at` / `downloaded_at` et `anta_published_at` (trois colonnes `timestamptz` : sûr) ; `created_at` / `updated_at` inchangés.
- [x] [Review][Patch] Garde-fou de base locale conservé strict (D-12.5-4) ; documenté dans le seeder et ici : noms de service Docker et sockets refusés volontairement, tunnel `localhost` vers une base distante non détecté.
- [x] [Review][PO] NFR20 : « 50 visiteurs simultanés » = visiteurs avec pauses (tenue : p95 321 / 463 ms en local) ou saturation continue (non tenue : p95 1,3–2 s) ? — PO 2026-11-25 : visiteurs avec pauses.
- [x] [Review][PO] Les classements de productions utilisent un seq scan et non les index de 10.5 (D-12.5-5) : justifié par la sélectivité (fenêtre = 85–88 % des stats) et le cache de 10 min ; l'AC « index utilisés » n'est tenue que pour la requête auteurs. — Accepté par le PO le 2026-11-25.
- [x] [Review][PO] « Ordre des props » réinterprété (D-12.5-2) : ordre du rendu (lecture de source) + ensemble exact des props, l'ordre des clés JSON n'étant pas un contrat. — Accepté par le PO le 2026-11-25.

## Questions ouvertes (non bloquantes)

1. ~~`[PO]` NFR20 : définition de « 50 visiteurs simultanés »~~ — tranché le 2026-11-25 : visiteurs avec temps de réflexion.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Premier essai d'un test « ordre des clés des props » : échec (`featured`, `topAuthors`, … avant `recent`) →
  l'ordre de sérialisation n'est pas un contrat (D-12.5-2), test réécrit sur l'ensemble exact des props. Un échec
  isolé du test voisin « props : featured, recent… » (préexistant) au même passage, non reproduit sur 3 passages du
  fichier ni sur la suite complète — cause probable : deux `test:local` lancés en parallèle (preuves par mutation en
  arrière-plan) partageant `PORT=3333` et la base `anta_test`.
- Preuves d'échec (invalidation remplacée temporairement par `void 0`, fichier restauré, `git diff app/` vide) :
  `ProductionAuthorService.sync` → « PUT … authorIds modifiés » échoue ; `AuthorService.update` → « case
  consentement » et « renommage » échouent ; `confirmConsent` → « confirm-consent » échoue ; `delete` → « DELETE …
  fiche non liée » échoue.
- Seeder : premier jet de `randomStatDate` laissait passer une date de publication future → bornée à `now`, testé.
- Base de mesure : `CREATE DATABASE anta_demo` (conteneur local), `migration:run` + seeder via
  `/tmp/d37/local.sh env DB_DATABASE=anta_demo …` ; requêtes exactes relevées par `log_min_duration_statement = 0`
  sur cette base seulement (réinitialisé ensuite) ; copie `anta_demo_x` (stats ×30) supprimée après mesure. Serveur
  de production local arrêté (port libre vérifié).
- Suite complète `npm run test:local` : **1454 tests verts** (baseline 1444, +10), code 0. `npm run lint` : 0.
  `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, aucun codegen, rien contre Supabase ni
  R2.

- Revue : script de charge vérifié contre le serveur local (`suggestions` avec `SLUGS`, `mix` avec `BASE_URL`, 0
  erreur ; sans URL → code 2), serveur arrêté. Suite complète : **1454 tests verts, code 0 ; lint 0 ; typecheck 0 ; build 0**.

### Completion Notes List

- Inventaire : toutes les puces de l'AC 1 étaient couvertes sauf l'invalidation **par HTTP** de `sync`, de la
  confirmation du consentement (bouton et case), de la modification et de la suppression d'une fiche, et l'ensemble
  exact des props de l'accueil.
- `home.spec.ts` (+7) : props exactes ; 6 tests d'invalidation par les routes admin, chacun prouvé par un recalcul
  observable (auteur ajouté au pivot ou devenu public qui entre dans le bloc) ou par `cachedKeys()` quand le
  classement ne change pas (renommage, suppression d'une fiche non liée), et les cas négatifs (pivot inchangé,
  suppression refusée → cache conservé).
- Seeder de démo : stats datées sur 540 j (jamais avant la publication), garde-fou de base locale avant toute
  écriture ; `production_demo_seeder.spec.ts` (+3).
- `EXPLAIN ANALYZE` et test de charge locaux consignés ci-dessus ; aucun index manquant (D-12.5-5) ; NFR20 tenue
  avec temps de réflexion, dépassée à saturation (question PO).
- Lighthouse et charge sur le staging : portes manuelles, consignées ici et dans `deferred-work.md`.
- **Aucun code produit modifié** (hors seeder) ; aucun bug produit révélé.

### File List

- `tests/functional/public/home.spec.ts` (modifié)
- `tests/unit/seeders/production_demo_seeder.spec.ts` (modifié)
- `database/seeders/production_demo_seeder.ts` (modifié)
- `scripts/perf/load.mjs` (nouveau, revue)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié : portes 12.5)
- `_bmad-output/implementation-artifacts/12-5-tests-accueil-classements-suggestions-et-performance.md` (nouveau)

## Change Log

- 2026-11-24 : création (bmad-create-story), inventaire de couverture ; statut ready-for-dev.
- 2026-11-24 : implémentation (bmad-dev-story) : invalidation par HTTP de `sync`, consentement, fiche modifiée /
  supprimée ; props exactes de l'accueil ; seeder 540 j + garde-fou de base locale ; `EXPLAIN ANALYZE` et charge
  locale consignés ; 1454 tests verts, lint, typecheck, build ; statut review.
- 2026-11-24 : revue de code — 5 correctifs (test de renommage prouvé par l'ordre, `scripts/perf/load.mjs`,
  `clock_timestamp()`, dates `toISO()`, garde-fou documenté), 3 questions PO ; 1454 tests verts, lint, typecheck, build ; statut done.
- 2026-11-25 : décisions PO — NFR20 = visiteurs avec pauses ; seq scan des classements (D-12.5-5) et « ordre des props » (D-12.5-2) acceptés.
