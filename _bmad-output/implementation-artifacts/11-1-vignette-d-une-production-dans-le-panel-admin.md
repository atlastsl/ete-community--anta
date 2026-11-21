---
baseline_commit: 3b50691
---

# Story 11.1 : Vignette d'une production dans le panel admin

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur** (rôle `admin` ou `super_admin`),
je veux **téléverser, remplacer ou retirer la vignette d'une production**,
afin de **l'illustrer dans la bannière à la une** (FR50, D37, NFR19).

## Décision de périmètre (lire en premier)

- **DANS 11.1** :
  - migration additive `1775918748000_add_thumbnail_and_poster_columns.ts` : `productions.thumbnail_key` **et** `production_files.poster_key` (varchar 255, NULL, sans défaut) — `poster_key` est créé ici (migration n° 4 de P2.1) mais n'est **lu ni écrit** par aucun code avant 11.3 ; propriétés de modèle `Production.thumbnailKey` et `ProductionFile.posterKey` ;
  - profil 16:9 d'`ImageService` (`THUMBNAIL_VARIANTS` : `w400.webp` 400×225, `w800.webp` 800×450, `w1600.webp` 1600×900, recadrage centré) — réutilisé tel quel par les posters de 11.3 ;
  - `ThumbnailService` (envoi sous `thumbnails/<productionId>/<token 20>`, écriture de la clé après l'envoi, suppression best-effort de l'ancien préfixe, retrait, URL signée d'aperçu) ;
  - `POST` / `DELETE /admin/productions/:productionId/thumbnail` (`admin/thumbnails_controller.ts`), validateur `thumbnail_validator.ts`, journal `update` / `production` `{ field: 'thumbnail', op }` ;
  - suppression du préfixe de la vignette à la suppression d'une production (`ProductionService.delete`) ;
  - composant `inertia/components/admin/ThumbnailField.tsx` + helper pur `inertia/lib/thumbnail.ts` (validation client) ; i18n admin `thumbnail.*` ;
  - tests (functional `production_thumbnail.spec.ts`, unit 16:9, composant par lecture de source, helper par import à l'exécution).
- **HORS 11.1 (ne PAS implémenter)** :
  - diffusion publique `GET /media/thumbnails/…`, `inertia/lib/media.ts` 16:9 → **11.2** (`MediaService.parseAuthorKey` reste limité à `authors/`) ;
  - `ffmpeg`, `VideoFrameService`, écriture / lecture de `poster_key`, mention « Image extraite de la vidéo » → **11.3** ;
  - page « À la une », `FeaturedSlot`, `featured_productions`, `requiresThumbnail`, refus `thumbnail.errors.required_for_featured` → **11.4** (la table n'existe pas encore : le retrait est toujours permis en 11.1) ;
  - **aucune** intégration dans le formulaire de production ni dans `CompletionIndicator` (D37) : en 11.1, `ThumbnailField` n'est monté par aucune page (premier consommateur : `FeaturedSlot`, 11.4) ;
  - aucune image dans les cartes publiques ni `og:image` de production (D37, inchangé).

## Acceptance Criteria

1. **Migration** — **Given** `database/migrations/1775918748000_add_thumbnail_and_poster_columns.ts`, **When** elle est exécutée, **Then** `productions.thumbnail_key` et `production_files.poster_key` existent (varchar 255, NULL, sans défaut) ; `down()` écrit mais jamais exécuté sur la base partagée.
2. **Variantes 16:9** — **Given** `ImageService.thumbnailVariants(input)`, **When** une vignette est traitée, **Then** `w400.webp` (400×225), `w800.webp` (800×450) et `w1600.webp` (1600×900) sont produites en WebP par recadrage centré (`fit: 'cover'`, `position: 'centre'`), après validation réelle du format (signature + décodage sharp : JPEG, PNG, WebP ; ≤ 5 Mo ; ≤ 40 Mpx), réorientation EXIF et suppression des métadonnées ; image animée → première image.
3. **Pose / remplacement** — **Given** `POST /admin/productions/:productionId/thumbnail` (`admin.productions.thumbnail.store`, `app/controllers/admin/thumbnails_controller.ts`, groupe `middleware.admin()`), **When** une vignette valide est envoyée (champ multipart `thumbnail`), **Then** les 3 variantes sont écrites sous un préfixe neuf `thumbnails/<productionId>/<token 20>`, `thumbnail_key` (= préfixe) est mis à jour **après** l'envoi, l'ancien préfixe est supprimé ensuite (best-effort : `logger.error`, jamais d'échec de la requête), redirection arrière + flash `thumbnail.uploaded` (comme `files_controller.ts`) **and** si l'écriture en base échoue, les variantes neuves sont supprimées et l'erreur remonte **and** le journal reçoit `update` / `production` avec `metadata: { field: 'thumbnail', op: 'set' }`.
4. **Refus** — **Given** un fichier absent, d'un autre format (y compris renommé `.jpg`), > 5 Mo ou > 40 Mpx, **When** il est envoyé, **Then** redirection arrière avec l'erreur sur le champ `thumbnail` (`thumbnail.errors.no_file`, `invalid_type`, `too_large`, `dimensions`), **rien** n'est écrit (ni base, ni R2, ni journal) ; production inconnue ou identifiant mal formé → 404.
5. **Retrait** — **Given** `DELETE /admin/productions/:productionId/thumbnail` (`admin.productions.thumbnail.destroy`), **When** l'administrateur retire la vignette, **Then** `thumbnail_key` passe à NULL, puis les variantes du préfixe sont supprimées de R2 (best-effort), flash `thumbnail.removed`, journal `metadata: { field: 'thumbnail', op: 'remove' }` **and** sans vignette enregistrée : aucun changement, aucun journal.
6. **Suppression de la production** — **Given** une production avec vignette, **When** sa suppression aboutit, **Then** les variantes de sa vignette sont supprimées de R2 (best-effort, après la suppression en base).
7. **`ThumbnailField`** — **Given** `inertia/components/admin/ThumbnailField.tsx` (props `productionId`, `previewUrl` signée, `hasThumbnail`), **When** il s'affiche, **Then** il propose un téléversement immédiat (sélection ou glisser-déposer) avec barre de progression, la validation type/taille côté client (mêmes clés d'erreur), un aperçu recadré 16:9 (`aspect-video object-cover`, `alt=""`), « Remplacer » et « Retirer », et l'aide « JPEG, PNG ou WebP · 5 Mo max · format 16:9 conseillé (recadrage automatique) » (D36) **and** erreur de type ou de taille (client ou serveur) affichée en ligne sous le champ ; échec réseau → toast d'erreur persistant (`notify.error`) **and** les visites Inertia préservent l'état de la page (`preserveState`, `preserveScroll`) pour ne pas perdre l'état non enregistré de la future page « À la une » (D20).
8. **D37** — le formulaire de production ne propose pas de vignette et `CompletionIndicator` est inchangé.
9. **i18n** — clés `thumbnail.*` dans `inertia/locales/admin/{fr,en}.json` (parité vérifiée par le test existant).

## Tasks / Subtasks

- [x] **T1 — Migration et modèles** (AC 1)
  - [x] 1.1 `database/migrations/1775918748000_add_thumbnail_and_poster_columns.ts` : `alterTable('productions')` `string('thumbnail_key', 255).nullable()` ; `alterTable('production_files')` `string('poster_key', 255).nullable()` ; `down()` symétrique (`dropColumn`). Docblock « Additive only - shared dev/staging database: down() is written but never executed ».
  - [x] 1.2 `Production.thumbnailKey: string | null`, `ProductionFile.posterKey: string | null` (`@column()`).
  - [x] 1.3 Migration appliquée sur la base locale de test seulement (`/tmp/d37/local.sh node ace migration:run` ou via la suite). **Jamais** sur Supabase.
- [x] **T2 — Profil 16:9 d'`ImageService`** (AC 2)
  - [x] 2.1 `export const THUMBNAIL_VARIANTS = [w400 400×225, w800 800×450, w1600 1600×900] (webp, centre)` ; `static thumbnailVariants(input)` → `this.render(input, THUMBNAIL_VARIANTS)`. Un seul groupe (même ratio, même ancrage) : décodage unique.
  - [x] 2.2 Docblocks mis à jour (profils auteur et vignette).
- [x] **T3 — `ThumbnailService`** (AC 3, 5, 6)
  - [x] 3.1 `app/services/thumbnail_service.ts` : `keys(prefix)`, `set(production, variants)` → `{ previous }`, `remove(production)` → `boolean`, `discard(prefix)` (best-effort), `signedUrl(prefix, variant = 'w800.webp')` (`null` sans clé ou en cas d'échec).
  - [x] 3.2 `set` : envoi des variantes **avant** la transaction (échec partiel → suppression des envoyées) ; transaction : verrou `FOR NO KEY UPDATE` sur la production (via `knexQuery`, D-11.1-3), lecture de l'ancienne clé sur la ligne verrouillée, écriture de la nouvelle ; échec → `discard(nouveau)` puis relance ; succès → `discard(ancien)`.
  - [x] 3.3 `remove` : même verrou ; sans clé → `false` ; sinon NULL puis `discard` après le commit.
  - [x] 3.4 `ProductionService.delete` : `discard(production.thumbnailKey)` après `production.delete()`.
- [x] **T4 — Validateur, contrôleur, routes** (AC 3, 4, 5)
  - [x] 4.1 `app/validators/admin/thumbnail_validator.ts` : `thumbnail: vine.file({ size: '5mb', extnames: ['jpg','jpeg','png','webp'] })` ; messages `thumbnail.required` → `no_file`, `thumbnail.file` / `.extname` → `invalid_type`, `.size` → `too_large` ; constantes `THUMBNAIL_MAX_MB`, `THUMBNAIL_EXTNAMES`.
  - [x] 4.2 `app/controllers/admin/thumbnails_controller.ts` : `store` (garde UUID → 404, `validateUsing`, `ImageService.thumbnailVariants(tmpPath)` → `ImageValidationError` converti en `E_VALIDATION_ERROR` sur `thumbnail` (`photo_type` → `invalid_type`, `photo_size` → `too_large`, `photo_dimensions` → `dimensions`), `ThumbnailService.set`, journal, flash, `redirect().back()`, suppression du fichier temporaire dans `finally`) ; `destroy` (garde UUID, `remove`, journal si retiré, flash).
  - [x] 4.3 `start/routes.ts` (groupe admin, après les liens) : `POST` / `DELETE productions/:productionId/thumbnail` → `.as('admin.productions.thumbnail.store' | '.destroy')` ; `/tmp/d37/gen.sh` pour régénérer `.adonisjs` (registre Tuyau, contrôleurs).
- [x] **T5 — Front** (AC 7, 8, 9)
  - [x] 5.1 `inertia/lib/thumbnail.ts` (pur, sans import) : `THUMBNAIL_MAX_BYTES`, `THUMBNAIL_MIME_TYPES`, `THUMBNAIL_ACCEPT`, `validateThumbnailFile(file)` → `'invalid_type' | 'too_large' | null` (repli sur l'extension si le type MIME est vide, comme `author_form.ts`).
  - [x] 5.2 `ThumbnailField.tsx` : dropzone pointillée (style `FileUploader`), input fichier `sr-only` focalisable (`useId`, plusieurs champs par page), aperçu `aspect-video` `object-cover` `alt=""`, boutons « Téléverser une vignette » / « Remplacer » et « Retirer », aide `thumbnail.help` reliée par `aria-describedby`, barre de progression + annonce `aria-live` par quarts, erreur en ligne (`role` implicite via `aria-describedby`/`aria-invalid`) ; `router.post(urlFor('admin.productions.thumbnail.store', { productionId }), { thumbnail }, { forceFormData, preserveState: true, preserveScroll: true, onProgress, onError, onSuccess, onFinish })` ; échec réseau = visite terminée sans `onSuccess` / `onError` ni annulation → `notify.error(t('thumbnail.errors.network'))` ; `router.delete(urlFor('admin.productions.thumbnail.destroy', …), { preserveState: true, preserveScroll: true })`.
  - [x] 5.3 i18n `thumbnail.{upload,replace,remove,help,drop_hint,uploading,preview_unavailable,uploaded,removed,errors.{no_file,invalid_type,too_large,dimensions,network}}` en fr et en (libellés d'EXPERIENCE.md).
- [x] **T6 — Tests** (tous les AC)
  - [x] 6.1 `tests/unit/services/image_service.spec.ts` : groupe 16:9 (3 variantes, dimensions, WebP, sans EXIF, source 4:3 et portrait recadrées au centre, refus gif/texte).
  - [x] 6.2 `tests/functional/admin/production_thumbnail.spec.ts` (`drive.fake('r2')`, images `sharp`) : colonnes (information_schema), pose, remplacement (ancien préfixe supprimé), retrait, retrait sans vignette (no-op), format refusé (texte renommé `.jpg`, GIF), > 5 Mo refusé, journal `set`/`remove`, 404 production inconnue / id mal formé, suppression de la production → préfixe supprimé, accès non authentifié redirigé, échec de suppression de l'ancien préfixe non bloquant.
  - [x] 6.3 `tests/unit/lib/thumbnail.spec.ts` (import à l'exécution) ; `tests/unit/components/thumbnail_field.spec.ts` (lecture de source : `urlFor`, `preserveState`, `aspect-video`, `alt=""`, aide, `notify.error`) ; formulaire de production sans vignette (D37).
  - [x] 6.4 Suite complète `npm run test:local`, `npm run lint`, `npm run typecheck`, build — tous verts.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/services/image_service.ts` : `render(input, variants)` privé, groupé par ratio + ancrage (`position?: 'centre' | 'attention'`) ; `assertValid` (taille 5 Mo, signature, format, 40 Mpx) ; erreurs `ImageValidationError` codes `photo_type` / `photo_size` / `photo_dimensions` (suffixes des clés `authors.form.errors.*`) → le contrôleur des vignettes les **traduit** vers `thumbnail.errors.*` (pas de nouveau code d'erreur dans le service).
- `app/services/author_service.ts` : modèle à reproduire (`uploadPhoto` : préfixe neuf + `Promise.allSettled` + suppression des envoyées en cas d'échec ; `discardPhoto`/`deleteKeys` : `FileStorageService.deleteObjects` + `logger.error`, jamais d'exception ; `signedPhotoUrl`). Verrou `forNoKeyUpdate()` via `knexQuery` (Lucid ne l'expose pas).
- `app/services/file_storage_service.ts` : `putObject(key, body, contentType)`, `deleteObjects(keys)` (renvoie les échecs), `signedUrl(key)`.
- `app/controllers/admin/files_controller.ts` : redirection arrière + flash ; `authors_controller.ts` : garde UUID (`E_ROW_NOT_FOUND`), conversion `ImageValidationError` → `E_VALIDATION_ERROR`, suppression du fichier temporaire (`unlink(tmpPath)`) — le bodyparser ne le fait pas.
- `app/services/production_service.ts#delete` : supprime les fichiers R2 un par un puis la ligne ; y ajouter la vignette.
- `ActivityLogService.log({ adminUserId, actionType: ActionType.UPDATE, resourceType: 'production', resourceId, metadata })` (hors transaction, ne lève jamais).
- `inertia/components/admin/FileUploader.tsx` (dropzone, progression), `AuthorForm.tsx` `PhotoPicker` (input `sr-only` + label bouton, aria-live par quarts), `inertia/lib/notify.ts`.

### Garde-fous

- **Aucune** diffusion publique en 11.1 : l'aperçu admin utilise `FileStorageService.signedUrl` (`w800.webp`).
- Clé = préfixe sans `/` final ; jeton `string.generateRandom(20)` (base64url, compatible avec le `TOKEN` de `MediaService` pour 11.2).
- Suppression des variantes par clés explicites (`THUMBNAIL_VARIANTS`), jamais `deleteAll(prefix)`.
- Pas de colonne `thumbnail_source`, ni largeur/hauteur stockées (P2.1).
- Migration additive uniquement ; ne jamais lancer `migration:run` hors base locale.
- Dépôt public : images générées par `sharp`, aucune vraie photo.

### Tests

- `drive.fake('r2')` dans chaque test + `drive.restore('r2')` au nettoyage ; `db.beginGlobalTransaction()` (modèle `authors_photo.spec.ts`). `.withCsrfToken()`, `.redirects(0)`, `loginAs()`.
- Composants `inertia/` par lecture de source (TS6305) ; helper pur `inertia/lib/thumbnail.ts` chargé à l'exécution (modèle `search_query_behavior.spec.ts`).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.1] et en-tête de l'Epic 11 (règle d'image P2.1).
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.1] colonnes ajoutées, migration n° 4 ; [#P2.5] traitement sharp, tableau des variantes, clé ; [#P2.6] routes `admin.productions.thumbnail.*` ; P2-08, P2-10, P2-17.
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] `thumbnail-field`, ThumbnailField ; [EXPERIENCE.md] « Aide vignette », ThumbnailField (états), D36, D37.
- [Source: 9-3-photo-d-un-auteur.md] modèle d'envoi / suppression ; [Source: 10-2-…md] `MediaService` (extension en 11.2).

## Décisions (D-11.1-n)

- **D-11.1-1** : logique de stockage dans un `ThumbnailService` dédié (contrôleur mince), calqué sur la photo d'auteur ; pas de refactor d'`AuthorService` (duplication assumée d'une vingtaine de lignes d'envoi/suppression).
- **D-11.1-2** : erreurs supplémentaires hors épique : `thumbnail.errors.no_file` (champ absent) et `thumbnail.errors.dimensions` (> 40 Mpx, équivalent de `photo_dimensions`).
- **D-11.1-3** : verrou `FOR NO KEY UPDATE` sur la production pendant l'écriture de la clé : deux envois concurrents suppriment chacun le préfixe réellement remplacé ; `NO KEY` évite de bloquer les insertions des tables enfants (FK `KEY SHARE` : vues, téléchargements, fichiers).
- **D-11.1-4** : retrait sans vignette = no-op silencieux (redirection arrière, ni journal). Revue : aucune des deux routes ne flashe de succès (toast émis par le champ).
- **D-11.1-5** : `ThumbnailField` lit les erreurs serveur via `onError` de sa propre visite (pas `usePage().props.errors`) : plusieurs champs sur une même page (3 emplacements en 11.4) n'affichent pas l'erreur des autres.
- **D-11.1-6** : `updated_at` de la production avance à chaque pose / retrait (écriture Lucid normale) : c'est une modification journalisée `update`.

## Questions ouvertes (non bloquantes, défauts retenus)

1. « Retirer » sans dialog de confirmation (comme la suppression d'un fichier dans `FileUploader`) ; à revoir avec la page « À la une » (11.4) si Aurélien le souhaite.

### Review Findings

- [x] [Review][Patch] Erreurs serveur remplaçant la page (404 et 5xx rendus en pages Inertia → `setPage` + `onSuccess`) [app/controllers/admin/thumbnails_controller.ts] — production inconnue ou id mal formé → `thumbnail.errors.not_found`, échec R2/base de `ThumbnailService.set`/`remove` → `logger.error` + `thumbnail.errors.storage` (production supprimée entre-temps → `not_found`), toujours redirection arrière. Erreurs flashées dans `inputErrorsBag` (`flashValidationErrors`) et non par `flashErrors` : seul `inputErrorsBag` devient la prop Inertia `errors` (vérifié dans `@adonisjs/inertia`, `getValidationErrors`). Clés fr/en ; tests (store + destroy inconnus, `putObject` en échec, base en échec au retrait).
- [x] [Review][Patch] Tests AC3 manquants [tests/functional/admin/production_thumbnail.spec.ts] — échec d'écriture en base après l'envoi (variantes neuves supprimées, erreur remontée, clé inchangée) ; échec R2 partiel (2e variante) → variantes envoyées supprimées.
- [x] [Review][Patch] Toast de succès non répété au 2e envoi consécutif (effet d'`AdminLayout` indexé sur la chaîne du flash, layout conservé par `preserveState`) [ThumbnailField.tsx, thumbnails_controller.ts] — plus de flash de succès sur ces deux routes ; `notify.success` émis par la visite du champ.
- [x] [Review][Patch] `onError` sans clé `thumbnail` affichait `invalid_type` ; toast « réseau » sur toute fin sans callback [ThumbnailField.tsx, inertia/lib/thumbnail.ts] — Inertia 2.3.18 n'a ni `onNetworkError` ni `onHttpException` : écoute de `inertia:exception` (aucune réponse HTTP = réseau) et `inertia:invalid` (réponse non Inertia) pendant la visite ; logique pure `visitOutcome` / `thumbnailErrorKey` testée à l'exécution ; erreur générique `thumbnail.errors.storage`.
- [x] [Review][Patch] Ratios extrêmes refusés (« affine: output coordinates out of range » → `photo_type`, ex. 4×10 000 000) [app/services/image_service.ts] — pré-recadrage centré borné (`MAX_RATIO_GAP`, ex-`ATTENTION_MAX_RATIO_GAP`) appliqué à tous les groupes ; tests 1×40000 (vignette + photo d'auteur), 40000×1, 4×10 000 000 (PNG construit à la main, rapide).
- [x] [Review][Defer] Envois simultanés dans plusieurs emplacements : Inertia annule la visite synchrone en cours → 11.4 doit utiliser `async: true` ou un verrou « occupé » au niveau de la page. — **Résolu en 11.4** (verrou de page `onBusyChange`, D-11.4-1).
- [ ] [Review][Defer] `ThumbnailField` ne sait pas encore prévisualiser le poster d'une vidéo (prop poster, mention « Image extraite de la vidéo », DESIGN.md:380) → 11.3.
- [x] [Review][Dismiss] Journal non écrit si `ActivityLogService.log` échoue après le commit — même modèle que les autres contrôleurs admin.
- [x] [Review][Dismiss] Fichiers temporaires d'autres champs fichier non supprimés — hors périmètre.
- [x] [Review][Dismiss] Préfixe orphelin si une vignette est posée pendant la suppression concurrente de la production — déjà accepté (Completion Notes).
- Note (hors story, non corrigé) : `files_controller.ts` utilise `flashErrors`, donc ses erreurs n'atteignent pas `props.errors.file` lu par `FileUploader` (même cause que ci-dessus) → consigné dans deferred-work.md.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites avant le code (functional `production_thumbnail.spec.ts`, unit 16:9, helper, composant) ; premier lancement interrompu (modules `#services/thumbnail_service`, contrôleur et migration absents). Après implémentation : 38 tests ciblés verts.
- `.adonisjs` régénéré (`/tmp/d37/gen.sh`) : seules les deux routes `admin.productions.thumbnail.*` et le contrôleur `Thumbnails` apparaissent. `database/schema.ts` régénéré par la migration locale (`thumbnailKey`, `posterKey`).
- Suite complète `npm run test:local` : **1080 tests verts** (baseline 1053, +27), code de sortie 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`node ace build`, NODE_ENV=production) : code de sortie 0.
- Après revue : **1090 tests verts** (+10), lint 0, typecheck 0, build 0. Ratio extrême vérifié avant correctif : `affine: output coordinates out of range` sur un PNG 4×10 000 000 (ancien chemin), corrigé.
- Migration exécutée sur la base Docker locale de test uniquement (port 5433) ; rien sur Supabase.

### Completion Notes List

- Migration additive `1775918748000` (`productions.thumbnail_key`, `production_files.poster_key`, varchar 255 NULL sans défaut) ; `poster_key` n'est lu ni écrit avant 11.3.
- `ImageService.thumbnailVariants` + `THUMBNAIL_VARIANTS` (w400/w800/w1600, 16:9, WebP, centre) : un seul groupe, donc un seul décodage ; validation et normalisation inchangées (signature, format réel, 5 Mo, 40 Mpx, EXIF retiré).
- `ThumbnailService` : `set` (envoi sous préfixe neuf, verrou `FOR NO KEY UPDATE`, clé écrite après l'envoi, compensation si l'écriture échoue, ancien préfixe supprimé après le commit), `remove` (no-op sans vignette), `discard` best-effort, `signedUrl` (w800, aperçu admin). `ProductionService.delete` supprime le préfixe après la suppression.
- `ThumbnailsController` : garde UUID (404), `thumbnailValidator` (no_file / invalid_type / too_large), `ImageValidationError` traduite en `thumbnail.errors.*` (dont `dimensions`), journal `update` / `production` `{ field: 'thumbnail', op: 'set' | 'remove' }`, flash `thumbnail.uploaded` / `thumbnail.removed`, redirection arrière, fichier temporaire supprimé dans tous les cas.
- `ThumbnailField` + `inertia/lib/thumbnail.ts` : prêt pour `FeaturedSlot` (11.4), monté par aucune page en 11.1 ; formulaire de production et `CompletionIndicator` inchangés (D37, vérifié par test).
- Décisions D-11.1-1 à D-11.1-6 ci-dessus. Fenêtre résiduelle connue : une vignette posée pendant la suppression concurrente de sa production peut laisser un préfixe orphelin dans R2 (sans exposition : jamais servi) — négligeable, non traité.

### File List

- database/migrations/1775918748000_add_thumbnail_and_poster_columns.ts (nouveau)
- database/schema.ts
- app/models/production.ts
- app/models/production_file.ts
- app/services/image_service.ts
- app/services/thumbnail_service.ts (nouveau)
- app/services/production_service.ts
- app/validators/admin/thumbnail_validator.ts (nouveau)
- app/controllers/admin/thumbnails_controller.ts (nouveau)
- start/routes.ts
- .adonisjs/client/registry/index.ts
- .adonisjs/client/registry/schema.d.ts
- .adonisjs/client/registry/tree.d.ts
- .adonisjs/server/controllers.ts
- .adonisjs/server/routes.d.ts
- inertia/lib/thumbnail.ts (nouveau)
- inertia/components/admin/ThumbnailField.tsx (nouveau)
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/functional/admin/production_thumbnail.spec.ts (nouveau)
- tests/unit/services/image_service.spec.ts
- tests/unit/lib/thumbnail.spec.ts (nouveau)
- tests/unit/components/thumbnail_field.spec.ts (nouveau)
- _bmad-output/implementation-artifacts/11-1-vignette-d-une-production-dans-le-panel-admin.md (nouveau)
- _bmad-output/implementation-artifacts/deferred-work.md (revue)

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (migration vignette/poster, profil 16:9 d'`ImageService`, `ThumbnailService`, routes `admin.productions.thumbnail.*`, suppression avec la production, `ThumbnailField`, i18n `thumbnail.*`) ; 1080 tests verts ; statut review.
- 2026-11-21 : revue de code — 5 correctifs (erreurs serveur en erreur de champ sans changement de page, tests AC3, toast de succès émis par le champ, issue de visite `visitOutcome` / toast réseau sur `inertia:exception` seulement, ratios extrêmes bornés pour tous les groupes), 2 reports (11.3, 11.4), 3 rejets ; 1090 tests verts ; statut review.
