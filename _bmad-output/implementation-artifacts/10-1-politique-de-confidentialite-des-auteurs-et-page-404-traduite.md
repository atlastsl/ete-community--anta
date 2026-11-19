---
baseline_commit: b92d38a
---

# Story 10.1 : Politique de confidentialité des auteurs et page 404 traduite

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur (et en tant qu'auteur),
je veux savoir quelles données des auteurs sont publiées et comment les faire retirer, et tomber sur une page d'erreur claire quand une page n'existe pas,
afin de faire confiance au site avant que des profils soient publiés (exigence domaine RGPD du PRD, D36).

## Décision de périmètre (lire en premier)

- Story **sans migration, sans nouvelle route, sans dépendance npm**. Elle prépare l'Epic 10 : la NotFoundPage sera réutilisée par 10.3 (profil non visible → 404) et gagnera le lien « Auteurs » en 10.5 (pas avant : `/authors` n'existe pas encore, un lien vers une 404 serait absurde).
- Le pied de page (« Recherche avancée », « Auteurs ») est **hors périmètre** (Story 10.5).
- `errors/server_error.tsx` reste inchangé (hors AC) ; question ouverte ci-dessous.

## Acceptance Criteria

1. **Section auteurs de la politique** — Given `/privacy-policy`, When la page est affichée en FR ou en EN, Then une nouvelle section décrit : les données publiées sur les profils (nom, prénoms, affiliations, lien Google Scholar, photo) ; leur base (consentement de l'auteur, confirmé par un administrateur) ; le retrait du consentement (profil repassé non public) ; le retrait des champs facultatifs sur demande (photo, lien Google Scholar, département) ; la suppression d'une fiche non liée à une production (FR55).
2. **Texte i18n** — le texte est dans les clés `privacy.authors.*` de `inertia/locales/public/{fr,en}.json` (parité FR/EN), ne contient aucune donnée personnelle, et est **à valider par Aurélien avant merge** (porte manuelle, notée dans le Change Log).
3. **NotFoundPage** — Given une URL publique inconnue ou une production inexistante, When la réponse est rendue, Then le composant Inertia `errors/not_found` est rendu dans `PublicLayout`, statut HTTP 404, titre de page traduit, message « Cette page n'existe pas ou n'est plus disponible. » / « This page does not exist or is no longer available. », liens « Accueil » (`/`) et « Recherche avancée » (`/productions`).
4. **A11y** — la page a un seul `h1` et des liens d'au moins 44 px de haut (`min-h-11`).
5. **Tests** — functional `tests/functional/public/privacy.spec.ts` (section présente) et 404 (statut, composant `errors/not_found`, titre traduit FR/EN) ; parité FR/EN ; composant par lecture de source.

## Tasks / Subtasks

- [x] T1 — i18n (AC 1, 2, 3)
  - [x] `privacy.authors.{heading,intro,data,basis,withdrawal,optional_fields,deletion}` FR + EN (public).
  - [x] `not_found.{title,message,nav_label,home,search}` FR + EN (public) **et** admin (la page est aussi résolue par le bundle admin pour une URL `/admin/*` inconnue, D-10.1-4).
- [x] T2 — Page `/privacy-policy` (AC 1)
  - [x] `inertia/pages/privacy-policy.tsx` : section `authors` (h2 + intro + liste `ul` des 5 points), insérée après `data_retention`, avant `rights`.
  - [x] Titre serveur dédié : `SeoService.privacy(locale)` (« Politique de confidentialité — Anta » / « Privacy policy — Anta ») — solde le report « `<title>` de `/privacy-policy` générique » (deferred-work, Epic 5).
- [x] T3 — NotFoundPage (AC 3, 4)
  - [x] Réécrire `inertia/pages/errors/not_found.tsx` (un seul `h1`, message `text-stone-600`, `nav` de deux liens `min-h-11`).
  - [x] `SeoService.notFound(locale)` (« Page introuvable — Anta » / « Page not found — Anta ») ; `ProductionsController.show` l'utilise à la place de `SeoService.site`.
  - [x] `app/exceptions/handler.ts` : page 404 rendue dans **tous** les environnements (test et dev compris), avec `meta` = `SeoService.notFound(locale du cookie)` ; pages 5xx inchangées (production seulement, Youch en dev).
- [x] T4 — Tests (AC 5)
  - [x] functional `privacy.spec.ts` : composant + section (clés présentes FR/EN, titre serveur FR/EN dans le HTML).
  - [x] functional `not_found.spec.ts` : URL inconnue → 404 + composant `errors/not_found` (Inertia) + `<title>` traduit FR/EN (HTML) ; production inexistante → idem ; requête JSON inchangée.
  - [x] unit `tests/unit/components/not_found_page.spec.ts` (lecture de source : un seul `h1`, `min-h-11`, hrefs, clés i18n présentes FR/EN public + admin) et `privacy_policy_page.spec.ts` (section `authors`, clés).
  - [x] unit `seo_service.spec.ts` : `privacy` et `notFound`.
- [x] T5 — Lint, typecheck, build, suite complète (baseline 796).

## Dev Notes

### Existant (lu, à préserver)

- `app/exceptions/handler.ts` : `renderStatusPages = app.inProduction` ; `statusPages` 404 → `inertia.render('errors/not_found', {})` **sans meta**, 5xx → `errors/server_error`. En test/dev, une URL inconnue rend Youch (404 HTML) : d'où la modification (sinon l'AC 3 n'est pas testable et le dev ne voit jamais la vraie page).
- `ExceptionHandler.renderErrorAsHTML` (`@adonisjs/http-server`) : status pages consultées seulement si `renderStatusPages` ; sinon Youch si `debug`. Les requêtes `Accept: json` passent par `renderErrorAsJSON` (inchangé).
- Pour une route inconnue, les middlewares **routeur** (session, shield, auth) ne tournent pas ; `InertiaMiddleware.share` gère déjà un contexte partiel (`session?`, `auth?`).
- `config/inertia.ts` : `rootView` `admin_layout` pour `/admin*`, sinon `inertia_layout` ; `inertia/app.tsx` enveloppe **toutes** les pages dans `PublicLayout` (la NotFoundPage y est donc automatiquement) ; `inertia/admin.tsx` résout aussi `errors/*` mais sans layout et avec `adminI18n`.
- `inertia_layout.edge` : `<title inertia>` et meta depuis `page.props.meta` ; pas de `<Head>` côté pages publiques (convention : meta serveur via `SeoService`, pas d'i18n serveur).
- `ProductionsController.show` : 404 = `response.status(404)` + `inertia.render('errors/not_found', { meta: SeoService.site(locale) })`.
- `privacy-policy.tsx` : `SECTIONS` (intro…contact) → h2 + p ; conteneur `max-w-3xl` (DESIGN `container-form`).
- h1/h2 en Playfair par la feuille globale (`inertia/css/app.css`) ; liens publics ≥ 44 px = `min-h-11` (MediaViewer, FilterChip).

### Pièges (leçons Epic 9, obligatoires)

- Composants `inertia/` testés **par lecture de source** (TS6305), jamais importés.
- Chaque clé utilisée par un composant doit exister en FR **et** EN (le test de parité ne voit pas une clé absente des deux fichiers → test dédié « clés du composant présentes », leçon 9.4).
- Locale serveur : `SeoService.localeFromCookieHeader(request.header('cookie'))`.
- Un test par comportement ; vérifier qu'il échoue sans le code (red-green).
- Aucune donnée personnelle réelle dans les textes et tests.

### Décisions par défaut (D-10.1-x)

- **D-10.1-1** Section « Données des auteurs » placée entre « Durée de conservation » et « Vos droits » ; forme h2 + intro + liste à puces (5 points), le texte rappelle que le nom figure sur les productions signées indépendamment du profil, et renvoie à l'adresse de la section Contact pour toute demande.
- **D-10.1-2** Titre de la 404 rendu côté serveur (`SeoService.notFound`) comme les autres pages publiques ; pas de `<Head>` (le titre en navigation SPA reste le report Epic 5).
- **D-10.1-3** 404 rendue en Inertia dans tous les environnements ; 5xx inchangé.
- **D-10.1-4** Clés `not_found.*` dupliquées dans les locales admin pour une URL `/admin/*` inconnue (sinon clés brutes) ; pas de layout admin ajouté (comportement actuel).
- **D-10.1-5** Pas de lien « Auteurs » sur la 404 avant la Story 10.5.

### Fichiers

- UPDATE : `app/exceptions/handler.ts`, `app/services/seo_service.ts`, `app/controllers/public/pages_controller.ts`, `app/controllers/public/productions_controller.ts`, `inertia/pages/errors/not_found.tsx`, `inertia/pages/privacy-policy.tsx`, `inertia/locales/{public,admin}/{fr,en}.json`, `tests/functional/public/privacy.spec.ts`, `tests/unit/services/seo_service.spec.ts`.
- NEW : `tests/functional/public/not_found.spec.ts`, `tests/unit/components/not_found_page.spec.ts`, `tests/unit/components/privacy_policy_page.spec.ts`.
- Pas de changement de route → pas de régénération `.adonisjs` attendue.

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1] ; en-tête Epic 10 (règle de visibilité).
- [Source: _bmad-output/planning-artifacts/prd.md#Sécurité et Conformité RGPD] (« Données des auteurs (Phase 2) »), FR53, FR55.
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.7] (« Données personnelles ») ; #P2.6 (NotFoundPage, D36, i18n `not_found.*`).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] NotFoundPage (h1 heading-page, phrase text-secondary) ; touch-target 44 px ; container-form.
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Page 404, Voice and Tone (message 404), § Données des auteurs.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (Epic 5 : titre de `/privacy-policy`).

## Questions ouvertes (non bloquantes, défauts retenus)

1. Texte de la section `privacy.authors.*` à valider par Aurélien (AC 2) — en particulier la durée de conservation (« tant que la fiche existe ») et l'adresse de contact reprise de la section existante.
2. Faut-il aussi traduire `errors/server_error.tsx` (aujourd'hui « Something went wrong ») ?
3. Une 404 sous `/admin/*` doit-elle avoir le layout admin plutôt que la page publique nue ?

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : 16 tests sur 19 en échec avant implémentation (les 3 verts : JSON 404 et deux tests préexistants de `privacy.spec.ts`).
- Suite complète : 815 tests verts (baseline 796, +19). `npm run lint`, `npm run typecheck`, `node ace build` (NODE_ENV=production) : code de sortie 0.

### Completion Notes List

- `SeoService.privacy(locale)` et `SeoService.notFound(locale)` : titres traduits côté serveur (edge), solde le report « titre générique de `/privacy-policy` » (Epic 5).
- `app/exceptions/handler.ts` : `renderStatusPages = true` ; la page 404 (Inertia `errors/not_found`, meta traduites depuis le cookie `i18n_lang`) est rendue dans tous les environnements ; la page 5xx reste réservée à la production (Youch conservé en dev). Les requêtes JSON gardent la réponse 404 JSON.
- `ProductionsController.show` : 404 avec `SeoService.notFound` (titre « Page introuvable — Anta »).
- `errors/not_found.tsx` : NotFoundPage (un `h1`, message `text-stone-600`, `nav` nommée, liens Accueil / Recherche avancée `min-h-11`), dans `PublicLayout` via `inertia/app.tsx`.
- `privacy-policy.tsx` : section « Données des auteurs » (h2, intro, 5 points) entre « Durée de conservation » et « Vos droits ».
- i18n : `privacy.authors.*` et `not_found.*` (public FR/EN) ; `not_found.*` aussi dans les locales admin (URL `/admin/*` inconnue).
- **Porte manuelle (AC 2)** : texte `privacy.authors.*` à valider par Aurélien avant merge.
- Lien « Auteurs » de la 404 et pied de page : Story 10.5 (D-10.1-5).

### File List

- app/exceptions/handler.ts
- app/services/seo_service.ts
- app/controllers/public/pages_controller.ts
- app/controllers/public/productions_controller.ts
- inertia/pages/errors/not_found.tsx
- inertia/pages/privacy-policy.tsx
- inertia/locales/public/fr.json
- inertia/locales/public/en.json
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/functional/public/not_found.spec.ts (nouveau)
- tests/functional/public/privacy.spec.ts
- tests/unit/components/not_found_page.spec.ts (nouveau)
- tests/unit/components/privacy_policy_page.spec.ts (nouveau)
- tests/unit/services/seo_service.spec.ts
- _bmad-output/implementation-artifacts/10-1-politique-de-confidentialite-des-auteurs-et-page-404-traduite.md (nouveau)

## Change Log

- 2026-11-19 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-19 : implémentation (NotFoundPage traduite, section « Données des auteurs », titres serveur dédiés) ; 815 tests verts ; statut review. Texte `privacy.authors.*` en attente de validation d'Aurélien avant merge.
