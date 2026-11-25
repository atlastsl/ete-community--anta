---
baseline_commit: 5cb3b48
---

# Story 10.2 : Photos d'auteurs publiques et composant Avatar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que visiteur,
je veux voir la photo d'un auteur à profil public, ou ses initiales à défaut,
afin de reconnaître les membres de la communauté (FR57, FR58, D13, D25).

## Décision de périmètre (lire en premier)

- Story **sans migration, sans dépendance npm**. Une seule nouvelle route publique : `GET /media/*` (`media.show`) → régénérer `.adonisjs` (`/tmp/d37/gen.sh`) et le commiter.
- **Aucune page publique ne rend encore d'auteur** (profil 10.3, byline 10.4, liste 10.5) : la story livre la diffusion `/media`, le calcul serveur de la base `photoUrl` (réservée aux profils publics), `inertia/lib/media.ts` et l'`Avatar` prêt pour le site public. Les props publiques qui exposent `photoUrl` arrivent avec 10.3/10.5.
- Seul le préfixe `authors/` est servi. `thumbnails/` et `posters/` sont ajoutés par l'Epic 11 (structure prévue pour les ajouter sans réécrire le contrôleur). `productions/…` (fichiers sous licence) n'est **jamais** servi : URL signées inchangées.
- L'admin garde les URL signées (`AuthorService.signedPhotoUrl`) : les profils non publics doivent rester prévisualisables sans être diffusés (P2.5). Pas de bascule de l'admin vers `/media`.
- `og:image` / `SeoService.forAuthor` : Story 10.7.

## Acceptance Criteria

1. **Diffusion** — Given `GET /media/*` (`media.show`, `app/controllers/public/media_controller.ts`), When la clé est `authors/<id>/<token>/<variante>` et que `authors/<id>/<token>` est le `photo_key` **courant** d'un auteur à profil public (`consent_confirmed_at IS NOT NULL`), Then le flux R2 (`disk.getStream`) est diffusé avec le bon `Content-Type` (`image/webp` pour `w128.webp`/`w384.webp`, `image/jpeg` pour `og.jpg`) et `Cache-Control: public, max-age=3600`.
2. **Refus** — sinon (auteur non public, ancienne clé, variante inconnue, objet absent de R2) : 404 avec `Cache-Control: no-store`, réponse vide produite par `response.notFound()` — **jamais** d'exception (`findOrFail`, `abort`) qui rendrait la NotFoundPage HTML à une requête d'image (note de revue 10.1).
3. **Préfixes et chemins** — tout préfixe autre que `authors/` (dont `productions/…`), toute remontée de chemin (`..`, y compris encodée), segment vide ou surnuméraire → 404 `no-store` ; aucune requête R2 ni base n'est faite pour une clé mal formée.
4. **Base `photoUrl`** — côté serveur, la base `/media/<photo_key>` n'est calculée que pour un auteur à profil public avec photo ; `null` sinon (jamais de clé d'un auteur non public dans une prop publique).
5. **`inertia/lib/media.ts`** — à partir de la base `photoUrl`, construit `src` (`w128`) et `srcSet` (`…/w128.webp 128w, …/w384.webp 384w`), `sizes` et `width`/`height` selon la taille de l'avatar.
6. **Avatar** — `inertia/components/shared/Avatar.tsx` : photo si présente (base publique `photoUrl` ou `src` signé admin) ; si elle échoue au chargement, initiales ; sans photo, initiales (1re lettre du 1er prénom + 1re lettre du 1er nom) green-800 sur green-100 (D25) en `aria-hidden="true"` ; `alt` fourni par l'appelant (`""` par défaut, D36) ; `width`/`height` renseignés.
7. **Tests** — functional `tests/functional/public/media.spec.ts` avec `drive.fake('r2')` (200 + en-têtes, 404 non public, 404 ancienne clé, 404 variante inconnue, 404 `productions/…`, 404 `..`, 404 objet absent, `no-store` sur chaque 404) ; unitaires du service ; composant et lib par lecture de source. Les lignes créées sont supprimées.

## Tasks / Subtasks

- [x] T1 — Service `app/services/media_service.ts` (AC 1–4)
  - [x] `MediaService.parseAuthorKey(segments: string[])` : exactement 4 segments `authors` / UUID / jeton `[A-Za-z0-9_-]{20}` (`string.generateRandom(20)`, base64url) / variante ∈ `AUTHOR_PHOTO_VARIANTS` ; sinon `null`.
  - [x] `MediaService.resolve(segments)` → `{ key, contentType, cacheControl } | null` : vérifie en base `authors.photo_key = prefix AND id = <id> AND consent_confirmed_at IS NOT NULL` (une requête, pas d'exception).
  - [x] `MediaService.authorPhotoUrl({ photoKey, consentConfirmedAt })` → `/media/${photoKey}` ou `null` (AC 4).
- [x] T2 — `MediaController.show` + route (AC 1–3)
  - [x] `router.get('/media/*', [controllers.public.Media, 'show']).as('media.show')` ; `params['*']`.
  - [x] Refus : `response.header('Cache-Control', 'no-store')` puis `return response.notFound()`.
  - [x] Objet : `disk.getMetaData(key)` (absent → 404 no-store ; donne `Content-Length` et `ETag`), `304` si `If-None-Match` correspond (`request.fresh()`), puis `disk.getStream(key)` → `response.stream(...)` avec rappel d'erreur 404 no-store.
  - [x] `/tmp/d37/gen.sh` puis commit de `.adonisjs`.
- [x] T3 — `inertia/lib/media.ts` (AC 5)
  - [x] `AUTHOR_PHOTO_WIDTHS`, `authorPhotoImage(photoUrl, sizePx, sizes?)` → `{ src, srcSet, sizes, width, height }`.
- [x] T4 — Avatar (AC 6)
  - [x] Prop `photoUrl?: string | null` (base publique, prioritaire) en plus de `src` (URL signée admin, inchangée) ; `width`/`height` = diamètre en px ; `srcSet`/`sizes` via `media.ts` ; `loading="lazy"` par défaut ; repli `onError` indexé sur la source effective.
  - [x] Taille `lg` : 96 px, 112 px dès `sm` (DESIGN.md `Avatar`).
- [x] T5 — Tests (AC 7) : `tests/functional/public/media.spec.ts`, `tests/unit/services/media_service.spec.ts`, `tests/unit/components/avatar.spec.ts` (mise à jour), `tests/unit/lib/media.spec.ts`.
- [x] T6 — Lint, typecheck, build, suite complète (baseline 824).

## Dev Notes

### État actuel (fichiers UPDATE)

- `start/routes.ts` : routes publiques en tête (`home`, `productions`, `production.show`, `production.download`, `privacy-policy`, `health`, `stats.view`). Ajouter `media.show` dans le bloc public. Toutes les routes passent par les middlewares routeur `bodyparser`, `session`, `shield`, `initialize_auth`, `silent_auth` (cookies `adonis-session` / `XSRF-TOKEN` posés aussi sur `/media` — voir « Limites »).
- `inertia/components/shared/Avatar.tsx` (9.3) : `src`, `firstNames`, `lastNames`, `size` (`sm` 32 / `md` 56 / `lg` 96), `alt = ''`, repli `failedSrc === src`. Utilisé par l'admin (`Authors/Index`, `AuthorForm`, `AuthorCombobox`, `SelectedAuthorList`) avec des URL signées : **comportement admin à préserver** (prop `src`).
- `app/services/author_service.ts` : `uploadPhoto` → préfixe `authors/<uuid>/<generateRandom(20)>` ; `photoKeys(prefix)` ; `signedPhotoUrl` (admin). Ne pas toucher.
- `app/services/image_service.ts` : `AUTHOR_PHOTO_VARIANTS` (`w128.webp` 128², `w384.webp` 384², `og.jpg` 600²) — source unique des variantes autorisées.
- `app/exceptions/handler.ts` (10.1) : toute exception 404 sur une route publique rend la NotFoundPage Inertia → d'où l'interdiction de lever dans `/media`.

### Garde-fous

- **Confidentialité** : la seule condition de diffusion est « clé courante d'un auteur `consent_confirmed_at IS NOT NULL` ». Retrait du consentement → 404 immédiat côté serveur (le cache navigateur garde au plus 1 h, annoncé par la politique 10.1 « au plus tard sous une heure »). Ancienne clé (photo remplacée) → 404 même si l'objet traîne encore dans R2.
- Le jeton (20 caractères base64url) rend l'URL non devinable, mais **ce n'est pas le contrôle d'accès** : la base fait foi.
- Valider la clé par liste blanche de motifs **avant** tout accès base/R2 (UUID invalide = erreur Postgres sinon).
- `Content-Type` déduit de la variante (table fixe), jamais du nom fourni par l'appelant ; `X-Content-Type-Options: nosniff` est déjà posé par shield.
- Pas de `Set-Cookie` maîtrisable depuis le contrôleur (middlewares routeur) : sans conséquence pour le cache navigateur ; à traiter si un cache partagé (nginx/CDN) est placé devant `/media` (deferred-work).

### Tests

- `drive.fake('r2')` dans chaque test + `drive.restore('r2')` en `group.each.setup` (modèle `tests/functional/admin/authors_photo.spec.ts`) ; variantes écrites par `fakeDisk.put`.
- Noms fictifs, images générées (aucune vraie photo). Supprimer les auteurs créés (`group.each.setup` cleanup).
- Composants/lib `inertia/` : lecture de source (TS6305).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2] ; en-tête Epic 10 (règle de visibilité).
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.5] « Diffusion », « Front » ; P2-10 ; tableau des routes (`GET /media/*`).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] `avatar-initials-*`, composant Avatar (sm 32 / md 56 / lg 96, 112 ≥ sm).
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Avatar (D13), textes alternatifs (D9, D36).
- [Source: 10-1-…md#Note pour la Story 10.2] ; [Source: 9-3-photo-d-un-auteur.md] ; [Source: deferred-work.md] « URLs signées des avatars ».

## Questions ouvertes (non bloquantes, défauts retenus)

1. Diffuser la photo d'un auteur public **sans** production publiée (non « visible » au sens D11) ? Défaut : oui, l'AC ne demande que le profil public ; l'URL n'est exposée par aucune page.
2. Basculer les avatars de l'admin vers `/media` pour les profils publics (cache navigateur) ? Défaut : non, URL signées partout dans l'admin.

### Review Findings

- [x] [Review][Patch] Tests de remontée de chemin inopérants : superagent (`new URL()`) résolvait `..`/`%2e%2e` côté client [tests/functional/public/media.spec.ts] — requêtes brutes `node:http` sur le serveur de Japa ; cas `%252e%252e`, `..%5c`, `%2e%2e%2f`, antislash, `//`, `/media/../` ; témoin 200.
- [x] [Review][Patch] Erreur de flux : 404 renvoyée avec `Content-Length`/`ETag` de l'image → client en attente [app/controllers/public/media_controller.ts] — rappel d'erreur : en-têtes image retirés, corps vide, `no-store` ; test (objet supprimé entre métadonnées et lecture).
- [x] [Review][Patch] HEAD lisait le flux [media_controller.ts] — réponse après les en-têtes (+ `Content-Length`), sans `getStream` ; test.
- [x] [Review][Patch] Toute erreur de `getMetaData` traitée en 404 [media_controller.ts] — `isStorageNotFound` (ENOENT, NoSuchKey, NotFound, HTTP 404, via `cause`) → 404 ; sinon 503 `no-store` + `logger.error` ; même règle pour `getStream`, la lecture et la requête en base ; tests.
- [x] [Review][Patch] Middleware de session sur `/media` : consommait les messages flash de la page en cours et réécrivait les cookies (`adonis-session`, `XSRF-TOKEN`) [start/kernel.ts, app/middleware/media_middleware.ts] — `MediaMiddleware` (middleware serveur) sert `GET|HEAD /media/*` avant le routeur : ni session, ni shield, ni auth, aucun `Set-Cookie` ; la route `media.show` reste déclarée (nommage) ; test sans `Set-Cookie`. Entrée deferred-work retirée.
- [x] [Review][Patch] Prop `photoUrl` de l'Avatar en collision avec les `photoUrl` signées de l'admin [inertia/components/shared/Avatar.tsx, inertia/lib/media.ts] — renommée `photoBase` ; `authorPhotoImage` n'accepte qu'une base `/media/…` (sinon `null`).
- [x] [Review][Patch] Régression admin : aperçu blob du formulaire passé en `loading="lazy"` [inertia/components/admin/AuthorForm.tsx] — `loading="eager"`.
- [x] [Review][Decision] Avatar `lg` à 112 px dès `sm` aussi dans l'admin (D-10.2-4) — conforme à DESIGN.md, conservé.
- [x] [Review][Patch] Tests manquants [tests/] — retrait du consentement après un 200 (revalidation `If-None-Match` → 404, pas 304), HEAD, cas unitaires de `resolve()` (consentement, ancienne clé, sans photo, préfixe d'un autre auteur), test « absent ou retiré » renommé.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : tests écrits avant le code ; premier lancement interrompu (modules `#services/media_service` et contrôleur absents). Après implémentation : 24 tests ciblés verts.
- Suite complète : 843 tests verts (baseline 824, +19) ; après revue : 853 (+10). `npm run lint`, `npm run typecheck`, `node ace build` (NODE_ENV=production) : code de sortie 0. `.adonisjs` régénéré (`/tmp/d37/gen.sh`).

### Completion Notes List

- `MediaService` : liste blanche stricte de la clé (`authors` / UUID / jeton base64url 20 / variante de `AUTHOR_PHOTO_VARIANTS`) avant tout accès ; `resolve` = une requête (`id`, `photo_key` courant, `consent_confirmed_at IS NOT NULL`) ; `authorPhotoUrl` (base `/media/<photo_key>` ou `null`) prêt pour les props publiques de 10.3/10.5.
- `MediaController.show` : tout refus = `response.notFound()` + `no-store`, jamais d'exception. `getMetaData` avant `getStream` (D-10.2-1) : objet absent → 404 propre (une erreur de flux après les en-têtes ne ferait que couper la connexion), `ETag` + `304` à la revalidation, `Content-Length`. `Content-Type` tiré de la variante.
- `inertia/lib/media.ts` : `authorPhotoImage(photoUrl, sizePx, sizes)` → `src` w128, `srcSet` w128/w384, `sizes`, `width`/`height`.
- `Avatar` : nouvelle prop `photoUrl` (base publique, prioritaire) ; `src` signé de l'admin inchangé ; `width`/`height`, `loading="lazy"` par défaut ; lg 112 px dès `sm` (DESIGN.md) ; repli `onError` indexé sur la source effective.
- Décisions par défaut : D-10.2-1 métadonnées + flux (2 opérations R2 au premier chargement, 1 seule ensuite grâce au 304) ; D-10.2-2 photo servie pour tout profil public, même sans production publiée (AC ; URL exposée par aucune page) ; D-10.2-3 admin reste en URL signées.
- Revue : `/media` servi par `MediaMiddleware` avant le routeur (sans session ni cookies) ; 503 pour une panne du stockage ; HEAD sans flux ; prop `photoBase`.

### File List

- app/services/media_service.ts (nouveau)
- app/controllers/public/media_controller.ts (nouveau)
- start/routes.ts
- .adonisjs/client/registry/index.ts
- .adonisjs/client/registry/schema.d.ts
- .adonisjs/client/registry/tree.d.ts
- .adonisjs/server/controllers.ts
- .adonisjs/server/routes.d.ts
- inertia/lib/media.ts (nouveau)
- inertia/components/shared/Avatar.tsx
- tests/functional/public/media.spec.ts (nouveau)
- tests/unit/services/media_service.spec.ts (nouveau)
- tests/unit/lib/media.spec.ts (nouveau)
- tests/unit/components/avatar.spec.ts
- app/middleware/media_middleware.ts (nouveau, revue)
- start/kernel.ts (revue)
- inertia/components/admin/AuthorForm.tsx (revue)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/10-2-photos-d-auteurs-publiques-et-composant-avatar.md (nouveau)

## Change Log

- 2026-11-19 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-19 : implémentation (`GET /media/*` pour les photos d'auteurs à profil public, `MediaService`, `inertia/lib/media.ts`, `Avatar` public) ; 843 tests verts ; statut review.
- 2026-11-19 : revue de code — 8 correctifs (requêtes brutes des tests de traversée, rappel d'erreur de flux, HEAD, 503 stockage, `/media` sans session ni cookies via `MediaMiddleware`, prop `photoBase`, aperçu admin `eager`, tests), 1 décision (lg 112 px) ; 853 tests verts ; statut done.
