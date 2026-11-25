---
baseline_commit: 8f7ac86
---

# Story 10.3 : Page de profil d'un auteur

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur,
je veux consulter le profil d'un auteur et la liste de ses productions publiées,
afin de découvrir son travail et ses affiliations (FR58, FR53, D11, D15, D17).

## Décision de périmètre (lire en premier)

- Story **sans migration, sans dépendance npm**. Une nouvelle route publique `GET /authors/:slug` (`authors.show`) → régénérer `.adonisjs` (`/tmp/d37/gen.sh`) et le commiter. **Pas** de `GET /authors` (Story 10.5) : le fil d'Ariane est « Accueil / {Prénom NOM} » (le niveau « Auteurs » arrive en 10.5).
- **Visibilité (P2.1, D11)** : visible = `consent_confirmed_at IS NOT NULL` **et** ≥ 1 production `published` liée par `production_authors`. Tout le reste → NotFoundPage (statut 404, `SeoService.notFound`), exactement comme `ProductionsController.show`. Aucun cache : un retrait de consentement ou la dépublication de la dernière production donne 404 au rechargement suivant (D17).
- **Cartes** : transformer unique `app/transformers/production_card_transformer.ts` (`BaseTransformer` d'AdonisJS 7, comme `user_transformer.ts`) qui remplace les deux `serialize()` de `home_controller.ts` et `productions_controller.ts` **sans changer les props** (`authors: string[]` = `authorNames`, toujours). Les liens d'auteurs (`{ name, slug | null }[]`, `AuthorByline`) sont la Story 10.4 : sur le profil, la byline reste du texte simple (le propre nom de l'auteur l'est donc déjà).
- **SEO** : la page publique n'a pas de `<Head>` ; son titre vient du serveur. Livrer ici la forme minimale de `SeoService.forAuthor(locale, author, appUrl)` (titre « Prénom NOM — Anta », description « {institution principale} — {n} productions publiées sur Anta », `ogType: 'profile'`, `ogUrl`). `ogImage`/`twitter:card` (edge) et `authorsList` restent en Story 10.7.
- Aucun nom réel dans le code, les tests ou les textes ; noms fictifs (« Jeanne EXEMPLE »).

## Acceptance Criteria

1. **Route et page** — Given `GET /authors/:slug` (`authors.show`, `app/controllers/public/authors_controller.ts`), When le slug correspond à un auteur visible, Then la page Inertia `author` (`inertia/pages/author.tsx`) est rendue (statut 200, maquette `author-profile.html`, conteneur `max-w-6xl` avec aside statistiques à droite dès `lg`, D35).
2. **404** — Given un slug inconnu, un auteur sans consentement, un auteur sans production publiée (brouillon seulement), un auteur dont le consentement vient d'être retiré ou dont la dernière production vient d'être dépubliée, When l'URL est demandée, Then la NotFoundPage (`errors/not_found`) est rendue avec le statut 404 et le titre traduit (D11, D17) ; aucune donnée de l'auteur n'est présente dans la réponse.
3. **En-tête** — Given un profil visible, When `AuthorProfileHeader` se rend, Then il affiche l'`Avatar` taille `lg` (photo via `photoBase` = `MediaService.authorPhotoUrl`, `alt="Photo de {Prénom NOM}"`, sinon initiales), le nom en `h1` « Prénom NOM » (nom de famille en capitales, `formatAuthorName`), les affiliations dans l'ordre `position` (« Institution — Département », département seulement s'il existe), le lien Google Scholar seulement s'il existe (icône + « Google Scholar », `target="_blank"`, `rel="noopener noreferrer"`, texte masqué « (nouvel onglet) », D15).
4. **Statistiques** — l'aside `aria-label="Statistiques de l'auteur"` présente le total des vues, le total des téléchargements et le nombre de productions publiées, suivis de « Totaux des productions publiées. » ; seules les productions publiées comptent ; un champ facultatif absent (photo, Scholar, département) ne laisse aucun trou visuel (élément non rendu).
5. **Fil d'Ariane** — `<nav aria-label="Fil d'Ariane">` « Accueil / {Prénom NOM} », la page courante marquée `aria-current="page"`.
6. **Productions** — la section `h2` « Productions » liste les productions publiées de l'auteur, 12 par page, en `ProductionCard` (grille 1 / 2 (sm) / 3 (lg) colonnes), avec le compteur « {n} productions publiées · {début}–{fin} » et le `SortSelect` : `date` (défaut, omis de l'URL) = date de publication de l'œuvre ↓ (sans date en dernier), `views` = vues totales ↓, `downloads` = téléchargements totaux ↓, `title` = titre A → Z ; départage stable (`id`). Une valeur de tri inconnue retombe sur le défaut.
7. **Tri et pagination** — un changement de tri remet la page à 1 ; la `Pagination` numérotée conserve le tri ; une page hors limites redirige (302) vers la dernière page en conservant le tri (D36) ; un paramètre `page` invalide (`0`, `-1`, `abc`, `1.5`, `1e21`) vaut 1.
8. **Transformer** — les cartes de la page, de l'accueil et du listing sont sérialisées par `ProductionCardTransformer` ; les props actuelles de `home` et `productions` sont inchangées (mêmes clés et valeurs).
9. **i18n et accessibilité** — libellés FR/EN dans `authors.profile.*` de `inertia/locales/public/{fr,en}.json` (EXPERIENCE.md, Voice and Tone) ; un seul `h1` ; contrôles ≥ 44 px (lien Scholar `min-h-11`).
10. **Tests** — functional `tests/functional/public/author_profile.spec.ts` (200 visible + props, 404 × 5 cas, quatre tris, pagination 12/page, page hors limites → 302 avec tri conservé, totaux limités aux productions publiées, aucune donnée d'auteur non public, meta) ; unitaires `SeoService.forAuthor`, transformer ; composants par lecture de source (`alt`, `aria-current`, « (nouvel onglet) », `rel`, `SortSelect`) ; clés i18n présentes FR/EN. Les lignes créées sont supprimées (transaction globale annulée).

## Tasks / Subtasks

- [x] T1 — Transformer `app/transformers/production_card_transformer.ts` (AC 8)
  - [x] `toObject()` → `{ id, slug, title, authors: authorNames ?? [], category, domain, summary, viewsCount, downloadsCount, publishedAt }` (Number() des `$extras`, `antaPublishedAt?.toISO() ?? null`).
  - [x] `home_controller.ts` et `productions_controller.ts` (`index`, résultats approchants compris) : `ProductionCardTransformer.transform(rows)` ; suppression des `serialize()` et du type `ProductionCardProps`.
  - [x] Régénérer `.adonisjs` (le transformer est indexé dans `.adonisjs/client/data.d.ts`).
- [x] T2 — Service `app/services/public_author_service.ts` (AC 1, 2, 4, 6, 7)
  - [x] `findVisibleBySlug(slug)` : `consent_confirmed_at IS NOT NULL` + `whereHas('productions', status = published)`, préchargement `affiliations` (ordre `position`).
  - [x] `stats(authorId)` : une requête, trois sous-requêtes (`productions`, `views`, `downloads`) limitées aux productions publiées.
  - [x] `productions(authorId, sort, page, perPage)` : `whereExists` sur le pivot, agrégats `viewsCount`/`downloadsCount`, tris AC 6, `paginate`.
  - [x] `AUTHOR_PROFILE_SORTS`, `parseSort`, `parsePage`.
- [x] T3 — `AuthorsController.show` + route `authors.show` (AC 1, 2, 7)
  - [x] 404 = `response.status(404)` + `errors/not_found` avec `SeoService.notFound(locale)`.
  - [x] Hors limites → `response.redirect().toPath(...)` 302 (tri non défaut conservé, `page` omis si 1).
  - [x] Props : `author { slug, firstNames, lastNames, photoBase, googleScholarUrl, affiliations[{ institution, department }] }`, `stats`, `productions`, `pagination`, `sort`, `meta`.
  - [x] `/tmp/d37/gen.sh`, commit de `.adonisjs`.
- [x] T4 — `SeoService.forAuthor` (forme minimale, sans `ogImage`) + tests unitaires.
- [x] T5 — Front (AC 3–7, 9)
  - [x] `inertia/components/shared/SortSelect.tsx` (label visible « Trier par » lié au `Select` shadcn, options `{ value, label }`, `onChange`).
  - [x] `inertia/components/public/AuthorProfileHeader.tsx` (fil d'Ariane, avatar, h1, affiliations `Building2`, lien Scholar `GraduationCap` + `ExternalLink`, aside stats `Eye`/`Download`/`BookOpen`).
  - [x] `inertia/pages/author.tsx` (header + section Productions, compteur, tri, grille, `Pagination`).
  - [x] `inertia/lib/author_profile_query.ts` (helpers purs : `sortHref`, `pageHref`, défaut omis).
  - [x] Locales `authors.profile.*` FR/EN.
- [x] T6 — Tests (AC 10) puis lint, typecheck, build, suite complète (baseline 853).

## Dev Notes

### État actuel (fichiers UPDATE, lus)

- `app/controllers/public/home_controller.ts` : `publishedWithCounts()` + `serialize()` locaux, props `mostViewed`, `recent`, `categories`, `meta`. À préserver tel quel hors sérialisation (refonte = Epic 12).
- `app/controllers/public/productions_controller.ts` : `serialize()` (cartes) et `serializeDetail()` (détail, **inchangé**) ; `show` rend la 404 par `response.status(404)` + `inertia.render('errors/not_found', { meta: SeoService.notFound(locale) })` — modèle à copier.
- `app/services/search_service.ts` : agrégats `withAggregate('statsViews'|'statsDownloads', count as viewsCount|downloadsCount)` + départage `id` ; à imiter.
- `app/models/author.ts` : `slug` figé (D28), `affiliations` (hasMany ordonné par `position` hors sous-requêtes), `productions` (manyToMany pivot `production_authors`).
- `app/services/media_service.ts` : `authorPhotoUrl({ photoKey, consentConfirmedAt })` → base `/media/…` ou `null` (10.2) ; `Avatar` prop `photoBase`, taille `lg` 96/112 px.
- `inertia/components/shared/Pagination.tsx` : `buildHref(page)` ; `aria-current="page"` ; pas de fenêtrage (deferred).
- `inertia/pages/productions.tsx` : tri par `Select` shadcn sans label visible ; le `SortSelect` partagé est nouveau (réutilisé par 10.5 et 12.1, ne pas migrer le listing ici).
- `inertia/pages/production.tsx` : fil d'Ariane `ol` + séparateurs `/` `aria-hidden` (même forme ici).
- `inertia_layout.edge` : `title`, `description`, `og:*` depuis `page.props.meta` (pas d'`og:image` avant 10.7).
- `app/exceptions/handler.ts` (10.1) : NotFoundPage pour toute 404 publique.

### Garde-fous

- Ne jamais exposer un auteur non public : la requête de visibilité est le seul point d'entrée ; `photoBase` passe par `MediaService.authorPhotoUrl`.
- Statistiques et cartes : **seulement** `status = 'published'`.
- `whereHas` / `whereExists` (pas de jointure qui dupliquerait les lignes) ; PK du pivot `(production_id, author_id)` → pas de doublon dans les sous-requêtes de totaux.
- Tri `title` : `lower(title)` puis `id` (A → Z insensible à la casse) ; tri `date` : `work_published_at DESC NULLS LAST, anta_published_at DESC NULLS LAST, id`.
- Locale serveur : `SeoService.localeFromCookieHeader(request.header('cookie'))`.
- `inertia/` testé par lecture de source (TS6305) ; chaque clé utilisée existe en FR **et** EN (test dédié, leçon 9.4).
- Japa : `.redirects(0)` pour la 302 ; props lues dans `data-page`.

### Décisions par défaut (D-10.3-x)

- **D-10.3-1** Séparateur du fil d'Ariane `/` (maquette, page détail) plutôt que « › » de l'AC (notation).
- **D-10.3-2** `SeoService.forAuthor` livré dès 10.3 en forme minimale (titre, description, `profile`, `ogUrl`) pour donner un titre serveur à la page ; `ogImage` en 10.7.
- **D-10.3-3** Redirection hors limites : ne conserve que les paramètres connus (`sort` non défaut) ; `page` omis pour la page 1.
- **D-10.3-4** Changement de tri : visite Inertia `preserveScroll`, puis défilement vers la section « Productions » (EXPERIENCE.md : « défilement ramené en haut des résultats »).
- **D-10.3-5** Libellés de tri du profil propres (`authors.profile.sort.*`, EXPERIENCE.md « Tris du profil ») ; le listing garde `sort.*`.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3] ; en-tête Epic 10 (règle de visibilité) ; 10.4/10.5/10.7 pour le hors-périmètre.
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.1] (visibilité), #P2.6 (route `authors.show`, `sort=date|views|downloads|title`, 12/page, transformer unique), #P2.7 (SEO profil).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Profil d'auteur, AuthorProfileHeader, SortSelect, Pagination, Voice and Tone (tris, statistiques, Google Scholar), Accessibilité (h1, fil d'Ariane, `alt` de la photo du profil).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] `container-profile`, disposition « Profil : en-tête + statistiques », AuthorProfileHeader, SortSelect.
- [Source: ux-designs/ux-anta-2026-11-16/mockups/author-profile.html].
- [Source: 10-1-…md] (NotFoundPage, `SeoService.notFound`) ; [Source: 10-2-…md] (`MediaService.authorPhotoUrl`, `Avatar photoBase`).
- [Source: deferred-work.md] (« Paramètre `page` non borné » : traité ici pour le profil ; `Pagination` sans fenêtrage).

### Review Findings

- [x] [Review][Patch] Tri par défaut sur la date de l'œuvre mais cartes affichant la date de publication sur Anta (dates en désordre apparent) [app/controllers/public/authors_controller.ts, inertia/components/public/ProductionCard.tsx, inertia/pages/author.tsx] — la maquette montre la date Anta sur des cartes qui ne sont pas dans l'ordre de leurs dates (affichage non conçu pour ce tri) : **D-10.3-6** le transformer partagé reste inchangé (AC 8 tenu pour l'accueil et le listing) ; le contrôleur du profil ajoute `workPublishedAt` (`YYYY-MM-DD`) aux cartes du profil seulement, et `ProductionCard` reçoit `dateField="work"` (formatée en UTC, libellé « Date de l'œuvre : … »). Accueil et listing inchangés. Test de forme mis à jour.
- [x] [Review][Defer] Tri par titre sensible aux accents — `unaccent` absent des migrations, aucune extension ajoutée ; consigné dans deferred-work.
- [x] [Review][Patch] Départage stable non testé [tests/functional/public/author_profile.spec.ts] — 13 productions à 0 vue triées par vues : pages 1/2 disjointes, ordre `id`.
- [x] [Review][Patch] Constructeur d'URL dupliqué serveur/front [app/services/public_author_service.ts, inertia/lib/author_profile_query.ts] — commentaires de renvoi croisé ; tests de source (page 1 omise, tri → page 1, mêmes règles des deux côtés).
- [x] [Review][Patch] URL Google Scholar non vérifiée à l'affichage [public_author_service.ts, authors_controller.ts] — `safeHttpUrl` : `null` sauf `http:`/`https:` ; test avec `javascript:` écrit directement en base.
- [x] [Review][Patch] Course entre contrôle de visibilité et requête des productions [authors_controller.ts] — 0 production → NotFoundPage 404 (avant la redirection hors limites) ; test par substitution de `findVisibleBySlug`.
- [x] [Review][Defer] Pas de `<Head>` (titre d'onglet en navigation interne, avec 10.4/10.7) ; slug en majuscules → 404 (comme les productions) — deferred-work.
- [x] [Review][Patch] Libellé du test des props (« aucun champ interne ») inexact [author_profile.spec.ts] — précise que l'id ne figure que dans `photoBase` (conception de /media, 10.2).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : 39 tests écrits avant le code (20 en échec, les 404 passaient déjà via l'URL inconnue). Après implémentation : 54 tests ciblés verts.
- Suite complète : 892 tests verts (baseline 853, +39). `npm run lint`, `npm run typecheck`, `node ace build` (NODE_ENV=production) : code de sortie 0. `.adonisjs` régénéré (`/tmp/d37/gen.sh` : route, contrôleur, page, transformer).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- `PublicAuthorService` : `findVisibleBySlug` (consentement + `whereHas` production publiée, affiliations ordonnées), `stats` (une requête, trois sous-requêtes limitées aux productions publiées), `productions` (`whereExists` pivot, agrégats totaux, tris `date` NULLS LAST / `views` / `downloads` / `lower(title)`, départage `id`, 12/page), `parseSort`, `parsePage` (entier positif sûr), `profilePath`.
- `AuthorsController.show` + route `authors.show` : 404 NotFoundPage (comme `ProductionsController.show`) ; page hors limites → 302 `profilePath` (tri non défaut conservé, `page` omis pour 1) ; props `author` sans `id`/`photo_key`/consentement, `photoBase` via `MediaService.authorPhotoUrl`.
- `ProductionCardTransformer` (`BaseTransformer`) remplace les `serialize()` de l'accueil et du listing (résultats approchants compris) ; props inchangées (tests existants verts + test de forme).
- `SeoService.forAuthor` forme minimale (titre « Prénom NOM — Anta », description institution principale + nombre de productions publiées FR/EN avec singulier, `profile`, `ogUrl`) ; `ogImage` / `twitter:card` restent en 10.7.
- Front : `SortSelect` partagé (label visible lié, `min-h-11`), `AuthorProfileHeader` (fil d'Ariane, avatar lg `eager`, h1, affiliations, Scholar D15, aside statistiques), page `author.tsx` (compteur pluriel, tri → page 1 + défilement vers la section, grille 1/2/3, `Pagination` conservant le tri), helpers `author_profile_query.ts`, locales `authors.profile.*` FR/EN.
- Décisions D-10.3-1 à D-10.3-5 (Dev Notes) appliquées.

### File List

- app/controllers/public/authors_controller.ts (nouveau)
- app/services/public_author_service.ts (nouveau)
- app/transformers/production_card_transformer.ts (nouveau)
- app/controllers/public/home_controller.ts
- app/controllers/public/productions_controller.ts
- app/services/seo_service.ts
- start/routes.ts
- .adonisjs/client/data.d.ts
- .adonisjs/client/registry/index.ts
- .adonisjs/client/registry/schema.d.ts
- .adonisjs/client/registry/tree.d.ts
- .adonisjs/server/controllers.ts
- .adonisjs/server/pages.d.ts
- .adonisjs/server/routes.d.ts
- inertia/pages/author.tsx (nouveau)
- inertia/components/public/AuthorProfileHeader.tsx (nouveau)
- inertia/components/shared/SortSelect.tsx (nouveau)
- inertia/lib/author_profile_query.ts (nouveau)
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- inertia/components/public/ProductionCard.tsx (revue)
- _bmad-output/implementation-artifacts/deferred-work.md (revue)
- tests/functional/public/author_profile.spec.ts (nouveau)
- tests/unit/components/author_profile.spec.ts (nouveau)
- tests/unit/transformers/production_card_transformer.spec.ts (nouveau)
- tests/unit/services/seo_service.spec.ts
- _bmad-output/implementation-artifacts/10-3-page-de-profil-d-un-auteur.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

1. Fil d'Ariane : séparateur « / » (maquette) plutôt que « › » (texte de l'AC) — à confirmer.
2. Tri `title` insensible à la casse mais pas aux accents (`lower(title)`, collation de la base) : suffisant ?
3. Tri par défaut : une production sans date de l'œuvre est rangée en dernier, départagée par la date de publication sur Anta — conforme à l'attente ?
4. Le titre d'onglet n'est pas rafraîchi en navigation SPA vers le profil (report Epic 5, pas de `<Head>` public).

## Change Log

- 2026-11-19 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-19 : implémentation (`GET /authors/:slug`, `PublicAuthorService`, `ProductionCardTransformer`, `SeoService.forAuthor` minimal, `AuthorProfileHeader`, `SortSelect`, page `author`) ; 892 tests verts ; statut review.
- 2026-11-19 : revue de code — 6 correctifs (date de l'œuvre sur les cartes du profil, `safeHttpUrl`, garde 404 de course, tests de départage et d'URL, libellé de test), 2 reports (deferred-work) ; statut done.
