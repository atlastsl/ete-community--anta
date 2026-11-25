---
baseline_commit: c761b0a
---

# Story 12.4 : Suggestions de productions similaires

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **visiteur**,
je veux **voir, sous une production, jusqu'à 4 productions similaires**,
afin de **poursuivre ma découverte sans nouvelle recherche** (FR61, D22, NFR18).

## Décision de périmètre (lire en premier)

- Story **sans migration** (pivot `production_authors` avec clé primaire `(production_id, author_id)`, colonnes jsonb `tags` / `subdomain` NOT NULL `'[]'`), **sans dépendance npm**, sans cache serveur (P2.4 : balayage de quelques centaines de lignes).
- **DANS 12.4** :
  - `app/services/suggestion_service.ts` : requête P2.4 (identifiants ordonnés) + hydratation des productions publiées dans l'ordre ;
  - `GET /productions/:slug/suggestions` (`production.suggestions`, `ProductionsController.suggestions`) → `{ results: ProductionCard[] }` (≤ 4, transformer de cartes, bylines comprises, sans image D37), `Cache-Control: public, max-age=300`, 404 JSON si la production n'est pas publiée ; servi sans session ni cookie (D-12.4-3) ;
  - helper pur `inertia/lib/suggestions.ts` (`fetch` avec abandon à 2 000 ms, validation, mémoïsation par slug dans une `Map` du module) ;
  - composant `inertia/components/public/SuggestionsGrid.tsx` (squelette, `aria-busy`, statut masqué, région `aria-live`, retrait silencieux) + `Skeleton` shadcn ajouté à la main (`inertia/components/ui/skeleton.tsx`) ;
  - `ProductionCard` : variante `compact` (sans date, résumé masqué < sm, `line-clamp-2` ≥ sm) ;
  - page de détail : `SuggestionsGrid` pleine largeur sous la grille principale ;
  - i18n public `suggestions.*` (FR/EN) ; registre Tuyau régénéré.
- **HORS 12.4 (ne PAS implémenter)** : `EXPLAIN ANALYZE` sur la base remplie, mesure « suggestions affichées < 2 s », Lighthouse → 12.5 / portes PO ; raison affichée sur les cartes (D22 : aucune) ; vignette (D37) ; `inertia.defer` (rejeté par P2.4).

## Acceptance Criteria

1. **Candidates (P2.4, P2-07)** — **Given** `SuggestionService`, **When** les suggestions d'une production publiée sont calculées, **Then** une production **publiée** est candidate si elle partage au moins un auteur (pivot), un tag, un sous-domaine (jsonb) ou le domaine (non nul) ; la production consultée est exclue ; brouillons et dépubliées exclus.
2. **Ordre** — critère le plus fort partagé (auteur > tag > sous-domaine > domaine), puis nombre d'éléments communs (chaque auteur, tag et sous-domaine commun, + 1 pour le domaine), puis `anta_published_at` ↓ `NULLS LAST`, puis `id` ↑ ; 4 au maximum ; requête sans l'opérateur jsonb `?` dans `db.rawQuery`.
3. **Endpoint** — `GET /productions/:slug/suggestions` (`production.suggestions`) renvoie `{ results: ProductionCard[] }` (≤ 4, sérialisés par `ProductionCardTransformer`, bylines comprises, aucune image) avec `Cache-Control: public, max-age=300` ; aucune candidate → `{ results: [] }` (200) ; production inconnue, brouillon ou dépubliée → 404 JSON sans contenu de la production.
4. **Non bloquant (NFR18)** — la page de détail rend métadonnées et lecteur sans attendre les suggestions (aucune prop serveur ajoutée) ; `SuggestionsGrid` (pleine largeur sous la grille principale) lance `fetch` au montage avec un `AbortController` de **2 000 ms** et affiche un squelette de 4 cartes (`aria-hidden="true"`, animation `motion-safe` seulement) dans un conteneur `aria-busy="true"` avec le statut masqué « Chargement des productions similaires… ».
5. **Résultats** — titre `h2` « Productions similaires », jusqu'à 4 cartes sans raison affichée et sans date, 2 colonnes sur mobile (compactes < sm : résumé masqué, `gap-3`) et 4 dès `lg` (D22, D35) ; une région `aria-live="polite"` masquée annonce une fois « {n} productions similaires » ; le focus n'est jamais déplacé.
6. **Échec silencieux (D22)** — 0 résultat, erreur (HTTP, réseau, JSON invalide) ou délai > 2 s → section retirée, sans message ni annonce.
7. **Mémoïsation** — résultat mémorisé par slug dans une `Map` du module : aucun nouveau chargement au retour arrière.

## Tasks / Subtasks

- [x] **T1 — `SuggestionService`** (AC 1, 2)
  - [x] 1.1 `idsFor(productionId)` : SQL de P2.4 en `db.rawQuery` à liaisons positionnelles, `count(DISTINCT …)` sur tags/sous-domaines, garde `jsonb_typeof = 'array'`, `LIMIT 4`.
  - [x] 1.2 `forProduction(productionId)` : productions publiées + agrégats `viewsCount` / `downloadsCount`, dans l'ordre des identifiants.
- [x] **T2 — Endpoint** (AC 3)
  - [x] 2.1 `ProductionsController.suggestions` (404 JSON `no-store`, bylines, transformer, `Cache-Control`, `X-Content-Type-Options`).
  - [x] 2.2 Route `production.suggestions` dans `start/routes.ts` + middleware serveur `SuggestionsMiddleware` (sans session / shield / auth, D-12.4-3) ; registre Tuyau régénéré (`gen.sh`).
- [x] **T3 — Client** (AC 4–7)
  - [x] 3.1 `inertia/lib/suggestions.ts` : `SUGGESTIONS_TIMEOUT_MS`, `SUGGESTIONS_MAX`, `cachedSuggestions`, `loadSuggestions`, `clearSuggestionsCache` (tests) ; l'URL vient de Tuyau (`urlFor('production.suggestions', { slug })`) dans le composant.
  - [x] 3.2 `inertia/components/ui/skeleton.tsx` (shadcn v4, `motion-safe:animate-pulse`).
  - [x] 3.3 `SuggestionsGrid.tsx` ; `ProductionCard` variante `compact` ; `production.tsx` (`key={production.slug}`).
  - [x] 3.4 i18n `suggestions.title`, `suggestions.loading`, `suggestions.announce_one/_other` (FR/EN).
- [x] **T4 — Tests** (tous les AC)
  - [x] 4.1 Functional `tests/functional/public/suggestions.spec.ts` : ordre auteur > tag > sous-domaine > domaine, départage par nombre puis date puis id, production courante exclue, brouillons / dépubliées exclus, ≤ 4, aucune candidate → `[]`, brouillon consulté → 404, slug inconnu → 404, `Cache-Control`, aucun `Set-Cookie`, forme des cartes (bylines, pas d'image).
  - [x] 4.2 Unit runtime `tests/unit/lib/suggestions_behavior.spec.ts` : constantes, succès mémorisé (un seul `fetch`), coupe à 4, erreur HTTP / réseau / JSON invalide → `[]`, délai → `[]` (abandon), abandon par l'appelant non mémorisé.
  - [x] 4.3 Lecture de source : `SuggestionsGrid` (`aria-busy`, `aria-live`, statut, `aria-hidden`, `motion-safe`, 4 squelettes, retrait silencieux, pas de `focus()`), `Skeleton`, `ProductionCard` compact, page de détail, i18n FR/EN.
  - [x] 4.4 Suite complète, lint, typecheck, build.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/controllers/public/productions_controller.ts` : `index`, `show` (404 = page `errors/not_found`), `download`, `notFound` privé.
- `start/routes.ts` : `/productions`, `/productions/:slug`, `/productions/:slug/files/:fileId/download`, `/media/*` (servi par `MediaMiddleware` avant le routeur, route gardée pour le nommage).
- `start/kernel.ts` : `server.use([... media_middleware ...])`, puis `router.use([bodyparser, session, shield, auth...])` → toute réponse du routeur porte `Set-Cookie` (session + `XSRF-TOKEN`).
- `app/transformers/production_card_transformer.ts` : carte unique (auteurs via `PublicBylineService.attach`, aucune image).
- `inertia/pages/production.tsx` : grille `lg:grid-cols-3` (colonne principale + aside), puis `ViewTracker`.
- `inertia/components/public/ProductionCard.tsx` : variantes `grid` / `list`, date `published` / `work`.
- `inertia/components/ui/` : pas de `skeleton.tsx`.

### Garde-fous

- Pas d'opérateur jsonb `?` dans `db.rawQuery` (liaison knex) : `jsonb_array_elements_text` + `IN`.
- Visibilité : seules les productions `published` ; le 404 ne révèle rien d'un brouillon (NFR12).
- Cartes : D37 (aucune image), byline publique (`slug` seulement pour un profil visible).
- Composants `inertia/` testés par lecture de source (TS6305) ; logique dans `inertia/lib/suggestions.ts`, sans import, chargée à l'exécution par URL (comme `search_query_behavior.spec.ts`).
- Tests sans horloge réelle serrée : le délai est injectable (`timeoutMs`).
- Dépôt public : données fictives.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.4] ; en-tête Epic 12.
- [Source: architecture.md#P2.4] (endpoint, SQL, interprétation du « critère partagé »), tableau des routes publiques, P2-07, P2.5 (D37).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md:36, 115, 150, 192, 243, 293] ; [DESIGN.md:133–135, 336, 366] ; maquette `mockups/production-detail-suggestions.html:59–119` ; `.decision-log.md` D22, D35.
- [Source: 11-2-…md] (vérification D37 des cartes de suggestions reportée à l'Epic 12) ; `MediaMiddleware` (10.2, réponses cachables sans `Set-Cookie`).

## Décisions (D-12.4-n)

- **D-12.4-1** : « auteur partagé » = auteur commun dans le pivot, quel que soit son consentement : la byline affiche déjà son nom (non lié) ; aucune donnée de profil n'est exposée. Les noms libres non convertis (`productions.authors` jsonb) ne comptent pas (AC « pivot »).
- **D-12.4-2** : comptage par éléments **distincts** (`count(DISTINCT …)`) : un tag répété dans un tableau ne compte qu'une fois ; garde `jsonb_typeof(...) = 'array'` (tableau vide sinon) ; domaine commun seulement s'il est non nul ; `anta_published_at DESC NULLS LAST, id ASC`. Liaisons positionnelles (`?`) et `CAST(... AS int)` : ni `?` jsonb ni liaisons nommées.
- **D-12.4-3** : réponse **cachable publiquement → sans `Set-Cookie`** : comme `/media/*` (10.2), `GET /productions/<slug>/suggestions` est servi (GET et HEAD, barre oblique finale admise) par un middleware serveur avant le routeur (pas de session, shield, auth) ; appelé par le routeur (sous session), le contrôleur répond `private, no-store` ; la route nommée reste déclarée (nommage, Tuyau, repli identique si le chemin brut ne correspond pas). Un cache partagé ne peut donc jamais rejouer le cookie de session ou le jeton XSRF d'un autre visiteur, et le chargement ne consomme pas les messages flash de la page. `X-Content-Type-Options: nosniff` posé par le contrôleur (shield ne passe pas).
- **D-12.4-4** : 404 = corps JSON `{ error: 'not_found' }` avec `Cache-Control: no-store` (une production publiée ensuite apparaît sans délai) ; jamais la page Inertia (requête `fetch`).
- **D-12.4-5** : mémoïsation : tout résultat final est mémorisé (succès, y compris 0 ; erreur ou délai → `[]`), sauf l'abandon par l'appelant (démontage, navigation rapide) qui n'est pas mémorisé ; la `Map` vit jusqu'au rechargement complet. Résultats coupés à 4 et validés (tableau d'objets) côté client.
- **D-12.4-6** : variante `compact` de `ProductionCard` (titre `text-base sm:text-lg`, `p-4 sm:p-5`, résumé `line-clamp-2 max-sm:hidden`, **sans date**, compteurs `flex-wrap`) ; grille `grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4` (DESIGN.md:336) ; titres de carte en `h3` sous le `h2`.
- **D-12.4-7** : `SuggestionsGrid` reçoit `key={production.slug}` : un passage d'une production à une autre repart d'un état propre (cache ou chargement) ; la région `aria-live` est présente dès le chargement (vide) puis reçoit « {n} productions similaires » → une seule annonce ; rien n'est annoncé en cas d'échec.
- **D-12.4-8** : `Skeleton` ajouté à la main (source shadcn v4, pas de CLI réseau), couleur `bg-stone-200` (identité stone) et `motion-safe:animate-pulse` au lieu de `animate-pulse`.

## Review Findings

- [x] [Review][Patch] `n_domain` valait NULL quand la production courante n'a pas de domaine (`TRUE AND NULL`) : la somme devenait NULL et `WHERE … > 0` écartait toutes les candidates, même à auteur ou tag commun [app/services/suggestion_service.ts:33] — `CAST(COALESCE(p.domain = cur.domain, false) AS int)` ; `n_authors` / `n_tags` / `n_sub` sont des `count()` (jamais NULL, garde `jsonb_typeof`) ; 2 tests (domaine nul côté courante puis côté candidate), vérifié par mutation (ancienne expression → le test échoue).
- [x] [Review][Patch] HEAD et barre oblique finale passaient par le routeur (session + shield → `Set-Cookie` sur une réponse `public`) [app/middleware/suggestions_middleware.ts] — GET et HEAD acceptés, `\/?$` ; défense en profondeur : `suggestions(ctx, stateless)` répond `private, no-store` hors middleware ; tests HEAD, barre oblique (aucun `Set-Cookie`) et appel direct du contrôleur.
- [x] [Review][Patch] Tailwind 4 : `sm:block` écrasait le `display: -webkit-box` de `line-clamp-2` (résumé jamais tronqué dès sm) [inertia/components/public/ProductionCard.tsx] — `line-clamp-2 max-sm:hidden` ; test de source mis à jour (aucun `sm:block`).
- [ ] [Review][Defer] Erreur de base dans le middleware avant routeur → 500 non JSON sans `no-store` (comme `/media`) ; le client la traite comme vide — consigné dans deferred-work.md.
- [x] [Review][Defer][PO] D-12.4-5 : un délai ou une erreur passagère masque les suggestions de ce slug jusqu'au rechargement complet — accepté par le PO le 2026-11-25.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites d'abord (14 fonctionnels `suggestions.spec.ts`, 8 unitaires `suggestions_behavior.spec.ts`, 9 de lecture de source `suggestions_grid.spec.ts`) → échec au chargement (modules `suggestion_service`, `SuggestionsGrid`, `skeleton` absents ; le runner reste bloqué sur une erreur de chargement de fichier, comme noté en 12.3).
- Phase verte ciblée : 35 tests (dont `production_card.spec.ts`) → 32 verts, 3 assertions de lecture de source trop littérales corrigées (génériques `<T>`, mot « import » dans un commentaire, ordre des classes) → verts.
- Vérification par mutation : `SuggestionsMiddleware` retiré du kernel → seul le test « aucun Set-Cookie » échoue (13/14) ; la route du routeur répond à l'identique (repli D-12.4-3).
- Registre Tuyau régénéré (`/tmp/d37/gen.sh`) : `production.suggestions` dans `.adonisjs/client/registry/*` et `.adonisjs/server/routes.d.ts`.
- Suite complète `npm run test:local` : **1440 tests verts** (baseline 1409, +31), code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, rien contre Supabase ni R2.

- Revue (3 correctifs, 2 reports) : domaine nul vérifié par mutation ; **1444 tests verts** (+4), `npm run test:local` code 0, lint 0, typecheck 0, build 0.

### Completion Notes List

- `SuggestionService` : SQL de P2.4 en `db.rawQuery` à liaisons positionnelles (statut et limite liés), `count(DISTINCT …)` sur `jsonb_array_elements_text` gardé par `jsonb_typeof = 'array'`, `CAST(… AS int)` pour le domaine (D-12.4-2) ; `forProduction()` hydrate les publiées avec les agrégats de vues / téléchargements dans l'ordre des identifiants.
- `ProductionsController.suggestions` : 404 JSON `{ error: 'not_found' }` `no-store` ; sinon bylines (`PublicBylineService.attach`) + `ProductionCardTransformer` sérialisé par `ctx.serialize.withoutWrapping` → `{ results }`, `Cache-Control: public, max-age=300`, `X-Content-Type-Options: nosniff`.
- `SuggestionsMiddleware` (serveur, après `MediaMiddleware`) sert le chemin brut `/productions/<slug>/suggestions` sans session / shield / auth : aucune réponse cachable ne porte de `Set-Cookie` (D-12.4-3) ; route nommée `production.suggestions` déclarée (Tuyau, repli).
- Client : `inertia/lib/suggestions.ts` (délai 2 000 ms injectable, coupe à 4, validation de forme, `Map` du module ; abandon par l'appelant → `null` non mémorisé, D-12.4-5) ; `SuggestionsGrid` (squelette de 4 cartes `aria-hidden` dans un conteneur `aria-busy`, statut masqué, région `aria-live` unique, retrait silencieux) ; `Skeleton` shadcn ajouté à la main (`motion-safe:animate-pulse`, D-12.4-8) ; `ProductionCard` variante `compact` (D-12.4-6) ; page de détail : `<SuggestionsGrid key={production.slug} … />` sous la grille principale ; i18n `suggestions.*` FR/EN (pluriels i18next).
- Vérification D37 reportée de 11.2 : les cartes de suggestions viennent du transformer unique, sans image (test fonctionnel).
- Rendu non vérifié au navigateur (pas de serveur de dev lancé) : contrôle visuel 375 / 1024 px, squelette et retrait à 2 s au test PO. `EXPLAIN ANALYZE` de la requête sur la base remplie et mesure « < 2 s » → 12.5.

### File List

- app/services/suggestion_service.ts (nouveau)
- app/middleware/suggestions_middleware.ts (nouveau)
- _bmad-output/implementation-artifacts/deferred-work.md
- app/controllers/public/productions_controller.ts
- start/routes.ts
- start/kernel.ts
- .adonisjs/client/registry/index.ts, schema.d.ts, tree.d.ts ; .adonisjs/server/routes.d.ts (régénérés)
- inertia/lib/suggestions.ts (nouveau)
- inertia/components/public/SuggestionsGrid.tsx (nouveau)
- inertia/components/ui/skeleton.tsx (nouveau)
- inertia/components/public/ProductionCard.tsx
- inertia/pages/production.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- tests/functional/public/suggestions.spec.ts (nouveau)
- tests/unit/lib/suggestions_behavior.spec.ts (nouveau)
- tests/unit/components/suggestions_grid.spec.ts (nouveau)
- _bmad-output/implementation-artifacts/12-4-suggestions-de-productions-similaires.md (nouveau)

## Change Log

- 2026-11-24 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-24 : implémentation (`SuggestionService`, endpoint `production.suggestions` sans cookie, `SuggestionsGrid` + helper `inertia/lib/suggestions.ts`, `Skeleton`, carte compacte, i18n) ; 1440 tests verts ; statut review.
- 2026-11-24 : revue de code — 3 correctifs (domaine nul annulant la somme, HEAD / barre oblique finale + `private, no-store` hors middleware, `line-clamp-2 max-sm:hidden`), 2 reports (500 du middleware, [PO] mémoïsation d'un échec) ; 1444 tests verts ; statut done.
- 2026-11-25 : décision PO — D-12.4-5 acceptée (échec mémorisé jusqu'au rechargement).
