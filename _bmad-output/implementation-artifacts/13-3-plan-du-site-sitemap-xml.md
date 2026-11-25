---
baseline_commit: 497ca3f
---

# Story 13.3 : Plan du site `sitemap.xml`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que moteur de recherche,
Je veux un plan du site listant les pages publiques indexables,
Afin d'indexer les productions publiées et les profils visibles (FR36, P2.7).

## Décision de périmètre (lire en premier)

- Story marquée **facultative** dans l'épique (P2.7 : « peut être reportée sans effet sur la couverture des FR ») :
  elle est **implémentée** (décision de l'orchestrateur, 2026-11-25).
- Site public seulement : aucune URL du panel admin, aucun brouillon ni production retirée, aucun profil non public.
- Aucune migration, aucune dépendance nouvelle, rien contre Supabase / R2.

## Acceptance Criteria

1. **Contenu** — **Given** `GET /sitemap.xml`, **When** il est demandé, **Then** il renvoie un `<urlset>` conforme au
   protocole sitemaps.org 0.9 listant en **URL absolues** (`APP_URL`, barre oblique finale retirée) l'accueil `/`,
   `/productions`, `/authors`, chaque production **publiée** (`/productions/:slug`) et chaque profil **visible**
   (`/authors/:slug`, scope `Author.visibleOnSite` = consentement + ≥ 1 production publiée, source unique), avec
   `<lastmod>` au format W3C Datetime (UTC, `Z`).
2. **Exclusions** — il ne contient ni brouillon, ni production retirée (`unpublished`), ni profil non public (sans
   consentement, ou sans production publiée), ni URL du panel admin (`/admin…`), ni route technique (`/media`,
   `/health`, `/stats`, téléchargements, suggestions).
3. **Format** — XML échappé (`& < > " '`), slugs encodés (`encodeURIComponent`) ; `Content-Type:
   application/xml; charset=utf-8` ; `X-Content-Type-Options: nosniff` ; cachable publiquement
   (`Cache-Control: public, max-age=3600`) et donc **servi sans session ni cookies** (aucun `Set-Cookie`), comme
   `/media` et les suggestions (middleware serveur avant le routeur) ; `HEAD` accepté.
4. **Limite de 50 000 URL** (protocole) — un seul fichier ; au-delà, la liste est tronquée (pages fixes puis
   productions les plus récentes puis profils) et un avertissement est journalisé (D-13.3-4).
5. **robots.txt** — `GET /robots.txt` conserve `User-agent: *`, `Disallow: /admin/`, `Allow: /` et déclare
   `Sitemap: <APP_URL>/sitemap.xml` (URL absolue) ; `text/plain; charset=utf-8`, sans cookies.
6. **Tests** — functional `tests/functional/public/sitemap.spec.ts` (inclusions, exclusions : brouillon, retirée,
   auteur sans consentement, auteur sans production publiée, admin ; échappement ; `lastmod` ; en-têtes ; sans
   `Set-Cookie`) et `tests/functional/robots_txt.spec.ts` (ligne `Sitemap:` absolue) ; tests unitaires du rendu
   (échappement, date W3C, troncature).

## Tasks / Subtasks

- [x] T1 `app/services/sitemap_service.ts` (AC 1, 2, 4) : `entries(appUrl)` (requêtes minimales : `slug` +
  dates), `render(entries)` (XML), `robots(appUrl)`, helpers `escapeXml`, `w3cDate`, `absoluteUrl` ; limite
  `SITEMAP_MAX_URLS = 50_000`.
- [x] T2 `app/controllers/public/sitemap_controller.ts` (`show`, `robots`) + routes nommées `sitemap` /
  `robots` (AC 3, 5).
- [x] T3 `app/middleware/seo_files_middleware.ts` enregistré dans `server.use` avant `static_middleware`
  (AC 3, 5) ; suppression de `public/robots.txt` (le serveur statique l'aurait servi avant le routeur, sans
  `APP_URL`).
- [x] T4 Tests functional `sitemap.spec.ts`, `robots_txt.spec.ts` étendu ; unitaires
  `tests/unit/services/sitemap_service.spec.ts` (AC 6).
- [x] T5 Codegen (registry Tuyau), suite complète, lint, typecheck, build.

## Dev Notes

### Contexte technique (état au HEAD `497ca3f`, branche `feat/epic-13-wcag`)

- **robots.txt** : fichier statique `public/robots.txt` (Story 2.5, FR37 : `Disallow: /admin/`), servi par
  `@adonisjs/static` (server middleware, avant le routeur) ; testé par `tests/functional/robots_txt.spec.ts`
  (200, `text/plain`, `User-agent: *`, `Disallow: /admin/`). La ligne `Sitemap:` exige une **URL absolue**, qui dépend
  de l'environnement (staging / prod) → le fichier devient **dynamique**.
- **`APP_URL`** : `start/env.ts` (obligatoire, format URL) ; tests `http://localhost:3333`
  (`scripts/test-local.sh`, `ci.yml`). Le `SeoService` construit déjà ses URL absolues par `absoluteUrl(appUrl,
  path)` (barre oblique finale retirée) : même règle ici.
- **Routes publiques** (`start/routes.ts`) : `/` (home), `/productions` (listing), `/productions/:slug` (détail,
  `status = published` seulement, 404 sinon), `/authors` (liste), `/authors/:slug` (profil, `Author.visibleOnSite`,
  404 sinon), `/privacy-policy`. Routes techniques : `/media/*`, `/health`, `/stats/view`, téléchargements,
  suggestions JSON. Panel : `/admin/*` (+ routes legacy `/login`, `/signup`).
- **Visibilité** : productions `ProductionStatus.PUBLISHED` (`draft`, `unpublished` exclus) ;
  `Author.visibleOnSite` (`app/models/author.ts`) = `consent_confirmed_at` non nul **et** ≥ 1 production publiée
  — source unique (D11, Epic 10), utilisée par `PublicAuthorService` via `withScopes`.
- **Réponses sans état** : `MediaMiddleware` et `SuggestionsMiddleware` (`start/kernel.ts`, `server.use`) répondent
  avant le routeur (pas de session, shield ni auth → aucun `Set-Cookie`, réponse cachable par un cache partagé) ; le
  contrôleur pose lui-même `X-Content-Type-Options`. La route reste déclarée pour le nommage et Tuyau.
- **Dates** : `productions.updated_at` (`autoUpdate`, aussi posé à la publication / dépublication),
  `anta_published_at`, `authors.updated_at`.

### Garde-fous

- Wrappers atlas (`/tmp/d37/run.sh`, `gen.sh`, `build.sh`) ; jamais Doppler / Supabase / R2 ; jamais deux
  `test:local` en parallèle.
- Dépôt public : données de test fictives, aucun hôte réel (`APP_URL` de test seulement).
- Services : commentaires en anglais ; story et tests en français.

### Références

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, Story 13.3 ; `architecture.md` — P2.7 « Plan du site » ;
  `prd.md` — FR36, FR37.
- Story 12.4 — D-12.4-3 (suggestions servies sans état) ; Story 10.2 — `MediaMiddleware`.
- Protocole : sitemaps.org 0.9 (50 000 URL / 50 Mo par fichier, `lastmod` W3C Datetime, entités XML).

## Décisions (D-13.3-n)

- **D-13.3-1** (robots.txt dynamique) : `public/robots.txt` supprimé ; `/robots.txt` est rendu par
  `SitemapService.robots(appUrl)` (mêmes directives + `Sitemap:` absolue). Un fichier statique ne peut pas porter
  l'URL propre à chaque environnement, et le serveur statique répond avant le routeur. **Amende l'AC1 de la story
  2.5** (fichier statique `public/robots.txt`) ; FR37 inchangé (`Disallow: /admin/` conservé) ; note ajoutée au
  Change Log de `2-5-exclusion-panel-admin-indexation.md`.
- **D-13.3-2** (servis sans état) : `SeoFilesMiddleware` répond à `GET|HEAD /sitemap.xml` et `/robots.txt` (chemin
  brut exact, barre oblique finale tolérée pour **les deux** fichiers, comme le routeur qui accepterait aussi
  `/robots.txt/` : mêmes en-têtes quelle que soit l'orthographe acceptée) avant le routeur ; `Cache-Control:
  public, max-age=3600` (une heure : une production publiée y apparaît au plus tard une heure après) ; les routes
  `sitemap` / `robots` restent déclarées (repli identique, mais `private, no-store` via le routeur, comme les
  suggestions : des cookies de session peuvent y être posés).
- **D-13.3-3** (`lastmod`) : production = `updated_at` (repli `anta_published_at`, puis `created_at`) ; profil = la
  plus récente de `authors.updated_at` et des `updated_at` de ses productions **publiées** (la page affiche leurs
  cartes) ; accueil et `/productions` = la plus récente des productions publiées ; `/authors` = la plus récente des
  profils visibles ; omis si aucune donnée. UTC, secondes, suffixe `Z`. Pas de `changefreq` / `priority` (ignorés
  par les moteurs principaux). Limite connue : une dépublication ne rajeunit pas le `lastmod` des listes (la
  production disparaît du plan) — sans effet pratique.
- **D-13.3-4** (50 000 URL) : un seul `<urlset>` ; au-delà de 50 000 URL (Anta en compte quelques centaines), la
  liste est tronquée dans l'ordre pages fixes → productions (plus récentes d'abord) → profils, et un avertissement
  est journalisé **une seule fois par processus** (revue). Revue : la limite est poussée dans SQL (`limit` sur les
  productions, budget restant sur les profils, une ligne de plus pour détecter le dépassement), lignes en objets
  simples (`db.from`, `.pojo()`), troncature par l'helper pur `truncate(entries, limit)` ; au-delà de la limite, le
  `lastmod` des pages de liste vient des lignes gardées (approximation). Passer à un index de sitemaps serait un changement local au service (question PO 1, sans urgence).
- **D-13.3-5** (langues) : une seule URL par page (langue choisie par cookie `i18n_lang`, pas d'URL par langue) →
  pas d'`hreflang` / `xhtml:link`.
- **D-13.3-6** (périmètre des pages fixes) : exactement celles de l'AC (accueil, `/productions`, `/authors`) ;
  `/privacy-policy` n'est pas listée (page légale, indexable mais sans valeur de recherche) — question PO 2.
- **D-13.3-7** (staging non indexé, revue) : variable **facultative** `ROBOTS_DISALLOW_ALL` (booléen, défaut `false`,
  `start/env.ts`, `.env.example`, `compose.yaml`, `docs/staging-vps.md`) : à `true`, `robots.txt` ne contient que
  `User-agent: *` / `Disallow: /` (aucune ligne `Sitemap:`) ; `/sitemap.xml` reste servi. Question PO 4.
- **Limites connues** : cache public d'une heure → une production dépubliée peut rester listée jusqu'à une heure dans
  une copie en cache (la page répond 404 aussitôt) ; `lastmod` rajeuni par des sauvegardes techniques (vignette) ;
  ni `ETag` ni `Last-Modified` (reports de revue, `deferred-work.md`).

## Questions ouvertes

1. `[PO]` **Index de sitemaps** (D-13.3-4) : on accepte la troncature journalisée au-delà de 50 000 URL (hors
   d'atteinte à court terme), ou on veut un index (`/sitemap.xml` → `/sitemaps/productions-1.xml`…) dès maintenant ?
2. `[PO]` **Politique de confidentialité** (D-13.3-6) : faut-il ajouter `/privacy-policy` au plan du site ?
3. `[PO]` **Déclaration aux moteurs** (porte manuelle) : après déploiement, soumettre `https://<domaine>/sitemap.xml`
   dans Google Search Console / Bing Webmaster Tools (compte d'Aurélien) et vérifier l'absence d'erreurs.
4. `[PO]` **Staging non indexé** (D-13.3-7, porte manuelle d'Aurélien) : poser `ROBOTS_DISALLOW_ALL=true` dans la
   configuration Doppler `dev` (reprise dans le `.env` du staging), jamais en production ; vérifier ensuite
   `/robots.txt` du staging (`Disallow: /`, sans `Sitemap:`).

## Review Findings

Revue de code du 2026-11-25 : 6 correctifs, 3 reports, 6 écartés, 4 questions PO.

- [x] [Review][Patch] Troncature appliquée après chargement complet [app/services/sitemap_service.ts] — limite
  poussée dans SQL (productions puis budget restant pour les profils, +1 ligne pour détecter le dépassement), lignes
  en objets simples (`db.from`, `.pojo()`), ordre et priorité inchangés.
- [x] [Review][Patch] `logger.warn` à chaque requête au-delà de 50 000 URL — journalisé une fois par processus.
- [x] [Review][Patch] Troncature non testée unitairement (AC 6) — helper pur `truncate(entries, limit)`, tests dans
  `tests/unit/services/sitemap_service.spec.ts` (ordre, drapeau, limites nulle / négative / fractionnaire).
- [x] [Review][Patch] Staging indexable — `ROBOTS_DISALLOW_ALL` facultative (D-13.3-7), tests des deux modes (unitaires
  et functional `robots_txt.spec.ts`, preuve par mutation) ; question PO 4.
- [x] [Review][Patch] D-13.3-1 amende la story 2.5 (AC1 statique) — noté dans D-13.3-1 et au Change Log de la 2.5.
- [x] [Review][Patch] Tolérance de la barre oblique finale de `ROBOTS` non documentée — D-13.3-2 aligné (les deux
  fichiers).
- [ ] [Review][Defer] Cache public d'une heure : une production dépubliée reste listée jusqu'à une heure en cache.
- [ ] [Review][Defer] `lastmod` rajeuni par les sauvegardes techniques (`ThumbnailService`) — cosmétique.
- [ ] [Review][Defer] Ni `ETag` ni `Last-Modified` sur `/sitemap.xml`.
- [ ] [Review][PO] Index de sitemaps au-delà de 50 000 URL (question 1), `/privacy-policy` (2), soumission aux
  moteurs (3), `ROBOTS_DISALLOW_ALL=true` sur le staging (4).
- [x] [Review][Dismiss] Erreur du middleware avant `inertia_middleware` — même chemin que `SuggestionsMiddleware`.
- [x] [Review][Dismiss] Orthographes `%2E` (`/sitemap%2Exml`) — passent par la route de repli (`private, no-store`).
- [x] [Review][Dismiss] Profils tronqués avant les productions — choix de priorité, question PO 1.
- [x] [Review][Dismiss] `HEAD` exécute les requêtes — corps vide, coût négligeable.
- [x] [Review][Dismiss] Pages fixes sans `lastmod` sur une base vide — attendu (aucune donnée).
- [x] [Review][Dismiss] Formulation des commentaires de `robots.txt`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- 1er passage ciblé : `lastmod` à millisecondes (`suppressMilliseconds` ne les retire que si elles valent 0) →
  `startOf('second')` dans `w3cDate`.
- Lint : `@unicorn/no-await-expression-member` sur `(await client.get(…)).text()` → aide `fetchText`.
- Mutations : scope `visibleOnSite` remplacé par le seul consentement → « exclut … profils non publics » échoue ;
  `SeoFilesMiddleware` retiré du noyau → les deux tests « sans session ni cookies » échouent (`Set-Cookie`,
  `private, no-store`) ; fichiers restaurés.
- Suite complète `npm run test:local` (unit, functional, browser) : **1544 tests verts** (baseline 1530 ; 14 nouveaux),
  code 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0. Aucune migration, aucune
  dépendance, rien contre Supabase ni R2.
- Revue : mutation (contrôleur ignorant `ROBOTS_DISALLOW_ALL`) → le test du mode staging échoue ; restauré. Suite
  complète finale **1548 tests verts** (+4 : `truncate` ×2, `disallowAll` unitaire et functional), code 0 ; `lint` 0 ;
  `typecheck` 0 ; build 0.

### Completion Notes List

- `SitemapService` : entrées (pages fixes, productions publiées triées par `anta_published_at` décroissant, profils
  `Author.visibleOnSite` avec `max(updated_at)` des productions publiées par `withAggregate`), rendu XML échappé,
  `robots.txt`, troncature journalisée à 50 000 URL (D-13.3-4).
- `GET /sitemap.xml` et `GET /robots.txt` servis sans état par `SeoFilesMiddleware` (avant `static_middleware`) ;
  routes nommées `sitemap` / `robots` (repli `private, no-store`) ; `public/robots.txt` supprimé (D-13.3-1).
- Le plan est recalculé à chaque requête non cachée (deux requêtes légères, quelques centaines de lignes) ; le
  `Cache-Control` d'une heure suffit à ce volume.
- Tests : functional `sitemap.spec.ts` (6 : inclusions, exclusions + chaque URL listée répond 200, `lastmod`,
  échappement, troncature, en-têtes / HEAD / sans cookie), `robots_txt.spec.ts` (+2) ; unitaires
  `sitemap_service.spec.ts` (6).
- Portes manuelles : soumission du sitemap aux moteurs après déploiement (question PO 3). 3 questions PO.

### File List

- `app/services/sitemap_service.ts` (nouveau)
- `app/controllers/public/sitemap_controller.ts` (nouveau)
- `app/middleware/seo_files_middleware.ts` (nouveau)
- `start/kernel.ts` (modifié : `SeoFilesMiddleware`)
- `start/routes.ts` (modifié : routes `sitemap`, `robots`)
- `public/robots.txt` (supprimé)
- `.adonisjs/server/controllers.ts`, `.adonisjs/server/routes.d.ts`, `.adonisjs/client/registry/*` (régénérés)
- `tests/functional/public/sitemap.spec.ts` (nouveau)
- `tests/functional/robots_txt.spec.ts` (modifié)
- `tests/unit/services/sitemap_service.spec.ts` (nouveau)
- `start/env.ts`, `.env.example`, `compose.yaml`, `docs/staging-vps.md` (modifiés : `ROBOTS_DISALLOW_ALL`, revue)
- `_bmad-output/implementation-artifacts/2-5-exclusion-panel-admin-indexation.md` (modifié : Change Log)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié)
- `_bmad-output/implementation-artifacts/13-3-plan-du-site-sitemap-xml.md` (nouveau)

## Change Log

- 2026-11-25 : création (bmad-create-story) ; statut ready-for-dev.
- 2026-11-25 : implémentation (bmad-dev-story) : `GET /sitemap.xml` (pages fixes, productions publiées, profils
  visibles, `lastmod` W3C, 50 000 URL), `robots.txt` dynamique avec `Sitemap:` absolue, servis sans état ; 14 tests ;
  statut review.
- 2026-11-25 : revue de code : 6 correctifs (limite poussée dans SQL et lignes légères, avertissement unique,
  helper `truncate` testé, `ROBOTS_DISALLOW_ALL` pour le staging, amendement de la 2.5 noté, barre oblique de
  `robots.txt` documentée), 3 reports, 6 écartés, question PO 4 ; 1548 tests verts ; statut done.
