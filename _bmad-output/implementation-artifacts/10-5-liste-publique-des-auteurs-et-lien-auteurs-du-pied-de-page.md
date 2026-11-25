---
baseline_commit: 07e9990
---

# Story 10.5 : Liste publique des auteurs et lien « Auteurs » du pied de page

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur,
je veux parcourir, rechercher et filtrer la liste des auteurs,
afin de trouver un auteur et ses productions (FR57, FR60, FR44, D3, D13, D14, D31, D34).

## Décision de périmètre (lire en premier)

- **Une migration additive** : `database/migrations/1775918751000_add_stats_window_indexes.ts` (3 index, `CREATE INDEX` simple dans la transaction, pas de `CONCURRENTLY`, `down()` écrit mais jamais exécuté). Les migrations 48/49 (Epic 11) n'existent pas encore : le nom 51 suit le plan P2.1 ; le migrateur Lucid exécute tout fichier absent de `adonis_schema`, l'ordre d'arrivée ne bloque pas. Aucune colonne → `database/schema.ts` inchangé (régénéré par `migration:run`, à commiter s'il bouge).
- **Une nouvelle route publique** `GET /authors` (`authors.index`, `AuthorsController.index`) **déclarée avant** `/authors/:slug` → régénérer `.adonisjs` (`/tmp/d37/gen.sh`) et le commiter. Aucune dépendance npm.
- **Visibilité à source unique** : la liste part de `Author.query().withScopes(s => s.visibleOnSite())` (10.4). Les facettes (institution, domaine) ne portent que sur les auteurs visibles. Aucun champ interne exposé (ni `id` hors `photoBase`, ni `photo_key`, ni consentement).
- **Recherche** : réutiliser `AuthorService.applyListFilters(query, { q, institution, consent: null, incomplete: false })` (9.2) : `q` normalisé (`normalizeKey`), `search_name LIKE '%t%'` OU `similarity > 0.3` ; `institution` normalisée en `institution_key`, sur **toutes** les affiliations (`whereExists`). Pas de nouveau prédicat de recherche.
- **Requête unique paginée, sans N+1** : agrégats en sous-requêtes corrélées dans le `SELECT` (nb de productions publiées, vues totales, vues 365 j, institution principale), `paginate(page, 24)`. `photoBase` via `MediaService.authorPhotoUrl`.
- **SEO** : `SeoService.authorsList(locale)` livré en **forme minimale** (titre « Auteurs — Anta », description = phrase d'introduction) pour que le titre d'onglet suive (`<Head>` de `PublicLayout`, 10.4) ; tests `seo.spec.ts` / `og:*` complets en 10.7.
- **Reports intégrés** : lien « Auteurs » de la NotFoundPage (D-10.1-5) et niveau « Auteurs » du fil d'Ariane du profil (10.3).
- **Hors périmètre** : « Voir plus » du bloc auteurs de l'accueil (Epic 12), filtre `author=<slug>` du listing (10.6), `og:image` (10.7), migration du listing vers `SortSelect` (12.1).
- Aucun nom réel dans le code, les tests ou les textes ; noms fictifs (« Jeanne EXEMPLE »).

## Acceptance Criteria

1. **Migration** — Given `1775918751000_add_stats_window_indexes.ts`, When elle est exécutée, Then `idx_stats_views_production_id_recorded_at (production_id, recorded_at)`, `idx_stats_downloads_production_id_downloaded_at (production_id, downloaded_at)` et `idx_stats_downloads_downloaded_at (downloaded_at)` existent (création simple, sans `CONCURRENTLY`).
2. **Page** — Given `GET /authors` (`authors.index`), When `inertia/pages/authors.tsx` s'affiche (maquette `authors-list.html`), Then elle présente un seul `h1` « Auteurs », la phrase « Les auteurs des productions publiées sur Anta. », `AuthorFilters`, puis les `AuthorCard` des seuls auteurs visibles en grille 1 / 2 (sm) / 3 (lg) / 4 (xl) colonnes, dans le conteneur `max-w-7xl` du layout (D31), **24 par page**.
3. **AuthorCard** — `Avatar` taille `md` (`alt=""`, photo via `photoBase`, sinon initiales), « Prénom NOM » (`formatAuthorName`) dans le **seul** lien de la carte (vers `authors.show`), étendu à la carte (stretched link `after:absolute after:inset-0`, carte `relative`, jamais de carte `onClick`), l'institution principale (affiliation `position` 1 ; élément non rendu si aucune), le nombre de productions publiées et le **total** des vues de ses productions publiées (D3), au pluriel i18next.
4. **AuthorFilters** — recherche par nom (`q`, soumission par Entrée), Institution (sélection unique, « Toutes les institutions »), Domaine des productions (sélection unique, « Tous les domaines »), Tri (`SortSelect`) ; libellés visibles ; contrôles ≥ 44 px. La recherche est insensible à la casse et aux accents ; la facette institution porte sur toutes les affiliations des auteurs visibles, dédoublonnées par `institution_key`, libellé = graphie la plus fréquente (`mode() WITHIN GROUP`, D14) ; la facette domaine = domaines des productions publiées liées à un auteur public ; filtrer par domaine garde les auteurs ayant ≥ 1 production publiée de ce domaine. Tout changement ramène à la page 1 ; l'état est dans l'URL, valeurs par défaut omises (`sort=views`, `page=1`, filtres vides).
5. **Compteur** — « {n} auteurs · {début}–{fin} » (pluriel : « 1 auteur · 1–1 ») dans un élément `aria-live="polite"`.
6. **Tris** — `views` (défaut, « Les plus consultés (12 derniers mois) ») = vues des 365 derniers jours ↓ (expression P2.3 sans `HAVING` : un auteur à 0 vue figure en fin de liste ; vues hors fenêtre ignorées) ; `name` (« Nom (A → Z) ») = nom de famille puis prénom ; `productions` (« Nombre de productions ») = nb de productions publiées ↓ puis nom ; ex æquo : nom de famille, puis prénom, puis `id` (pagination stable). Valeur inconnue → défaut.
7. **États vides** — aucun profil visible (sans filtre) → « Aucun auteur pour le moment. » (barre de filtres masquée) ; filtres sans résultat → « Aucun auteur ne correspond à votre recherche. » + bouton-lien « Effacer les filtres » (vers `/authors`).
8. **Pagination** — numérotée (`Pagination`, liens réels, `aria-current="page"`), conserve filtres et tri, cibles ≥ 44 px ; page hors limites → 302 vers la dernière page en conservant les paramètres connus ; `page` invalide (`0`, `-1`, `abc`, `1.5`, `1e21`) vaut 1.
9. **Pied de page** — la colonne « Explorer » de toutes les pages publiques contient, dans l'ordre : Accueil, « Recherche avancée » (destination `/productions` inchangée), « Auteurs » (`/authors`), Politique de confidentialité (FR60, FR44, D34).
10. **NotFoundPage et fil d'Ariane** — la NotFoundPage gagne le lien « Auteurs » (`<a href="/authors">`, ≥ 44 px ; ordre Accueil / Auteurs / Recherche avancée, clé dans les locales publiques **et** admin) ; le fil d'Ariane du profil devient « Accueil / Auteurs / {Prénom NOM} » (séparateur « / », D-10.3-1).
11. **Tests** — functional `tests/functional/public/authors_list.spec.ts` : seuls les auteurs visibles (sans consentement, sans production publiée exclus), forme des props (aucun champ interne), recherche sans accents ni casse, facette institution dédoublonnée (deux graphies → une option, graphie majoritaire) et filtre sur une affiliation secondaire, facette et filtre domaine, trois tris et ex æquo, vues hors fenêtre de 366 j ignorées par le tri par défaut mais comptées dans le total, 24/page, page hors limites → 302 avec paramètres, `page` invalide, états vides ; migration (index présents dans `pg_indexes`) ; unitaires : `SeoService.authorsList`, composants par lecture de source (lien étendu unique, `alt=""`, `aria-live`, ≥ 44 px, pied de page, 404, fil d'Ariane), helpers d'URL, clés i18n FR/EN. Lignes créées annulées (transaction globale).

## Tasks / Subtasks

- [x] T1 — Migration des index (AC 1) + test `pg_indexes`.
- [x] T2 — Service `PublicAuthorService` (AC 2–8)
  - [x] `AUTHORS_LIST_SORTS = ['views','name','productions']`, `DEFAULT_AUTHORS_LIST_SORT = 'views'`, `AUTHORS_LIST_PER_PAGE = 24`, `parseListSort`, `parseListFilters` (chaînes seulement, `trim`, `q` ≤ 100 caractères).
  - [x] `list(filters, sort, page)` : scope `visibleOnSite` + `AuthorService.applyListFilters` + filtre domaine (`whereExists` pivot ⨝ productions publiées du domaine) ; `SELECT` des colonnes utiles + sous-requêtes `published_count`, `total_views`, `window_views` (365 j), `primary_institution` ; tris AC 6 ; `paginate`.
  - [x] `institutionOptions()` (auteurs visibles, `mode() WITHIN GROUP`), `domainOptions()` ; `hasVisibleAuthors()` (seulement si 0 résultat avec filtres).
  - [x] `authorsListPath(filters, sort, page)` (miroir front).
- [x] T3 — `AuthorsController.index` + route `authors.index` avant `authors.show` ; 302 hors limites ; props `authors`, `pagination`, `filters`, `sort`, `institutionOptions`, `domainOptions`, `hasAuthors`, `meta`. `/tmp/d37/gen.sh`, commit `.adonisjs`.
- [x] T4 — `SeoService.authorsList` (forme minimale) + tests unitaires.
- [x] T5 — Front
  - [x] `inertia/lib/authors_list_query.ts` (état ↔ URL, défauts omis, page 1).
  - [x] `inertia/components/public/AuthorCard.tsx`, `AuthorFilters.tsx`, page `inertia/pages/authors.tsx`.
  - [x] `Pagination` : prop `size?: 'default' | 'touch'` (≥ 44 px), utilisée par la liste et le profil (admin inchangé).
  - [x] `PublicLayout` (pied de page), `errors/not_found.tsx` (lien Auteurs), `AuthorProfileHeader` (fil d'Ariane).
  - [x] Locales `authors.list.*`, `nav.advanced_search`, `nav.authors`, `not_found.authors` (public + admin), `authors.profile.breadcrumb_authors` FR/EN.
- [x] T6 — Tests (AC 11), lint, typecheck, build, suite complète (baseline 922).

## Dev Notes

### État actuel (fichiers UPDATE, lus)

- `app/controllers/public/authors_controller.ts` : `show` seulement (profil, 404 `notFound()` privé, 302 hors limites via `PublicAuthorService.profilePath`). Ajouter `index` sans toucher `show`.
- `app/services/public_author_service.ts` : `visibleSlugs`, `findVisibleBySlug` (scope), `stats`, `productions`, `parseSort`, `parsePage` (entier sûr — réutiliser), `safeHttpUrl`, `profilePath`. Ajouter la partie liste.
- `app/models/author.ts` : scope `visibleOnSite` (consentement + `whereHas('productions', published)`) — **seule** définition de la visibilité.
- `app/services/author_service.ts` : `applyListFilters` (q + institution, préfixe `authors.`), `institutionOptions` (toutes fiches, admin — ne pas réutiliser tel quel : la liste publique doit limiter aux auteurs visibles).
- `start/routes.ts` : `/authors/:slug` (`authors.show`) ; insérer `/authors` avant (pas de conflit de motif, mais ordre lisible).
- `inertia/layouts/PublicLayout.tsx` : pied de page « Explorer » = Accueil, `nav.search` (« Rechercher »), Politique ; `<Head>` du titre (10.4) ; `main` déjà `max-w-7xl`.
- `inertia/pages/errors/not_found.tsx` : deux liens `<a href>` (`LINK_BASE` `min-h-11`), rendue aussi par le bundle admin (locales admin `not_found.*`) ; test `not_found_page.spec.ts` attend 2 liens → passer à 3.
- `inertia/components/public/AuthorProfileHeader.tsx` : fil d'Ariane `Accueil / {nom}` (séparateur `/` `aria-hidden`).
- `inertia/components/shared/Pagination.tsx` : `h-9 min-w-9` (36 px), partagé avec l'admin → variante `touch` (`h-11 min-w-11`).
- `inertia/components/shared/SortSelect.tsx` : label visible « Trier par », `min-h-11`, `onChange`.
- `inertia/components/shared/Avatar.tsx` : tailles `sm`/`md` (56 px)/`lg`, `alt=""` par défaut, `loading="lazy"`.

### Garde-fous

- SQL : jamais d'interpolation de valeur ; `now() - interval '365 days'` côté Postgres ; sous-requêtes limitées aux productions `published` ; PK du pivot → pas de doublon.
- `ORDER BY` sur les alias de sous-requêtes (`window_views`, `published_count`) ; Lucid `paginate` compte sur une requête clonée sans `ORDER BY`.
- Radix `Select` refuse `value=""` : sentinelle `__all__` (comme l'admin).
- URL : `institution` = **libellé** (P2.6 « libellé, normalisé en `institution_key` ») ; le serveur renvoie le libellé canonique de l'option correspondante.
- `inertia/` testé par lecture de source (TS6305) ; chaque clé i18n en FR **et** EN (et admin pour `not_found.authors`).
- Japa : `.redirects(0)` pour la 302 ; props lues dans `data-page` ; `db.beginGlobalTransaction()` par test.
- Vues datées : `StatsView.create({ recordedAt: DateTime.now().minus({ days: 366 }) })`.

### Décisions par défaut (D-10.5-x)

- **D-10.5-1** `institution` dans l'URL = libellé (lisible, partageable), normalisé côté serveur.
- **D-10.5-2** Avec une recherche `q`, le tri choisi s'applique (pas de tri par pertinence ; correspondances approchantes `similarity > 0.3` incluses, comme l'admin).
- **D-10.5-3** `SeoService.authorsList` minimal dès 10.5 (titre d'onglet) ; 10.7 complète (tests SEO, `twitter:card`).
- **D-10.5-4** Fil d'Ariane : séparateur « / » (D-10.3-1) plutôt que « › » de l'AC.
- **D-10.5-5** Aucun auteur visible : barre de filtres masquée, seul le message est affiché (EXPERIENCE.md « h1 + message »).
- **D-10.5-6** Facette domaine = domaines non vides des productions publiées liées à un auteur public (toute production publiée liée rend l'auteur visible).
- **D-10.5-7** `Pagination` gagne `size="touch"` (44 px) pour les listes publiques auteurs et profil ; l'admin garde 36 px.
- **D-10.5-8** `q` tronqué à 100 caractères ; paramètres non chaînes (tableaux) ignorés.

### Review Findings

- [x] [Review][Patch] Confidentialité des facettes non testée [tests/functional/public/authors_list.spec.ts] — auteur consentant dont la seule production est un brouillon (institution + domaine) absent de la liste et des facettes ; domaine d'un brouillon d'un auteur visible absent de `domainOptions`. Vérifié rouge en cassant temporairement le prédicat (scope remplacé par le seul consentement ; statut retiré de la facette domaine).
- [x] [Review][Patch] Règle de visibilité réécrite en SQL brut dans les facettes [app/services/public_author_service.ts] — `institutionOptions`, `domainOptions` et `hasVisibleAuthors` filtrent par `whereIn(author_id, visibleAuthorIds())` (sous-requête du scope `Author.visibleOnSite`) ; test de source (aucun prédicat de consentement réécrit).
- [x] [Review][Patch] Sélections et tri envoyaient le `q` du serveur [inertia/components/public/AuthorFilters.tsx] — `change(patch)` transmet la saisie courante (`trim` ou `null`) ; test de source.
- [x] [Review][Patch] Isolation des tests [authors_list.spec.ts] — groupes visibilité et recherche vident le pivot comme le groupe des tris (assertions exactes) ; assertions de source renforcées (classe d'extension dans la balise du lien, contenu de l'élément `aria-live`, défilement).
- [x] [Review][Patch] Défilement après un changement de filtre ou de tri [inertia/pages/authors.tsx] — retour en haut des résultats (`#authors-results`, `scroll-mt-24`) quand ils commencent au-dessus de la fenêtre ; le profil (10.3) le faisait déjà (D-10.3-4).
- [x] [Review][Patch] Troncature de `q` par unités UTF-16 [public_author_service.ts] — `Array.from(q).slice(0, 100)` (points de code) ; test avec émojis.
- [x] [Review][Patch] Institution ou domaine inconnus dans l'URL [authors_controller.ts, public_author_service.ts] — `knownFilters` : facettes chargées d'abord, valeur inconnue → `null` et aucun filtrage (props, sélections, résultats et redirection hors limites cohérents) ; tests.
- [x] [Review][Patch] Compteur non formaté [authors.tsx, locales] — `toLocaleString` comme les cartes (`formattedCount`, `from`, `to`).
- [x] [Review][Patch] Deux balayages des vues [public_author_service.ts] — un seul `LEFT JOIN LATERAL` (`count(*)` + `count(*) FILTER (fenêtre 365 j)`).
- [x] [Review][Patch] Clé `authors.list.search_submit` inutilisée — retirée (FR/EN).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.5] ; en-tête Epic 10 (visibilité) ; 10.6/10.7/12.x hors périmètre.
- [Source: architecture.md#P2.1] (index statistiques, normalisation), #P2.3 (vues 365 j, tris de la liste), #P2.6 (`/authors` : `q`, `institution`, `domain`, `sort`, 24/page, facette `mode()`, 302 hors limites).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Liste des auteurs, Pied de page, AuthorCard, AuthorFilters, Pagination, NotFoundPage, Voice and Tone (tris, compteurs, états vides), Accessibilité (stretched link, 44 px).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] AuthorCard, AuthorFilters, NotFoundPage ; [mockups/authors-list.html].
- [Source: 10-1-…md] (D-10.1-5), [10-3-…md] (fil d'Ariane, `parsePage`, `SortSelect`), [10-4-…md] (scope `visibleOnSite`, `<Head>`), [9-2-…md] (`applyListFilters`, `institutionOptions`).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Tests fonctionnels (`authors_list.spec.ts`, 21) écrits avant le service et le contrôleur (route absente → rouge attendu, non exécutés avant le code) ; premier passage après implémentation : 21/21 verts. Tests de source : 1 échec corrigé (le mot « onClick » figurait dans un commentaire ; l'assertion vise `onClick=`).
- Suite complète : 964 tests verts (baseline 922, +42). `npm run lint`, `npm run typecheck`, `/tmp/d37/build.sh` : code de sortie 0. `/tmp/d37/gen.sh` : registre Tuyau, `pages.d.ts`, `routes.d.ts` régénérés (route `authors.index`, page `authors`). `database/schema.ts` inchangé (index seulement).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Migration `1775918751000_add_stats_window_indexes.ts` : 3 index (P2.1), `CREATE INDEX` simple ; test `pg_indexes`.
- `PublicAuthorService.list` : scope `visibleOnSite` + `AuthorService.applyListFilters` (recherche normalisée, institution sur toutes les affiliations) + filtre domaine (`whereExists` pivot ⨝ productions publiées) ; une requête paginée (24) avec sous-requêtes corrélées `published_count`, `total_views`, `window_views` (365 j, Postgres), `primary_institution` ; tris `views` / `name` / `productions`, ex æquo nom, prénom, `id`. Facettes `institutionOptions` (auteurs visibles, `mode() WITHIN GROUP`, valeur = libellé) et `domainOptions` ; `hasVisibleAuthors` seulement si 0 résultat filtré ; `parseListFilters` (chaînes seulement, `q` ≤ 100), `parseListSort`, `canonicalInstitution`, `authorsListPath`.
- `AuthorsController.index` + route `authors.index` (avant `authors.show`) : 302 hors limites avec paramètres connus, `parsePage` réutilisé, `photoBase` via `MediaService.authorPhotoUrl`, aucun champ interne.
- `SeoService.authorsList` minimal (titre « Auteurs — Anta », description = introduction) ; 10.7 complète.
- Front : `AuthorCard` (lien unique étendu, avatar `md` `alt=""`, institution omise si absente, compteurs au pluriel formatés), `AuthorFilters` (recherche par Entrée, institution et domaine à sélection unique avec sentinelle, libellés de taxonomie pour les domaines, `SortSelect`, 44 px), page `authors.tsx` (compteur `aria-live`, deux états vides, « Effacer les filtres »), helpers `authors_list_query.ts` (miroir serveur), `Pagination size="touch"` (liste et profil).
- Reports intégrés : pied de page « Explorer » (Accueil, Recherche avancée, Auteurs, Politique), lien « Auteurs » de la NotFoundPage (locales publiques et admin), niveau « Auteurs » du fil d'Ariane du profil. Clé `nav.search` remplacée par `nav.advanced_search` (test i18n mis à jour).
- Décisions D-10.5-1 à D-10.5-8 appliquées.

### File List

- database/migrations/1775918751000_add_stats_window_indexes.ts (nouveau)
- app/services/public_author_service.ts
- app/controllers/public/authors_controller.ts
- app/services/seo_service.ts
- start/routes.ts
- .adonisjs/client/registry/index.ts
- .adonisjs/client/registry/schema.d.ts
- .adonisjs/client/registry/tree.d.ts
- .adonisjs/server/pages.d.ts
- .adonisjs/server/routes.d.ts
- inertia/pages/authors.tsx (nouveau)
- inertia/components/public/AuthorCard.tsx (nouveau)
- inertia/components/public/AuthorFilters.tsx (nouveau)
- inertia/lib/authors_list_query.ts (nouveau)
- inertia/components/shared/Pagination.tsx
- inertia/components/public/AuthorProfileHeader.tsx
- inertia/layouts/PublicLayout.tsx
- inertia/pages/errors/not_found.tsx
- inertia/pages/author.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/functional/public/authors_list.spec.ts (nouveau)
- tests/unit/components/authors_list.spec.ts (nouveau)
- tests/unit/components/not_found_page.spec.ts
- tests/unit/components/author_profile.spec.ts
- tests/unit/services/seo_service.spec.ts
- tests/unit/i18n/instances.spec.ts
- _bmad-output/implementation-artifacts/10-5-liste-publique-des-auteurs-et-lien-auteurs-du-pied-de-page.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

1. Avec une recherche `q`, le tri choisi (défaut : vues 12 mois) s'applique, correspondances approchantes (`similarity > 0.3`) comprises : préférer un tri par pertinence quand `q` est renseigné ?
2. `institution` dans l'URL = libellé lisible (normalisé côté serveur) : convient-il (l'admin utilise la clé) ?
3. Aucun auteur visible : la barre de filtres est masquée (seul « Aucun auteur pour le moment. » s'affiche) — conforme ?
4. Pagination publique passée à 44 px (liste et profil) ; l'admin reste à 36 px : à généraliser ?

## Change Log

- 2026-11-19 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-19 : implémentation (`GET /authors`, index des fenêtres de statistiques, `AuthorCard`, `AuthorFilters`, pied de page, 404, fil d'Ariane) ; 964 tests verts ; statut review.
- 2026-11-19 : revue de code — 10 correctifs (facettes par le scope partagé et tests de confidentialité, `q` saisi transmis, isolation des tests, défilement, troncature par points de code, filtres inconnus ignorés, compteur formaté, LATERAL unique, clé inutilisée) ; statut done.
