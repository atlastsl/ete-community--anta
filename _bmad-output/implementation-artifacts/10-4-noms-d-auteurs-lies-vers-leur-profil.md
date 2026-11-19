---
baseline_commit: 3b5f5df
---

# Story 10.4 : Noms d'auteurs liés vers leur profil

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur,
je veux cliquer sur le nom d'un auteur partout où il apparaît,
afin d'accéder à son profil en un clic (FR59, FR53, D12, D24, D36).

## Décision de périmètre (lire en premier)

- Story **sans migration, sans route, sans dépendance npm** (pas de régénération de `.adonisjs` attendue pour les routes ; le type du transformer change → `/tmp/d37/gen.sh` met à jour `.adonisjs/client/data.d.ts`, à commiter s'il change).
- **Une seule règle de visibilité** : le prédicat « profil visible » (consentement confirmé **et** ≥ 1 production publiée liée, P2.1/D11) devient un *query scope* du modèle `Author` (`visibleOnSite`), utilisé par `PublicAuthorService.findVisibleBySlug` (10.3, refactorisé) **et** par le calcul des bylines. Aucun prédicat dupliqué. Sur une production publiée, « public » et « visible » coïncident (la production elle-même satisfait la 2ᵉ condition) : l'AC « slug seulement pour un profil public » est donc tenu par le même scope.
- **Calcul groupé, sans N+1** : `PublicBylineService.attach(productions)` = 2 requêtes par lot quel que soit le nombre de cartes (lignes pivot + auteurs, puis slugs des seuls auteurs visibles), résultat posé dans `production.$extras.byline` ; le transformer et le détail le lisent.
- **Aucune fuite** : le slug n'est lu (`SELECT id, slug`) que pour les auteurs visibles ; aucune autre donnée d'auteur (id, photo, consentement) n'est exposée. Un auteur non public → `{ name, slug: null }`.
- **Productions non converties / partielles** : `productions.authors` (jsonb) sans pivot → noms en texte simple (`slug: null`), comme aujourd'hui. Production partiellement rattachée → auteurs du pivot (ordre `position`) puis noms jsonb non rattachés (`ProductionAuthorService.legacyOf`, déjà utilisé par le formulaire 9.7) en texte simple : aucun nom ne disparaît du site.
- **Titre d'onglet** (report Epic 5 / 10.3, « à traiter avec 10.4 / 10.7 ») : constat empirique (Playwright sur le serveur local) : après hydratation, **toutes** les pages publiques affichent « Anta » (le head manager d'Inertia remplace le `<title inertia>` serveur par le titre par défaut). Les liens d'auteurs rendant la navigation interne vers les profils centrale, le correctif minimal est inclus (AC 7) : `<Head>` dans `PublicLayout` alimenté par `meta.title`, callback `title` du point d'entrée public sans suffixe. Les `og:*` restent côté edge (10.7).
- Aucun nom réel dans le code, les tests ou les textes ; noms fictifs (« Jeanne EXEMPLE »).

## Acceptance Criteria

1. **Forme sérialisée** — Given `ProductionCardTransformer` (accueil, listing — résultats approchants compris —, profil) et la page de détail (`production.show`), When une production publiée est sérialisée, Then elle expose `authors: { name: string, slug: string | null }[]` : d'abord les auteurs du pivot dans l'ordre `position` (nom « Prénom NOM », nom de famille en capitales), puis les noms jsonb non rattachés ; `slug` n'est renseigné que pour un profil visible (scope unique `visibleOnSite`) ; aucune autre donnée d'un auteur n'est exposée.
2. **Production non convertie** — Given une production sans ligne pivot, When elle est sérialisée, Then ses noms jsonb (non vides, dédoublonnés) sont rendus `{ name, slug: null }` dans leur ordre.
3. **Calcul groupé** — Given une page de N cartes, When les bylines sont calculées, Then le nombre de requêtes est constant (2), indépendant de N ; une liste vide n'émet aucune requête.
4. **`AuthorByline`** — Given `inertia/components/public/AuthorByline.tsx`, When il rend les auteurs, Then un auteur avec `slug` est un lien Inertia vers `urlFor('authors.show', { slug })` (souligné `decoration-stone-300`, `underline-offset-2`, survol `text-green-700` / `decoration-green-700`, D24) ; sans `slug`, du texte simple sans style distinctif (D12) ; séparateur « , » (variante `inline`) ou un nom par ligne (variante `stacked`, aside « Auteurs »).
   - Cartes : au plus 3 auteurs puis « et {n} autres » (`authors.byline.others`, pluriel i18next FR/EN) ; détail : aucune troncature (D36).
   - Profil : le nom de l'auteur du profil (`currentSlug`) est rendu en texte simple.
5. **`ProductionCard`** — le titre reste le lien principal, la byline est rendue hors de ce lien (aucun `<a>` imbriqué), après le titre dans le DOM (tabulation titre → auteurs) ; variantes `grid` et `list`.
6. **Page de détail** — byline « Par … » sous le `h1` (liée, sans troncature) et, en tête de l'aside, une ligne « Auteurs » (`production_detail.authors`) listant les auteurs un par ligne (maquette `production-detail-suggestions.html`). Les meta de la production (`SeoService.forProduction`) reprennent les noms affichés.
7. **Titre d'onglet** — Given une page publique portant `meta`, When elle est chargée ou atteinte par navigation Inertia, Then le titre du document est `meta.title` (« … — Anta ») ; sans `meta`, « Anta ». Le titre serveur (edge) est inchangé pour les robots.
8. **Retrait du consentement** — Given un auteur dont le consentement est retiré, When une page publique est rechargée, Then son nom s'affiche sans lien (`slug: null`) ; aucun cache.
9. **Tests** — functional : détail et listing (slug pour un profil public, `null` sinon, ordre du pivot, non converti, partiel, retrait de consentement), accueil et profil (forme `{ name, slug }`), requêtes constantes (service) ; unitaires : transformer, composants par lecture de source (pas de `<a>` imbriqué, « et {n} autres », propre nom non lié, classes D24, `Head` du layout), clés i18n FR/EN. Lignes créées annulées (transaction globale).

## Tasks / Subtasks

- [x] T1 — Scope `Author.visibleOnSite` (AC 1, 8)
  - [x] `static visibleOnSite = scope(...)` : `whereNotNull('consent_confirmed_at')` + `whereHas('productions', status = published)`.
  - [x] `PublicAuthorService.findVisibleBySlug` l'utilise (comportement 10.3 inchangé, tests 10.3 verts).
- [x] T2 — `app/services/public_byline_service.ts` (AC 1–3)
  - [x] `attach(productions)` : requête pivot ⨝ authors (`production_id, position, author_id, first_names, last_names, search_name`) ordonnée ; `visibleSlugs(ids)` via le scope (`select id, slug`) ; `legacyOf(authorNames, searchNames).unlinkedNames` ; `$extras.byline`.
  - [x] `app/helpers/author_name.ts` : `formatAuthorName` (miroir de `inertia/lib/author_form.ts`, frontière TS).
- [x] T3 — Sérialisation (AC 1, 2, 6)
  - [x] Transformer : `authors: bylineOf(p)` (lit `$extras.byline`, sinon repli jsonb `slug: null` — jamais de slug sans calcul).
  - [x] `home_controller`, `productions_controller.index` (approchants compris), `authors_controller.show`, `productions_controller.show` (`serializeDetail`, meta) appellent `attach`.
- [x] T4 — Front (AC 4–7)
  - [x] `AuthorByline.tsx` (`authors`, `max?`, `currentSlug?`, `variant?: 'inline' | 'stacked'`).
  - [x] `ProductionCard` : type `AuthorCredit`, byline via `AuthorByline max={3}`, prop `currentAuthorSlug` ; `author.tsx` la passe.
  - [x] `production.tsx` : byline + ligne « Auteurs » de l'aside.
  - [x] `PublicLayout` : `<Head>` titre ; `app.tsx` : callback `title` sans suffixe.
  - [x] Locales `authors.byline.others_one/_other`, `production_detail.authors` FR/EN.
- [x] T5 — Tests (AC 9), lint, typecheck, build, suite complète (baseline 896).

## Dev Notes

### État actuel (fichiers UPDATE, lus)

- `app/transformers/production_card_transformer.ts` : `authors: p.authorNames ?? []` (string[]) ; agrégats lus dans `$extras` (même mécanisme pour `byline`).
- `app/controllers/public/home_controller.ts` : deux blocs (6 cartes), `ProductionCardTransformer.transform(rows)` (refonte de l'accueil = Epic 12, ne pas toucher au reste).
- `app/controllers/public/productions_controller.ts` : `index` (`SearchService.search` + `approximate`), `show` (`serializeDetail`, `authors: p.authorNames`, meta `forProduction(authors: authorNames)`), `download` inchangé.
- `app/controllers/public/authors_controller.ts` : cartes du profil = transformer + `workPublishedAt` (D-10.3-6).
- `app/services/public_author_service.ts` : `findVisibleBySlug` porte aujourd'hui le prédicat en ligne → le déplacer dans le scope.
- `app/services/production_author_service.ts` : `legacyOf(authors, linkedSearchNames)` (noms jsonb non rattachés, `matchKey`, dédoublonnés, `sourceKey`) — réutilisé tel quel. `refreshDenormalizedNames` écrit le jsonb dans l'ordre du pivot → production entièrement rattachée : aucun nom en surplus.
- `app/models/production.ts` : `authorNames` (jsonb `authors`), relation `authors` ordonnée par `production_authors.position`.
- `inertia/components/public/ProductionCard.tsx` : byline `authors.join(', ')` dans un `<p>` hors du `Link` du titre (pas de lien étendu) ; `ProductionCardData.authors: string[]` (utilisé par `home.tsx`, `productions.tsx`, `author.tsx`).
- `inertia/pages/production.tsx` : byline `join(', ')`, aside sans ligne « Auteurs ».
- `inertia/layouts/PublicLayout.tsx` / `inertia/app.tsx` : aucun `<Head>` ; callback `title` = `${title} - Anta`. `inertia_layout.edge` : `<title inertia>` serveur.
- `inertia/pages/errors/not_found.tsx` : liens `<a href>` (chargement complet) — rien à changer ; son titre suivra le `<Head>` du layout public (bundle admin : inchangé).

### Garde-fous

- Ne jamais lire `slug` d'un auteur non visible (la requête des slugs passe par le scope) ; ne jamais exposer `id`, `photo_key`, consentement dans les bylines.
- Pivot PK `(production_id, author_id)` : pas de doublon ; ordre `position` puis `production_id` pour le regroupement.
- `whereIn` sur un tableau d'ids (quelques dizaines au plus par page) : OK avec le query builder (pas de `rawQuery` avec tableau).
- Titre d'onglet : échapper `&`/`<` avant de passer le titre au `<Head>` (le head manager l'insère en HTML ; le contenu de `<title>` est RCDATA, l'échappement garde le texte exact).
- `inertia/` testé par lecture de source (TS6305) ; chaque clé i18n en FR **et** EN.

### Décisions par défaut (D-10.4-x)

- **D-10.4-1** Nom des auteurs du pivot formaté « Prénom NOM » côté serveur (`formatAuthorName`, miroir du front) : cohérent avec le `h1` du profil et les maquettes ; les noms jsonb non rattachés restent tels que saisis.
- **D-10.4-2** Production partielle : pivot d'abord, puis noms jsonb non rattachés (texte simple) ; un auteur renommé lié à une production partielle peut apparaître deux fois (ancien nom jsonb, nouveau nom lié) jusqu'à la conversion complète (D-9.6-f).
- **D-10.4-3** Troncature : `max = 3` sur les cartes ; « et 1 autre » dès le 4ᵉ auteur (pas de « A, B, C, D » à 4).
- **D-10.4-4** Aside « Auteurs » : un nom par ligne (maquette) ; la byline sous le titre garde le séparateur « , ».
- **D-10.4-5** Correctif du titre d'onglet inclus (AC 7) ; `og:*` client non synchronisés (inutile aux robots, edge fait foi).
- **D-10.4-6** Meta de la production : noms de la byline (mêmes noms qu'à l'écran, prépare 10.7).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4] ; en-tête Epic 10 (règle de visibilité) ; 10.6 (facette auteur, hors périmètre), 11.6 (bannière, réutilisera `AuthorByline`).
- [Source: architecture.md#P2.1] (visibilité, pivot ordonné), #P2.6 (`production.show` : auteurs `{ name, slug | null }[]`, transformer unique), #P2.7 (aucune donnée d'auteur non public).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] AuthorByline (D12, D24, troncature), Accessibilité (liens soulignés), parcours 1 (climax : co-auteur cliqué).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] `components.author-link`, ProductionCard, AuthorByline.
- [Source: mockups/production-detail-suggestions.html] (byline + aside « Auteurs »), `home.html`, `author-profile.html`.
- [Source: 10-3-…md] (`PublicAuthorService`, transformer, D-10.3-6) ; [Source: 9-7-…md] (`legacyOf`, productions protégées) ; [Source: deferred-work.md] (titre d'onglet).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Constat avant code (Playwright, serveur local 3998, base locale) : `/privacy-policy` → titre de document « Anta » après hydratation (head manager d'Inertia : commit initial du titre par défaut sur `<title inertia>`).
- Phase rouge : `bylines.spec.ts`, `author_byline.spec.ts` et le transformer modifié écrits avant le code (service, helper et composant absents). Après implémentation : 50 tests ciblés verts.
- Suite complète : 920 tests verts (baseline 896, +24 ; 1 test 9.7 mis à jour : `authors` devient `{ name, slug }[]`). `npm run lint`, `npm run typecheck`, `/tmp/d37/build.sh` : code de sortie 0. `/tmp/d37/gen.sh` : aucun fichier `.adonisjs` modifié (pas de route ; type du transformer inféré).
- Vérification navigateur (Playwright, lignes temporaires supprimées ensuite) : détail « Oeuvre PW & test — Anta » (esperluette intacte), byline et aside liés pour le profil public, texte simple pour l'auteur non consenti ; clic sur le nom → `/authors/:slug`, titre « Jeanne ESSAI — Anta » ; sur le profil, son propre nom non lié ; retour arrière → titre de la production.
- L'avertissement pg « client.query() when the client is already executing » est préexistant (`SearchService.facets`, `Promise.all` dans la transaction globale des tests).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Scope `Author.visibleOnSite` (consentement + ≥ 1 production publiée) : seule définition de la visibilité, utilisée par `findVisibleBySlug` (10.3) et `PublicAuthorService.visibleSlugs` (bylines).
- `PublicBylineService.attach` : 2 requêtes par lot (pivot ⨝ authors ordonné par `position`, puis `SELECT id, slug` des seuls auteurs visibles), byline dans `$extras.byline` ; noms jsonb non rattachés ajoutés en texte simple (`legacyOf`) ; `of()` = repli sans slug si la byline n'a pas été calculée. Branché sur l'accueil, le listing (approchants compris), le profil et le détail ; meta du détail = noms affichés.
- `formatAuthorName` serveur (`app/helpers/author_name.ts`, miroir du front).
- Front : `AuthorByline` (liens Inertia `urlFor('authors.show')`, style D24, texte simple sinon, « et {n} autres », `currentSlug`, variante `stacked`) ; `ProductionCard` (type `AuthorCredit`, 3 auteurs max, byline hors du lien du titre, `currentAuthorSlug`) ; page de détail (byline complète + ligne « Auteurs » de l'aside) ; locales `authors.byline.others_one/_other`, `production_detail.authors` FR/EN.
- Titre d'onglet : `<Head title>` dans `PublicLayout` (titre échappé par `documentTitle`), callback `title` public sans suffixe ; commentaires obsolètes « pas de <Head> public » mis à jour ; deferred-work mis à jour.
- Décisions D-10.4-1 à D-10.4-6 appliquées.

### File List

- app/models/author.ts
- app/services/public_author_service.ts
- app/services/public_byline_service.ts (nouveau)
- app/helpers/author_name.ts (nouveau)
- app/transformers/production_card_transformer.ts
- app/controllers/public/home_controller.ts
- app/controllers/public/productions_controller.ts
- app/controllers/public/authors_controller.ts
- inertia/components/public/AuthorByline.tsx (nouveau)
- inertia/components/public/ProductionCard.tsx
- inertia/pages/production.tsx
- inertia/pages/author.tsx
- inertia/pages/errors/not_found.tsx
- inertia/layouts/PublicLayout.tsx
- inertia/app.tsx
- inertia/lib/seo.ts
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/functional/public/bylines.spec.ts (nouveau)
- tests/functional/public/author_profile.spec.ts
- tests/functional/admin/productions_authors.spec.ts
- tests/unit/components/author_byline.spec.ts (nouveau)
- tests/unit/transformers/production_card_transformer.spec.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/10-4-noms-d-auteurs-lies-vers-leur-profil.md (nouveau)

## Questions ouvertes (non bloquantes, défauts retenus)

1. Production partiellement rattachée : afficher les noms jsonb non rattachés après les auteurs du pivot (D-10.4-2) convient-il, sachant qu'un auteur renommé peut alors apparaître deux fois jusqu'à la conversion complète ?
2. Noms des auteurs du pivot affichés « Prénom NOM » (capitales) partout, y compris dans la meta description de la production — conforme à l'attente ?
3. Troncature des cartes : « A, B, C et 1 autre » dès 4 auteurs (plutôt que 4 noms) — à confirmer.

## Change Log

- 2026-11-19 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-19 : implémentation (scope `visibleOnSite`, `PublicBylineService`, `AuthorByline`, cartes et détail liés, titre d'onglet public) ; 920 tests verts ; statut review.
