---
baseline_commit: 1aaec89
---

# Story 11.3 : Image extraite des vidéos hébergées

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur**,
je veux **qu'une vidéo hébergée sans vignette soit illustrée par une image extraite automatiquement**,
afin de **pouvoir la mettre à la une sans préparer d'image** (FR50, D10).

## Décision de périmètre (lire en premier)

- Story **sans migration** (`production_files.poster_key` existe depuis 11.1), **sans dépendance npm** (ffmpeg = paquet apt, lancé par `node:child_process`), **sans nouvelle route** (`GET|HEAD /media/*` existe ; `posters/` s'ajoute à la table de résolveurs de `MediaService`, D-11.2-1).
- **DANS 11.3** :
  - `ffmpeg` par apt dans l'étape `runtime` du `Dockerfile` (avant `USER node`) et dans le job de `ci.yml` ; garde-fou dans `deployment.spec.ts` ;
  - `VideoFrameService` : extraction de l'image à t = 1 s (repli t = 0) vers un PNG temporaire, `execFile` sans shell, délai maximal 20 s, fichiers temporaires toujours supprimés ; jamais d'exception vers l'appelant pour le chemin « non bloquant » ;
  - profil « poster » d'`ImageService` (mêmes variantes 16:9 `THUMBNAIL_VARIANTS`) ;
  - `PosterService` : envoi des variantes sous `posters/<fileId>/<token 20>`, écriture conditionnelle de `poster_key`, suppression best-effort, URL signée d'aperçu admin, choix du poster affiché (règle P2.1) ;
  - `FilesController.store` (extraction avant `FileStorageService.upload`, envoi + `poster_key` après la création de la ligne) et `destroy` (suppression du poster) ; `ProductionService.delete` (posters des fichiers) ;
  - `MediaService` : préfixe `posters/` servi (poster courant d'un fichier vidéo d'une production publiée), `productionImageUrl` avec repli sur le poster ; `posterUrl` pour le lecteur ;
  - page de détail : attribut `poster` du lecteur vidéo (`MediaViewer`) ;
  - `ThumbnailField` : aperçu de l'image extraite + mention « Image extraite de la vidéo » (`thumbnail.extracted`) quand il n'y a pas de vignette ;
  - commande `node ace thumbnails:extract-video-frames [--dry-run]` (rattrapage, idempotente).
- **HORS 11.3 (ne PAS implémenter)** :
  - page « À la une », `FeaturedSlot`, `ProductionPicker`, `FeaturedService.requiresThumbnail`, refus `thumbnail.errors.required_for_featured` → **11.4** (consommateurs de `PosterService.displayed` et de la prop d'aperçu du poster) ;
  - prop `featured` / `FeaturedBanner` → **11.6** (consommateur de `productionImageUrl`) ;
  - **exécution réelle** de la commande sur Supabase / R2 : porte manuelle d'Aurélien (voir AC 8) — jamais lancée depuis une session de dev ;
  - aucune image dans les cartes ni `og:image` de production (D37, inchangé) ; le formulaire de production ne montre ni vignette ni poster.

## Acceptance Criteria

1. **ffmpeg dans l'image et la CI** — **Given** le `Dockerfile` et `.github/workflows/ci.yml`, **When** l'image est construite ou la CI s'exécute, **Then** `ffmpeg` est installé (`apt-get install -y --no-install-recommends ffmpeg` dans l'étape `runtime`, avant `USER node`, listes apt supprimées ; étape apt avant les tests dans le job CI) **and** `tests/unit/infrastructure/deployment.spec.ts` vérifie la présence de `ffmpeg` dans le `Dockerfile` (étape `runtime`, avant `USER node`) et dans `ci.yml`.
2. **Extraction** — **Given** `VideoFrameService.extract(inputPath)`, **When** une vidéo lisible est fournie, **Then** l'image à t = 1 s est extraite en PNG par `execFile('ffmpeg', ['-ss','1','-i',input,'-frames:v','1','-f','image2','-c:v','png', out])` (options de sûreté ajoutées : `-nostdin`, `-hide_banner`, `-protocol_whitelist file`, entrée préfixée `file:`), sans shell, délai maximal 20 s (processus tué au-delà) ; vidéo < 1 s (aucune image produite) → repli `-ss 0` ; le dossier temporaire est **toujours** supprimé (succès, échec, délai dépassé).
3. **Téléversement** — **Given** un MP4 téléversé via `FilesController.store`, **When** le fichier est valide, **Then** l'image est extraite **avant** `FileStorageService.upload` (qui déplace le fichier temporaire) et convertie en variantes 16:9 (`w400.webp`, `w800.webp`, `w1600.webp`) ; **après** la création de la ligne `production_files`, les variantes sont envoyées sous `posters/<fileId>/<token 20>` puis `poster_key` est écrit **and** un échec (ffmpeg absent, fichier corrompu, délai, R2, base) est journalisé (`logger.warn`/`error`) et **ne fait jamais échouer** le téléversement (`poster_key` reste NULL, flash `productions.files.uploaded`) **and** les autres types (PDF, MP3…) ne lancent jamais ffmpeg.
4. **Suppression** — **Given** un fichier vidéo avec poster, **When** sa suppression (`FilesController.destroy`) ou celle de sa production (`ProductionService.delete`) aboutit, **Then** les variantes de son poster sont supprimées de R2 (best-effort, après la suppression en base).
5. **Diffusion** — **Given** `GET /media/posters/<fileId>/<token>/<variante>`, **When** le préfixe est le `poster_key` courant d'un fichier `video/mp4` d'une production **publiée**, **Then** le flux est servi (`image/webp`, `Cache-Control: public, max-age=31536000, immutable`, ETag/304, HEAD) ; sinon (brouillon, ancienne clé, fichier supprimé, variante inconnue, clé mal formée) 404 `no-store`, clé mal formée → aucune requête.
6. **Image affichée (P2.1)** — `MediaService.productionImageUrl({ status, thumbnailKey, files })` renvoie `/media/<thumbnail_key>` si la production publiée a une vignette, sinon `/media/<poster_key>` du premier fichier `video/mp4` pourvu d'un poster (ordre `created_at`, puis `id`), sinon `null` ; retirer la vignette fait réapparaître l'image extraite sans retraitement **and** le lecteur vidéo de la page de détail reçoit `posterUrl` (`/media/<poster_key>/w1600.webp`, `null` sans poster) et l'utilise comme attribut `poster`.
7. **`ThumbnailField`** — **Given** une production sans vignette dont une vidéo hébergée a un poster, **When** le champ s'affiche avec `posterPreviewUrl` (URL signée `w800`, `PosterService.signedUrl`), **Then** il présente l'aperçu 16:9 de l'image extraite avec la mention `{typography.meta}` « Image extraite de la vidéo » (`thumbnail.extracted`, fr/en) et le bouton « Téléverser une vignette » (pas de « Retirer » : l'image extraite ne se retire pas) ; avec une vignette, la vignette prime (comportement 11.1 inchangé).
8. **Rattrapage** — **Given** `node ace thumbnails:extract-video-frames [--dry-run]`, **When** elle est exécutée, **Then** elle traite les fichiers `video/mp4` sans `poster_key` (ordre de création), affiche un rapport (à traiter / traitées / échecs) et n'écrit rien (ni base, ni R2) en `--dry-run` **and** elle est idempotente (une 2e exécution ne trouve plus rien à traiter ; écriture conditionnée à `poster_key IS NULL`) **and** code de sortie 1 s'il y a des échecs **and** **porte manuelle** : l'exécution réelle (base partagée + R2) a lieu une seule fois sur le VPS de dev en `atlas` via `doppler run`, avec l'accord explicite d'Aurélien, `--dry-run` d'abord ; les comptages sont consignés dans cette story.

## Tasks / Subtasks

- [x] **T1 — ffmpeg (Dockerfile, CI)** (AC 1)
  - [x] 1.1 `Dockerfile` étape `runtime` : `RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*` avant `RUN chown node:node /app` / `USER node`.
  - [x] 1.2 `ci.yml` : étape « Install ffmpeg » (`sudo apt-get update && sudo apt-get install -y --no-install-recommends ffmpeg`) avant les migrations/tests.
  - [x] 1.3 `deployment.spec.ts` : ffmpeg dans l'étape runtime avant `USER node`, et dans `ci.yml` avant les tests.
- [x] **T2 — `VideoFrameService`** (AC 2)
  - [x] 2.1 `app/services/video_frame_service.ts` : `extract(inputPath): Promise<Buffer>` (dossier `mkdtemp(tmpdir()/anta-frame-)`, `execFile` promisifié, `timeout` + `killSignal: 'SIGKILL'`, budget global 20 s partagé avec le repli, `rm -rf` dans `finally`) ; erreur typée `VideoFrameError` ; `binary` / `timeoutMs` statiques (tests).
  - [x] 2.2 `posterVariants(inputPath): Promise<ImageVariant[] | null>` : extraction + `ImageService.posterVariants`, jamais d'exception (`logger.warn`).
  - [x] 2.3 `ImageService.posterVariants(input)` : mêmes variantes 16:9, plafond d'octets propre (image produite par ffmpeg, pas un envoi utilisateur ; 40 Mpx toujours appliqués).
- [x] **T3 — `PosterService`** (AC 3, 4, 6, 7)
  - [x] 3.1 `app/services/poster_service.ts` : `keys(prefix)`, `attach(fileId, variants)` (envoi sous préfixe neuf ; `UPDATE … WHERE id AND poster_key IS NULL` ; 0 ligne ou échec → suppression des envoyées ; renvoie la clé ou `null`, jamais d'exception), `discard(prefix)` best-effort, `signedUrl(prefix)`, `displayed(files)` (premier `video/mp4` avec poster, `created_at` puis `id`).
  - [x] 3.2 `FilesController.store` : `VideoFrameService.posterVariants(file.tmpPath)` si `video/mp4` avant l'envoi ; `PosterService.attach` après `ProductionFile.create`.
  - [x] 3.3 `FilesController.destroy` et `ProductionService.delete` : `PosterService.discard(posterKey)` après la suppression en base.
- [x] **T4 — Diffusion et image affichée** (AC 5, 6)
  - [x] 4.1 `MediaService.parsePosterKey`, résolveur `posters` (une requête : `production_files` ⨝ `productions`, `poster_key` courant, `mime_type = video/mp4`, `status = published`), cache `THUMBNAIL_CACHE_CONTROL`.
  - [x] 4.2 `productionImageUrl({ status, thumbnailKey, files? })` avec repli via `PosterService.displayed` ; `posterUrl(file)`.
  - [x] 4.3 `public/productions_controller.ts#show` : `posterUrl` par fichier ; `MediaViewer` : `poster={posterUrl ?? undefined}` sur `<video>` ; type `MediaFile`.
- [x] **T5 — `ThumbnailField`** (AC 7)
  - [x] 5.1 Prop `posterPreviewUrl?: string | null` ; sans vignette et avec poster : aperçu `aspect-video object-cover alt=""` + `<p>` meta `thumbnail.extracted` ; i18n fr/en.
- [x] **T6 — Commande de rattrapage** (AC 8)
  - [x] 6.1 `commands/thumbnails_extract_video_frames.ts` (`startApp: true`, imports paresseux dans `run()`, `--dry-run`) : fichiers `video/mp4` sans poster ; par fichier, flux R2 (`disk.getStream`) vers un fichier temporaire, `posterVariants`, `attach`, temporaire supprimé dans `finally` ; rapport ; code 1 si échecs.
- [x] **T7 — Tests** (tous les AC)
  - [x] 7.1 Unit `video_frame_service.spec.ts` (MP4 de 2 s et de 0,4 s générés par ffmpeg `lavfi testsrc` dans le setup : PNG produit, repli < 1 s, fichier corrompu → erreur / `null`, binaire absent → `null`, délai dépassé → `null`, aucun dossier temporaire restant).
  - [x] 7.2 Functional `production_files_poster.spec.ts` (`drive.fake('r2')`) : poster créé au téléversement d'un MP4 (3 variantes, `poster_key`), vidéo < 1 s, fichier corrompu → téléversement OK et `poster_key` NULL, PDF sans ffmpeg, échec R2 du poster non bloquant, suppression du fichier → poster supprimé, suppression de la production → posters supprimés.
  - [x] 7.3 `media.spec.ts` / `media_service.spec.ts` : `/media/posters` servi / 404 (brouillon, ancienne clé, autre variante, id croisé, mal formé) ; `parsePosterKey` ; `productionImageUrl` (vignette prime, repli poster, ordre de création, brouillon, retrait de vignette) ; `PosterService.displayed`.
  - [x] 7.4 Détail : `posterUrl` exposé ; `media_viewer.spec.ts` (`poster=`) ; `thumbnail_field.spec.ts` (`posterPreviewUrl`, `thumbnail.extracted`).
  - [x] 7.5 Commande (`ace.create`) : `--dry-run` sans écriture (ni base ni R2), exécution réelle (poster créé), 2e exécution sans rien à traiter, échec compté + code 1.
  - [x] 7.6 Suite complète `npm run test:local`, `npm run lint`, `npm run typecheck`, build — tous verts.

## Dev Notes

### État actuel (fichiers UPDATE)

- `app/controllers/admin/files_controller.ts` : `request.file('file', { size: '100mb', extnames })`, `FileStorageService.validate` (MIME réel par octets magiques), `upload` = `moveFromFs` (déplace `tmpPath`), puis `ProductionFile.create` (compensation R2 si l'INSERT échoue) ; `destroy` : R2 puis ligne.
- `app/services/thumbnail_service.ts` (11.1) : modèle d'envoi (préfixe neuf, `Promise.allSettled`, suppression des envoyées) et `discard` / `deleteKeys` (jamais d'exception).
- `app/services/image_service.ts` : `render(input, variants)` privé, `assertValid` (5 Mo, signature, format, 40 Mpx) ; `THUMBNAIL_VARIANTS` (16:9) réutilisé tel quel (docblock prévoit 11.3).
- `app/services/media_service.ts` (10.2, 11.2) : `resolve` dispatché par premier segment ; `productionImageUrl({ status, thumbnailKey })` ; `THUMBNAIL_CACHE_CONTROL`.
- `app/models/production_file.ts` : `posterKey` déclaré (11.1), jamais lu ni écrit avant 11.3.
- `app/controllers/public/productions_controller.ts#show` : fichiers avec URL signée ; `inertia/components/public/MediaViewer.tsx` : `<video controls preload="metadata" src={url}>`.
- `inertia/components/admin/ThumbnailField.tsx` (11.1) : non monté avant 11.4 ; props `productionId`, `previewUrl`, `hasThumbnail`.

### Garde-fous

- ffmpeg : `execFile` (jamais `exec` ni `shell: true`), arguments en tableau, entrée `file:<chemin>` (un nom commençant par un protocole ou `-` n'est jamais interprété), `-protocol_whitelist file` (aucune référence externe suivie), `-nostdin`, sortie dans un dossier `mkdtemp` propre à l'appel.
- Le chemin non bloquant (`posterVariants`, `attach`) ne lève jamais ; `extract` lève (`VideoFrameError`) pour les tests.
- Clés : préfixe sans `/` final, jeton `string.generateRandom(20)` (compatible `TOKEN` de `MediaService`), suppression par clés explicites (jamais `deleteAll`).
- `poster_key` écrit seulement si encore NULL : un rattrapage concurrent ou un fichier supprimé entre-temps n'écrase rien et ne laisse pas d'orphelin.
- Dépôt public : vidéos de test générées par ffmpeg (`testsrc`), aucun binaire commité.
- Rien contre Supabase ni R2 (`drive.fake('r2')`) ; la commande réelle est une porte manuelle d'Aurélien.

### Tests

- `drive.fake('r2')` + `drive.restore('r2')`, `db.beginGlobalTransaction()` ; `.withCsrfToken()`, `.redirects(0)`, `loginAs()`.
- MP4 généré une fois par fichier de test (`ffmpeg -f lavfi -i testsrc=size=320x180:rate=10 -t 2 -c:v mpeg4`), petit et rapide ; encodeur `mpeg4` natif (pas de dépendance à libx264).
- Commandes : `ace.create(Cmd, argv)` + `ace.ui.switchMode('raw')` (modèle `authors_conversion.spec.ts`).

### Références

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.3] et en-tête de l'Epic 11 (règle d'image P2.1).
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.1] `poster_key` ; [#P2.5] « Image extraite », « Diffusion » ; P2-09, P2-10, D37 ; « Tests » (MP4 de 2 s généré par ffmpeg), « Build » (`deployment.spec.ts`).
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md:380] ThumbnailField (mention « Image extraite de la vidéo ») ; [EXPERIENCE.md:92, 128, 261].
- [Source: 11-1-…md] `[Review][Defer]` aperçu du poster dans `ThumbnailField` ; [Source: 11-2-…md] D-11.2-1 (table de résolveurs), D-11.2-5 (signature de `productionImageUrl`).

## Décisions (D-11.3-n)

- **D-11.3-1** : rattrapage par **téléchargement du flux R2 dans un fichier temporaire** (`disk.getStream`) plutôt que ffmpeg sur l'URL signée (P2.5) : ffmpeg n'ouvre jamais le réseau (`-protocol_whitelist file`), même code d'extraction que le téléversement, testable avec le disque factice ; coût : chaque vidéo (≤ 100 Mo) est lue en entier, acceptable pour un rattrapage unique.
- **D-11.3-2** : poster affiché = premier fichier `video/mp4` **pourvu d'un poster** (ordre `created_at`, puis `id`), et non le premier MP4 même sans poster : cohérent avec la règle FR50 de 11.4 (« une vidéo hébergée avec `poster_key` »).
- **D-11.3-3** : le PNG extrait n'est pas soumis au plafond de 5 Mo des envois (une image 4K en PNG le dépasse) : `ImageService.posterVariants` applique un plafond de 64 Mo et toujours la limite de 40 Mpx (une image 8K = 33 Mpx).
- **D-11.3-4** : délai de 20 s = budget **total** de l'extraction (repli `-ss 0` compris), processus tué par `SIGKILL`.
- **D-11.3-5** : lecteur de la page de détail : `poster` = `/media/<poster_key>/w1600.webp` (URL publique stable, la production est publiée) ; pas de `srcset` possible sur `poster`.
- **D-11.3-6** : `ThumbnailField` sans vignette avec poster : pas de bouton « Retirer » (l'image extraite ne se retire pas, elle suit la vidéo) ; « Téléverser une vignette » la remplace à l'affichage.
- **D-11.3-7** : commande en code de sortie 1 dès qu'un fichier échoue (rapport complet affiché d'abord) ; idempotence par sélection `poster_key IS NULL` et écriture conditionnelle.

## Review Findings

- [x] [Review][Patch] Posters orphelins à la suppression [app/controllers/admin/files_controller.ts, app/services/production_service.ts] — `poster_key` / `thumbnail_key` lus avant le DELETE : un `attach` validé entre-temps laissait ses variantes dans R2. Les clés supprimées viennent maintenant de `DELETE … RETURNING poster_key` (fichier), et `DELETE production_files … RETURNING file_key, poster_key` + `DELETE productions … RETURNING thumbnail_key` dans une transaction (production) ; un fichier ajouté entre la lecture et le DELETE voit aussi son objet R2 supprimé. Course testée de façon déterministe (écriture du poster / de la vignette pendant la suppression R2 du fichier, entre la lecture et le DELETE).
- [x] [Review][Patch] Durcissement ffmpeg [app/services/video_frame_service.ts] — `-threads 1`, `-update 1` (muxer image2), réduction dans ffmpeg au plus petit format couvrant 1600×900 (`scale` conditionnel, jamais d'agrandissement) : une image 8K n'approche plus `VIDEO_FRAME_MAX_BYTES`.
- [x] [Review][Patch] Commande : remplissage concurrent compté comme échec [commands/thumbnails_extract_video_frames.ts] — `attach` refusé et `poster_key` déjà posé → « déjà traité » (rapport « Traitées · déjà traitées · échecs », code inchangé) ; `mkdtemp` dans le `try` ; message distinct lecture R2 / copie (dossier temporaire, disque). Testé.
- [x] [Review][Patch] `ThumbnailField` : poster en échec de chargement faisait disparaître la figure [inertia/components/admin/ThumbnailField.tsx] — figure et légende conservées, repli `thumbnail.preview_unavailable` comme pour la vignette.
- [x] [Review][Patch] Tests insuffisants [tests/unit/services/video_frame_service.spec.ts, tests/functional/admin/production_files_poster.spec.ts, tests/functional/admin/thumbnails_extract_video_frames.spec.ts] — vidéo rouge puis bleue à t = 1 s (le test échoue avec `-ss 0` seul), vrai délai dépassé avec un faux binaire qui dort (`SIGKILL`, < 5 s), MP4 audio seul → téléversement OK sans poster, dossiers `anta-video-*` supprimés après la commande.
- [x] [Review][Patch] Documents [architecture.md P2.1/P2.5, epics.md Epic 11 / Story 11.3] — amendés le 2026-11-21 (D-11.3-1 copie temporaire, D-11.3-2 premier MP4 pourvu d'un poster), historique des éditions.
- [ ] [Review][Defer] Plafond mémoire d'ffmpeg (`mem_limit` du conteneur ou `prlimit`) — consigné dans deferred-work.md, à décider avec le serveur de production (8.6).
- Rejetés : aucun constat bloquant.

## Questions ouvertes (non bloquantes, défauts retenus)

1. Exécution réelle du rattrapage (porte manuelle) : à lancer par Aurélien après merge (`doppler run -- node ace thumbnails:extract-video-frames --dry-run`, puis sans `--dry-run`) ; comptages à consigner ici.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Phase rouge : specs écrites avant le code ; tests de source (Dockerfile/CI, `ThumbnailField`, `MediaViewer`) → 4 échecs ; specs de services/commande en échec d'import (`video_frame_service`, `poster_service`, commande absents). Après implémentation : 134 tests ciblés verts (10 fichiers).
- Constat empirique : ffmpeg 6.1 avec `-ss 1` sur une vidéo de 0,4 s sort en code 0 **sans** écrire d'image → le repli `-ss 0` se déclenche sur l'absence du PNG, pas sur le code de sortie.
- `'<video controls'` du test 6.2 remplacé par `/<video\s+controls/` (prettier passe les attributs à la ligne avec `poster`).
- `media_service.spec.ts` (11.2) : la clé `posters/…` bien formée n'est plus « mal formée » → remplacée par des clés poster mal formées ; l'espion compte aussi `ProductionFile.query` (témoin : une clé poster bien formée = 1 requête).
- Lint : 4 erreurs `no-await-expression-member` corrigées dans les nouveaux tests.
- Suite complète `npm run test:local` : **1151 tests verts** (baseline 1116, +35), code de sortie 0. `npm run lint` : 0. `npm run typecheck` : 0. Build (`/tmp/d37/build.sh`) : 0.
- Revue : course couverte par un test déterministe (poster et vignette écrits entre la lecture et le DELETE). Après correctifs : **1157 tests verts** (+6), `npm run test:local` code 0, lint 0, typecheck 0, build 0. Réduction ffmpeg vérifiée à la main : 3840×1600 → 2160×900, 1080×1920 et 320×180 inchangés.
- Essai manuel `/tmp/d37/local.sh node ace thumbnails:extract-video-frames --dry-run` (base locale 5433) : « 0 vidéo(s) sans image extraite », code 0. Rien contre Supabase ni R2 ; l'image Docker n'a pas été construite localement (ligne apt vérifiée par `deployment.spec.ts`, construite par la CI de déploiement).

### Completion Notes List

- ffmpeg par apt dans l'étape `runtime` du `Dockerfile` (avant `chown`/`USER node`, listes apt supprimées) et étape « Install ffmpeg » dans `ci.yml` avant les migrations et tests.
- `VideoFrameService.extract` : `execFile` sans shell, `-nostdin -hide_banner -loglevel error -protocol_whitelist file -ss 1 -i file:<chemin absolu> -frames:v 1 -f image2 -c:v png <out>`, repli `-ss 0`, budget total 20 s (`SIGKILL`), dossier `mkdtemp` supprimé dans `finally` ; `posterVariants` ne lève jamais (`logger.warn`). `ImageService.posterVariants` : mêmes variantes 16:9, plafond 64 Mo (D-11.3-3).
- `PosterService` : `keys`, `attach` (préfixe neuf `posters/<fileId>/<token20>`, `UPDATE … WHERE poster_key IS NULL`, sinon variantes supprimées ; jamais d'exception), `discard`, `signedUrl` (aperçu admin `w800`), `displayed` (D-11.3-2).
- `FilesController.store` : extraction avant `FileStorageService.upload` (MP4 seulement), `attach` après `ProductionFile.create` ; `destroy` et `ProductionService.delete` suppriment les posters après la base.
- `MediaService` : `parsePosterKey`, résolveur `posters` (une requête jointe : poster courant + `video/mp4` + production publiée, cache d'un an `immutable`), `productionImageUrl({ status, thumbnailKey, files })` avec repli poster, `posterUrl` (`w1600`). Contrôleur et middleware `/media` inchangés (D-11.2-1 tenue).
- Détail : `posterUrl` par fichier, attribut `poster` du `<video>` de `MediaViewer`.
- `ThumbnailField` : prop `posterPreviewUrl` ; sans vignette, aperçu 16:9 de l'image extraite + légende `thumbnail.extracted` (fr « Image extraite de la vidéo », en « Frame extracted from the video »), sans « Retirer » (D-11.3-6). Toujours monté par aucune page (11.4).
- Commande `thumbnails:extract-video-frames [--dry-run]` : imports paresseux, flux R2 → fichier temporaire (D-11.3-1), rapport « Traitées : n · échecs : m », code 1 si échec, idempotente. **Exécution réelle non faite** (porte manuelle d'Aurélien, voir Questions ouvertes).
- Décisions D-11.3-1 à D-11.3-7 ci-dessus.

### File List

- Dockerfile
- .github/workflows/ci.yml
- app/services/video_frame_service.ts (nouveau)
- app/services/poster_service.ts (nouveau)
- app/services/image_service.ts
- app/services/media_service.ts
- app/services/production_service.ts
- app/controllers/admin/files_controller.ts
- app/controllers/public/productions_controller.ts
- commands/thumbnails_extract_video_frames.ts (nouveau)
- inertia/components/admin/ThumbnailField.tsx
- inertia/components/public/MediaViewer.tsx
- inertia/pages/production.tsx
- inertia/locales/admin/fr.json
- inertia/locales/admin/en.json
- tests/video_fixtures.ts (nouveau)
- tests/unit/services/video_frame_service.spec.ts (nouveau)
- tests/unit/services/media_service.spec.ts
- tests/unit/services/image_service.spec.ts
- tests/unit/components/thumbnail_field.spec.ts
- tests/unit/components/media_viewer.spec.ts
- tests/unit/infrastructure/deployment.spec.ts
- tests/functional/admin/production_files_poster.spec.ts (nouveau)
- tests/functional/admin/thumbnails_extract_video_frames.spec.ts (nouveau)
- tests/functional/public/media.spec.ts
- _bmad-output/planning-artifacts/architecture.md (revue : D-11.3-1, D-11.3-2)
- _bmad-output/planning-artifacts/epics.md (revue : D-11.3-1, D-11.3-2)
- _bmad-output/implementation-artifacts/deferred-work.md (revue : plafond mémoire)
- _bmad-output/implementation-artifacts/11-3-image-extraite-des-videos-hebergees.md (nouveau)

## Change Log

- 2026-11-21 : story créée (contexte complet, statut ready-for-dev).
- 2026-11-21 : implémentation (ffmpeg apt Dockerfile/CI, `VideoFrameService`, `PosterService`, poster au téléversement et suppressions, `/media/posters/…`, repli poster de `productionImageUrl`, `poster` du lecteur, aperçu « Image extraite de la vidéo » de `ThumbnailField`, commande de rattrapage) ; 1151 tests verts ; statut review.
- 2026-11-21 : revue de code — 6 correctifs (clés supprimées par `RETURNING` contre les posters/vignettes orphelins, durcissement ffmpeg `-threads 1` / réduction / `-update 1`, « déjà traité » dans la commande, repli d'aperçu du poster, tests t = 1 s / SIGKILL / audio seul / temporaires, documents amendés), 1 report (plafond mémoire) ; 1157 tests verts ; statut done.
