---
baseline_commit: fafdea7
---

# Story 9.3 : Photo d'un auteur

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**administrateur** (rôle `admin` ou `super_admin`),
je veux **ajouter, remplacer ou retirer la photo d'un auteur**,
afin d'**illustrer sa fiche, sans exposer de métadonnées personnelles du fichier** (FR52, NFR19).

## Décision de périmètre (lire en premier)

- **DANS 9.3** :
  - dépendance de production `sharp` (P2-08) + vérification du lockfile et de l'image Docker ;
  - `app/services/image_service.ts` : validation réelle (décodage), réorientation, suppression des métadonnées, variantes carrées `w128.webp`, `w384.webp`, `og.jpg` (P2.5) — **seulement le profil « photo d'auteur » 1:1** ; la structure doit permettre d'ajouter plus tard le profil 16:9 des vignettes (Epic 11) sans le coder maintenant ;
  - champ `photo` (fichier facultatif) et `removePhoto` (booléen) dans `author_validator.ts`, `AuthorForm`, `Create`/`Edit` ;
  - écriture R2 sous un préfixe neuf `authors/<id>/<token 20>`, `photo_key` écrit **après** l'envoi, ancien préfixe supprimé ensuite (best-effort, journalisé dans les logs applicatifs), compensation si l'écriture en base échoue ;
  - suppression des variantes à la suppression d'une fiche (complète `AuthorService.delete`, note laissée par 9.2) ;
  - aperçu par URL signée (`FileStorageService.signedUrl`) dans la fiche (`w384`) et la liste admin (`w128`) ; composant `Avatar` (photo ou initiales D13/D25, repli sur les initiales si l'image ne charge pas) ;
  - journal `update` / `author` avec `photo` dans `metadata.fields` ;
  - i18n `authors.form.photo.*` + erreurs ; tests.
- **HORS 9.3 (ne PAS implémenter)** :
  - route publique `GET /media/*`, `MediaController`, `inertia/lib/media.ts`, `og:image`, `SeoService.forAuthor` → **Epic 10** (aucune diffusion publique ici) ;
  - vignettes 16:9, `ThumbnailField`, `ffmpeg`, `VideoFrameService`, `poster_key` → **Epic 11** (ne pas ajouter `ffmpeg` au `Dockerfile` ni à `ci.yml`) ;
  - case / actions de consentement → **9.4** ;
  - conversion des auteurs → **9.5 / 9.6** ; `GET /admin/authors/search` (et son `photoUrl` `w128`) → **9.7** ; `AuthorFormDialog` / `quick-store` → **9.8** (mais `AuthorForm` doit rester réutilisable : le champ photo vit dans `AuthorForm`, piloté par props) ;
  - aucune migration : `authors.photo_key` (varchar 255 NULL) existe depuis 9.1.

## Acceptance Criteria

1. **Dépendance et service** — **Given** `sharp` ajouté aux `dependencies` (pas `devDependencies`) et `app/services/image_service.ts`, **When** une photo est soumise dans `AuthorForm` (création ou modification), **Then** elle est validée par la règle de fichier `photo` (`size: '5mb'`, `extnames: ['jpg','jpeg','png','webp']`, équivalent VineJS de `request.file('photo', …)`) puis par décodage réel (`sharp(…, { limitInputPixels: 40_000_000 }).metadata()` : format ∈ {`jpeg`, `png`, `webp`}) ; sinon erreur en ligne sous le champ photo (`authors.form.errors.photo_type`, `photo_size`, `photo_dimensions` pour > 40 Mpx) et **rien** n'est écrit (ni fiche, ni objet R2) **and** l'image est réorientée (`.rotate()` sans argument), ses métadonnées (EXIF, GPS, ICC personnalisé, XMP) sont supprimées (comportement par défaut de sharp : ne jamais appeler `withMetadata`/`keepMetadata`/`keepExif`), et les variantes carrées `w128.webp` (128×128), `w384.webp` (384×384), `og.jpg` (600×600) sont produites par recadrage centré (`fit: 'cover'`, `position: 'centre'`) ; image animée → première image seulement.
2. **Envoi et clé** — **Given** les variantes produites, **When** elles sont envoyées sur R2 sous un préfixe neuf `authors/<authorId>/<token 20>` (`string.generateRandom(20)`), **Then** `photo_key` (= le préfixe, sans `/` final) est écrit en base **après** l'envoi des trois variantes, puis les variantes de l'ancien préfixe sont supprimées (best-effort : un échec est journalisé par `logger.error`, ne fait jamais échouer la requête) **and** si l'écriture en base échoue après l'envoi, les variantes neuves sont supprimées (compensation de `files_controller.ts`) et l'erreur remonte **and** le journal `update` / `author` contient `photo` dans `metadata.fields` (ajout, remplacement ou retrait) ; la création reste journalisée `create` / `author` `{ name }` (inchangé).
3. **Retrait** — **Given** une fiche avec photo, **When** l'administrateur coche « Retirer la photo » (`removePhoto`) et enregistre, **Then** `photo_key` passe à NULL puis les variantes R2 sont supprimées (best-effort) et le journal mentionne `photo` **and** **When** il supprime la fiche (Story 9.2, suppression autorisée), **Then** les variantes R2 sont supprimées **après** la suppression effective en base (best-effort) ; une suppression refusée (FR55) ne touche pas R2 **and** une nouvelle photo et `removePhoto` envoyés ensemble → la nouvelle photo l'emporte ; `removePhoto` sur une fiche sans photo → aucun changement, aucun `photo` dans le journal.
4. **Aperçu** — **Given** la fiche (`/admin/authors/:id/edit`) ou la liste admin (`/admin/authors`), **When** la photo est affichée, **Then** l'URL est une URL signée `FileStorageService.signedUrl` (`<photo_key>/w384.webp` dans la fiche, `<photo_key>/w128.webp` dans la liste ; aucune diffusion publique) ; sans photo, ou si l'image ne charge pas, les initiales (1re lettre du 1er prénom + 1re lettre du 1er nom, capitales, D13) sont affichées en vert green-800 sur green-100 (D25), `aria-hidden` ; l'image adjacente au nom a `alt=""` (D36) **and** dans `AuthorForm`, le champ photo propose une zone compacte de sélection (JPEG, PNG ou WebP · 5 Mo max), un aperçu avatar lg (96 px) du fichier choisi (URL d'objet libérée) ou de la photo enregistrée, « Retirer la photo » (case `removePhoto`) quand une photo est enregistrée, et un moyen d'annuler le fichier choisi avant l'envoi ; type et taille contrôlés aussi côté client (mêmes clés d'erreur).
5. **Image Docker** — **Given** l'image de production, **When** elle est construite, **Then** `package-lock.json` contient `node_modules/@img/sharp-linux-x64` et `node_modules/@img/sharp-libvips-linux-x64` (test d'infrastructure) **and** `sharp` se charge dans `node:24-bookworm-slim` (étape `runtime`, après `npm ci --omit=dev`), vérifié manuellement (commande en Dev Notes, résultat consigné dans le Debug Log).
6. **Accès et non-régression** — toutes les routes restent dans `middleware.admin()` (aucune nouvelle route) ; la création / modification **sans** photo se comporte exactement comme en 9.1/9.2 (y compris une fiche migrée sans affiliation) ; la suite existante reste verte.
7. **i18n** — nouvelles chaînes dans `inertia/locales/admin/{fr,en}.json` (`authors.form.photo.*`, `authors.form.errors.photo_*`, `authors.form.sections.photo` si une section dédiée est créée), parité vérifiée par `tests/unit/i18n/translations.spec.ts`.

## Tasks / Subtasks

- [x] **T1 — Installer `sharp` et verrouiller les binaires linux-x64** (AC 1, 5)
  - [x] 1.1 En utilisateur `atlas` avec Node 24 (le dépôt appartient à `atlas` ; ne pas créer de fichiers root dans `node_modules`) :
    `sudo -u atlas -H bash -lc 'cd /home/atlas/projects/anta && . "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm install sharp@^0.35.5'`
    (0.35.5 = dernière version au 2026-11-18, `engines.node >=20.9`). Vérifier que `sharp` est dans `dependencies` (pas `devDependencies`).
  - [x] 1.2 Vérifier le lockfile : `grep -nE '"node_modules/@img/sharp-(linux-x64|libvips-linux-x64)"' package-lock.json` doit renvoyer **deux** entrées (avec `"optional": true`, `"os": ["linux"]`, `"cpu": ["x64"]`, et pour sharp-linux-x64 `"libc": ["glibc"]`). npm 10.9 inscrit normalement toutes les variantes de plateforme. **Si l'une manque** : `npm install --os=linux --cpu=x64 --libc=glibc sharp@^0.35.5` (même commande enveloppée), puis revérifier ; en dernier recours supprimer l'entrée `node_modules/sharp` du lock et relancer `npm install`. Ne jamais éditer le lock à la main.
  - [x] 1.3 `git diff --stat package.json package-lock.json` : seules `sharp`, ses dépendances (`@img/*`, `detect-libc`, `semver` éventuels) doivent apparaître — annuler tout ajout parasite.
  - [x] 1.4 Vérification Docker (manuelle, à consigner) :
    `docker build --target runtime -t anta-sharp-check /home/atlas/projects/anta`
    `docker run --rm --entrypoint node anta-sharp-check -e "import('sharp').then(m => console.log(JSON.stringify(m.default.versions)))"`
    → doit afficher `{"sharp":"0.35.x","libvips":"…"}` sans erreur. Puis `docker image rm anta-sharp-check`. (Le build ne lit aucun secret ; ne pas lancer le conteneur avec l'application.)
- [x] **T2 — `ImageService`** (AC 1)
  - [x] 2.1 Créer `app/services/image_service.ts` (docblock anglais). API proposée :
    ```ts
    export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
    export const IMAGE_MAX_PIXELS = 40_000_000
    export const AUTHOR_PHOTO_VARIANTS = [
      { name: 'w128.webp', size: 128, format: 'webp' },
      { name: 'w384.webp', size: 384, format: 'webp' },
      { name: 'og.jpg', size: 600, format: 'jpeg' },
    ] as const
    export type ImageErrorCode = 'photo_type' | 'photo_size' | 'photo_dimensions'
    export class ImageValidationError extends Error { constructor(readonly code: ImageErrorCode) … }
    export type ImageVariant = { name: string; body: Buffer; contentType: 'image/webp' | 'image/jpeg' }
    export default class ImageService {
      /** Validates by real decoding, auto-orients, strips metadata, renders the 1:1 variants. */
      static async authorPhotoVariants(input: string | Buffer): Promise<ImageVariant[]>
    }
    ```
  - [x] 2.2 Implémentation : garde de taille sur l'entrée (`stat`/`Buffer.length` > `IMAGE_MAX_BYTES` → `photo_size`, défense en profondeur et testable sans HTTP) ; `const meta = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).metadata()` dans un `try` : erreur dont le message contient `pixel limit` → `photo_dimensions`, toute autre erreur → `photo_type` ; `meta.format` ∉ {`jpeg`,`png`,`webp`} → `photo_type` (rejette gif, heif, svg, tiff…). Puis pour chaque variante : `sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).rotate().resize(size, size, { fit: 'cover', position: 'centre' })` puis `.webp({ quality: 80 })` ou `.jpeg({ quality: 82, mozjpeg: true })`, `.toBuffer()` (une erreur ici → `photo_type`). Ne pas passer `animated: true` (première image par défaut). Aucun `withMetadata` / `keepMetadata` / `keepExif` / `keepIccProfile`.
  - [x] 2.3 Garder le module générique (profil de variantes en paramètre interne) pour que l'Epic 11 ajoute le profil 16:9 `w400/w800/w1600` sans réécrire ; ne pas exporter de fonction 16:9 maintenant.
- [x] **T3 — Stockage des variantes** (AC 2, 3)
  - [x] 3.1 Ajouter à `FileStorageService` (sans changer `validate`/`upload`, réservés aux fichiers de production) : `static async putObject(key: string, body: Buffer, contentType: string)` (`drive.use('r2').put(key, body, { contentType })`) et `static async deleteObjects(keys: string[])` (`Promise.allSettled` de `disk.delete`, renvoie les échecs, ne lève pas). Ne **pas** utiliser `deleteAll(prefix)` : supprimer explicitement les trois clés connues (`AUTHOR_PHOTO_VARIANTS`), déterministe sur S3 et sur le disque factice.
  - [x] 3.2 Dans `AuthorService` : `static photoKeys(prefix)` → `[\`${prefix}/w128.webp\`, …]` ; `private static async uploadPhoto(authorId, variants): Promise<string>` → préfixe `authors/${authorId}/${string.generateRandom(20)}`, envoi des 3 variantes (si un envoi échoue : supprimer celles déjà envoyées, relancer l'erreur) ; `private static async discardPhoto(prefix | null, context)` → `deleteObjects` + `logger.error({ err, keys }, 'Failed to delete author photo variants')` pour chaque échec (jamais d'exception).
- [x] **T4 — `AuthorService.create` / `update` / `delete`** (AC 2, 3)
  - [x] 4.1 `create(payload, adminId, photo?: ImageVariant[] | null)` : l'identifiant de la fiche doit être connu **avant** l'envoi → générer `const id = randomUUID()` (`node:crypto`) une fois, avant la boucle des essais de slug ; si `photo` : `prefix = await uploadPhoto(id, photo)` **avant** la transaction ; dans `createOnce`, poser `author.id = id` et `author.photoKey = prefix ?? null`. Si la création échoue définitivement (hors relance de slug) → `discardPhoto(prefix)` puis relancer. Les relances sur `authors_slug_unique` réutilisent le même `id` et le même préfixe (la transaction précédente a été annulée).
  - [x] 4.2 `update(author, payload, options: { photo?: ImageVariant[] | null; removePhoto?: boolean } = {})` : étendre `AuthorField` avec `'photo'`. Calcul : `photoChange = photo ? 'replace' : (removePhoto && author.photoKey ? 'remove' : null)` ; `photo` dans `fields` si `photoChange`. Si `fields` vide → retour immédiat (inchangé). Si `replace` : `newPrefix = await uploadPhoto(author.id, photo)` **avant** la transaction. Dans la transaction (verrou `forUpdate` existant) : relire l'ancien `photo_key` **depuis la ligne verrouillée** (pas depuis l'instance, une écriture concurrente a pu le changer), poser `author.photoKey = newPrefix` ou `null`, `updatedAt` explicite (déjà en place), `save`. Échec de la transaction → `discardPhoto(newPrefix)` puis relancer. Après le commit → `discardPhoto(oldPrefix)` si `oldPrefix && oldPrefix !== newPrefix`.
  - [x] 4.3 `delete(author)` : relire `photo_key` sur la ligne verrouillée ; après une suppression effective (hors transaction, après le commit) → `discardPhoto(photoKey)`. Remplacer le commentaire « Story 9.3 will also remove the photo here ». Refus FR55 → R2 intact.
- [x] **T5 — Validateur et contrôleur** (AC 1, 2, 3, 6)
  - [x] 5.1 `author_validator.ts` : `photo: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }).optional()`, `removePhoto: vine.boolean().optional()` (accepte `true/false` JSON et `'1'/'0'` du FormData d'Inertia). Messages : `'photo.file': 'authors.form.errors.photo_type'`, `'photo.file.extname': 'authors.form.errors.photo_type'`, `'photo.file.size': 'authors.form.errors.photo_size'` (noms de règles vérifiés dans `@adonisjs/core/build/vine-*.js` : `file`, `file.size`, `file.extname`). Exporter `PHOTO_MAX_MB = 5`, `PHOTO_EXTNAMES`.
  - [x] 5.2 **Piège multipart (lire « Requête multipart » en Dev Notes)** : quand un fichier est joint, Inertia envoie un `FormData` ; un tableau vide n'y produit **aucun** champ → `affiliations` absent → `affiliations.required`. Rendre `affiliations` `.optional()` dans le schéma et normaliser `const affiliations = data.affiliations ?? []` dans le contrôleur avant `assertAffiliationRule` et le service (la règle ≥ 1 reste garantie par `assertAffiliationRule` pour une fiche non migrée). Supprimer alors le message `affiliations.required` devenu sans objet ou le laisser (inoffensif).
  - [x] 5.3 Ajouter à `ImageService` (ou dans le contrôleur, helper privé) la conversion `ImageValidationError` → `throw new errors.E_VALIDATION_ERROR([{ field: 'photo', message: \`authors.form.errors.${code}\`, rule: code }])` (même mécanisme que `assertAffiliationRule` : erreur flashée sous le champ, redirection arrière).
  - [x] 5.4 `store` : validate → normalisation affiliations → `assertAffiliationRule` → `photo = data.photo ? await ImageService.authorPhotoVariants(data.photo.tmpPath!) : null` (garde : `tmpPath` absent → `photo_type`) → `AuthorService.create(…, photo)`. **Le traitement d'image précède toute écriture.**
  - [x] 5.5 `update` : idem, puis `AuthorService.update(author, data, { photo, removePhoto: data.removePhoto === true })` ; journal inchangé (fields contient désormais `photo`).
  - [x] 5.6 `edit` : prop `photoUrl: author.photoKey ? await FileStorageService.signedUrl(\`${author.photoKey}/w384.webp\`) : null`. `index` : prop `photoUrl` par ligne (`w128`, `Promise.all` sur les 20 lignes ; la signature S3 est locale, sans appel réseau). Si la signature lève (config), journaliser et renvoyer `null` plutôt qu'un 500.
- [x] **T6 — Client : données, validation, envoi** (AC 1, 3, 4)
  - [x] 6.1 `inertia/lib/author_form.ts` : `AuthorFormData` + `photo: File | null`, `removePhoto: boolean` ; `EMPTY_AUTHOR_FORM` (`photo: null`, `removePhoto: false`) ; constantes `PHOTO_MAX_BYTES = 5 * 1024 * 1024`, `PHOTO_MIME_TYPES = ['image/jpeg','image/png','image/webp']`, `PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'` ; `validateAuthorForm` contrôle `photo` (type → `photo_type`, taille → `photo_size`) ; `toAuthorPayload` ajoute `photo` seulement si `File`, `removePhoto: true` seulement si coché **et** sans nouveau fichier ; `authorInitials(firstNames, lastNames)` (1er mot de chaque champ, `Array.from(word)[0]` pour les caractères hors BMP, `toLocaleUpperCase('fr-FR')`).
  - [x] 6.2 `Edit.tsx` : prop `author.photoUrl: string | null` (à exclure de `formData` comme `id`/`isMigrated`/`productionsCount`) ; `useForm` initialisé avec `photo: null, removePhoto: false` ; `put(…)` inchangé (Inertia bascule seul en multipart quand `photo` est un `File` — **pas** de `_method` : `allowMethodSpoofing` est `false` dans `config/app.ts` et le bodyparser Adonis traite le multipart en `PUT`) ; `onSuccess: () => form.reset('photo', 'removePhoto')` ; afficher `form.progress` (facultatif) pendant l'envoi.
  - [x] 6.3 `Create.tsx` : `photo: null, removePhoto: false` dans l'état initial ; `post` inchangé.
- [x] **T7 — Composants** (AC 4)
  - [x] 7.1 `inertia/components/shared/Avatar.tsx` (nouveau, réutilisé par l'Epic 10 et 9.7/9.8) : props `src?: string | null`, `firstNames`, `lastNames`, `size: 'sm' | 'md' | 'lg'` (32 / 56 / 96 px), `alt?: string` (défaut `""`). Cercle `rounded-full` ; photo `object-cover` + `border border-stone-200` ; sinon initiales `bg-green-100 text-green-800 font-semibold uppercase` (`text-xs` sm, `text-base` md, `text-2xl` lg ≈ 40 % du diamètre), `aria-hidden="true"`. `onError` → état `failed` → initiales (réinitialisé quand `src` change).
  - [x] 7.2 `AuthorForm.tsx` : nouvelle section `Section legend={t('authors.form.sections.photo')}` (après « Liens » ou après « Identité » ; défaut : après « Identité ») contenant : `Avatar size="lg"` (aperçu : URL d'objet du fichier choisi, sinon `photoUrl` si `!removePhoto`, sinon initiales) ; `<input type="file" id="photo" accept={PHOTO_ACCEPT} className="sr-only">` + bouton outline « Choisir une photo » / « Remplacer la photo » qui le déclenche (ou label stylé), aide `authors.form.photo.help` reliée par `aria-describedby` ; nom du fichier choisi + bouton « Annuler » (vide `photo` et la valeur de l'input) ; case « Retirer la photo » (`removePhoto`, visible seulement si `photoUrl` et aucun fichier choisi) ; erreur `message('photo')` sous le champ, `aria-invalid` sur l'input (le focus automatique sur le premier `[aria-invalid="true"]` existant doit atteindre le bouton ou l'input visible : poser `aria-invalid` sur l'élément focusable effectivement affiché). URL d'objet : `useEffect` qui crée `URL.createObjectURL(file)` et la révoque au nettoyage. Nouvelle prop `photoUrl?: string | null` (absente en création). Le choix d'un fichier décoche `removePhoto`. Mettre à jour le docblock (« Photo comes with Story 9.3 » → décrit).
  - [x] 7.3 `Authors/Index.tsx` : colonne Auteur = `Avatar size="sm"` (`src={author.photoUrl}`, `alt=""`) + nom lien, en `flex items-center gap-3` ; type de prop `photoUrl: string | null`.
- [x] **T8 — i18n** (AC 7) — FR / EN, parité :
  - `authors.form.sections.photo` : « Photo » / « Photo »
  - `authors.form.photo.choose` : « Choisir une photo » / « Choose a photo » ; `.replace` : « Remplacer la photo » / « Replace photo » ; `.cancel` : « Annuler » / « Cancel » ; `.remove` : « Retirer la photo » / « Remove photo » ; `.help` : « Facultatif. JPEG, PNG ou WebP · 5 Mo max · recadrage carré automatique » / « Optional. JPEG, PNG or WebP · 5 MB max · automatic square cropping » ; `.selected` : « Fichier choisi : {{name}} » / « Selected file: {{name}} » ; `.uploading` : « Envoi de la photo… {{percent}} % » / « Uploading photo… {{percent}}% » (si progression affichée)
  - `authors.form.errors.photo_type` : « Choisissez une image JPEG, PNG ou WebP valide. » / « Choose a valid JPEG, PNG or WebP image. » ; `.photo_size` : « La photo ne doit pas dépasser 5 Mo. » / « The photo must not exceed 5 MB. » ; `.photo_dimensions` : « La photo est trop grande (40 mégapixels au maximum). » / « The photo is too large (40 megapixels maximum). »
- [x] **T9 — Tests** (tous AC) — `npm run test:local` uniquement
  - [x] 9.1 `tests/unit/services/image_service.spec.ts` (images **générées par sharp dans le test**, `sharp({ create: { width, height, channels: 3, background } })`) : JPEG avec EXIF + GPS (`.withExif({ IFD0: { Copyright: 'Test' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 3/1 0/1' } })` — vérifier la syntaxe dans `node_modules/sharp/lib/index.d.ts`) → variantes sans `exif`/`xmp` (`(await sharp(buf).metadata()).exif === undefined`) ; orientation 6 sur une image 300×200 → aucune `orientation` en sortie ; dimensions exactes 128/384/600 carrées, formats `webp`/`webp`/`jpeg` ; PNG et WebP acceptés ; texte renommé `.jpg` → `photo_type` ; GIF/SVG généré → `photo_type` ; tampon > 5 Mo → `photo_size` ; image > 40 Mpx (ex. PNG 7000×6000 uni, petit fichier) → `photo_dimensions`.
  - [x] 9.2 `tests/functional/admin/authors_photo.spec.ts` (`drive.fake('r2')` dans `group.each.setup`, `drive.restore('r2')` au teardown, transaction globale ; fichiers écrits dans `tmpdir()` comme `production_files.spec.ts`) : création multipart avec photo (`client.post('/admin/authors').field('lastNames', …).field('affiliations[0][institution]', …).file('photo', path)`) → `photo_key` `^authors/<id>/[A-Za-z0-9_-]{20}$`, `fakeDisk.assertExists` des 3 clés, contenu relu (`drive.use('r2').getBytes`) sans EXIF ; modification avec nouvelle photo (`client.put`) → nouveau préfixe, anciennes clés `assertMissing`, journal `fields` contient `photo` ; `removePhoto=1` → `photo_key` NULL, clés absentes, journal ; `removePhoto` sans photo → aucun journal ; photo + `removePhoto` → photo remplacée ; fichier texte `.jpg` → erreur flashée `photo` = `authors.form.errors.photo_type`, aucune fiche créée, aucun objet sur le disque factice ; fichier > 5 Mo → `photo_size` ; **fiche migrée sans affiliation modifiée en multipart avec photo** → 302 succès (piège 5.2) ; suppression d'une fiche avec photo → clés absentes ; suppression refusée (pivot) → clés présentes ; `GET edit` → `photoUrl` chaîne non vide quand photo, `null` sinon ; `GET /admin/authors` → `photoUrl` par ligne ; échec R2 simulé à la suppression de l'ancien préfixe (stub de `FileStorageService.deleteObjects` ou du disque) → requête réussie quand même.
  - [x] 9.3 Mettre à jour les attentes existantes touchées par les nouvelles props : `authors_crud.spec.ts` (`deepEqual` de `GET edit` → `photoUrl: null`), `authors_list.spec.ts` si des lignes sont comparées entières, `author_service.spec.ts` (signature `update` avec options facultatives : appels existants inchangés).
  - [x] 9.4 `tests/unit/validators/author_validator.spec.ts` : `affiliations` absent → valide (normalisé à `[]` par le contrôleur), `removePhoto` `'1'`/`true` acceptés.
  - [x] 9.5 `tests/unit/components/author_form.spec.ts` (lecture de source) : `type="file"`, `accept={PHOTO_ACCEPT}`, `URL.revokeObjectURL`, clés `authors.form.photo.*`, `removePhoto` ; nouveau `tests/unit/components/avatar.spec.ts` : `aria-hidden` sur les initiales, `alt` par défaut `""`, `onError`, classes `bg-green-100 text-green-800`, `object-cover`. `authors_index_page.spec.ts` : `<Avatar` dans la colonne Auteur.
  - [x] 9.6 `tests/unit/infrastructure/deployment.spec.ts` : nouveau test « sharp : dépendance de production et binaires linux-x64 glibc dans le lockfile » (`package.json.dependencies.sharp` défini, `lock.packages['node_modules/@img/sharp-linux-x64']` et `['node_modules/@img/sharp-libvips-linux-x64']` définis).
  - [x] 9.7 Suite complète + `npm run typecheck` + `npm run lint` + `node ace build` verts ; régénérer `.adonisjs/*` s'ils changent (`node ace serve` ~45 s sur la base locale) et les committer avec le reste.

## Dev Notes

### Contraintes non négociables

- **Base Supabase partagée dev/staging** : cette story n'a **aucune migration** (`photo_key` existe). Jamais de `migration:run` sous `doppler run`, jamais de `rollback` / `fresh` / `reset` / `db:wipe`.
- **Tests** : uniquement `npm run test:local [-- unit|functional]` (Postgres Docker `anta-test-db`, port 5433) ; jamais sous `doppler run` ; `japa --files` bloque le runner : lancer les suites entières. **Jamais le vrai R2** : `drive.fake('r2')` dans chaque groupe qui écrit ou signe, `drive.restore('r2')` au teardown.
- **Fichiers générés et committés** : `.adonisjs/*`, `database/schema.ts` — régénérés, jamais édités à la main (schema.ts ne devrait pas changer).
- **Frontière TS6305** : tout ce qui est sous `inertia/` se teste par lecture de source, jamais par import.
- **Dépôt public** : noms fictifs uniquement dans les tests ; aucune photo réelle commitée (images générées par sharp dans les tests, jamais de fixture binaire de visage).
- **`sharp`** : ajout approuvé (P2-08). Aucune autre dépendance (pas de `file-type` direct, pas de `multer`, pas de lib de recadrage client).
- Ne pas commiter, ne pas pousser (commit par Aurélien / l'orchestrateur ; push après test par Aurélien).

### Requête multipart (Inertia 2.3.18 + bodyparser Adonis 11) — vérifié dans `node_modules`

- `useForm().put/post` convertit seul les données en `FormData` dès qu'une valeur est un `File` (`hasFiles`) ; sans fichier, la requête reste en JSON (comportement 9.1/9.2 inchangé). Pas besoin de `forceFormData` (le `FileUploader` des productions l'utilise parce qu'il construit ses données à la main).
- Format des tableaux : `form.forceIndicesArrayFormatInFormData` vaut `true` par défaut → `affiliations[0][institution]`, `affiliations[0][department]` ; le bodyparser Adonis (`FormFields`, `lodash.set`) reconstruit `affiliations: [{ institution, department }]`. OK.
- **Tableau vide → aucun champ** : `affiliations: []` disparaît du `FormData` → corrigé par T5.2 (`.optional()` + `?? []`). Ne pas « contourner » en forçant JSON.
- Booléens → `'1'` / `'0'` ; `null`/`undefined` → `''` → `null` (`convertEmptyStringsToNull: true`). `vine.boolean()` accepte ces formes.
- `PUT` multipart : `allowedMethods` du bodyparser inclut `PUT` ; `allowMethodSpoofing: false` (config/app.ts) → **ne pas** envoyer `_method`, ne pas passer en `post`.
- Limite globale multipart `110mb` (`config/bodyparser.ts`, alignée Caddy, testée par `deployment.spec.ts`) : ne pas la toucher ; la limite 5 Mo est portée par la règle `vine.file`.
- Japa : `.field(name, value)` avec des noms à crochets pour les tableaux ; `.file('photo', path)` rend la requête multipart ; garder `.withCsrfToken()`, `.loginAs()`, `.redirects(0)`.
- Les erreurs de validation (dont `E_VALIDATION_ERROR` levée manuellement pour `photo`) sont flashées et ramènent sur la page ; l'ancien fichier n'est pas réaffiché (normal : le champ fichier ne se pré-remplit pas) — `useForm` conserve `photo` côté client tant que la page n'est pas remontée.

### Ordre des écritures (P2.5 « Clé ») — résumé

```
store : valider → images en mémoire (sharp) → id = randomUUID() → upload 3 variantes (authors/<id>/<token>)
        → transaction INSERT (photo_key = préfixe) → [échec] supprimer variantes neuves → journal create
update: valider → images → upload nouveau préfixe → transaction (FOR UPDATE, lire ancien photo_key, écrire nouveau)
        → [échec] supprimer nouveau préfixe → [succès] supprimer ancien préfixe (best-effort, logger.error) → journal update
remove: transaction (photo_key = NULL) → supprimer ancien préfixe (best-effort)
delete: transaction (refus FR55 ou DELETE) → si supprimée : supprimer variantes (best-effort) → journal delete
```

- Préfixe neuf à chaque téléversement : clés immuables (cache d'un an côté `/media` en Epic 10 ; ici, URL signées).
- `photo_key` = préfixe **sans** variante ni `/` final ; les clés se dérivent (`<préfixe>/w128.webp`…). Longueur : `authors/` (8) + uuid (36) + `/` + 20 = 65 ≤ 255.
- Les tampons des variantes (~100 Ko au total) restent en mémoire ; le fichier temporaire du multipart n'est pas déplacé (contrairement à `FileStorageService.upload`).

### Fichiers touchés — état actuel / changement / à préserver

| Fichier | Aujourd'hui (9.2) | Changement 9.3 | À préserver |
|---|---|---|---|
| `package.json`, `package-lock.json` | pas de `sharp` | `sharp@^0.35.5` en `dependencies` | `.npmrc` (`include=dev`), autres versions |
| `app/services/image_service.ts` | absent | nouveau (T2) | — |
| `app/services/file_storage_service.ts` | `validate`/`upload` (fichiers de production, 100 Mo, MIME), `signedUrl`, `signedDownloadUrl`, `delete` | + `putObject`, `deleteObjects` | `validate`/`upload` inchangés (`file_storage_service.spec.ts`) |
| `app/services/author_service.ts` | `create` (relance slug ×3), `update` (verrou, `updatedAt` explicite, retour anticipé si rien ne change), `delete` (verrou, comptage, 23503 du pivot traduit), filtres/compteurs | photo dans `create`/`update`/`delete`, `AuthorField` + `'photo'`, helpers photo | relance de slug sur `authors_slug_unique` seulement ; refus FR55 ; filtres 9.2 |
| `app/validators/admin/author_validator.ts` | schéma 9.1, `assertAffiliationRule` | `photo`, `removePhoto`, `affiliations` optionnel | messages existants, limites partagées avec le client |
| `app/controllers/admin/authors_controller.ts` | `index` (filtres, `withCount`), `create`, `store`, `edit` (`productionsCount`), `update`, `destroy` (retour à la liste filtrée), garde UUID | images avant écriture, `photoUrl` (edit + index), normalisation `affiliations` | journal après commit, flashs, redirections, garde UUID → 404, `listUrlFrom` |
| `inertia/lib/author_form.ts` | types, `formatAuthorName`, `validateAuthorForm`, `toAuthorPayload` | `photo`, `removePhoto`, constantes photo, `authorInitials` | règles et clés existantes (duplication volontaire serveur/client) |
| `inertia/components/admin/AuthorForm.tsx` | identité, affiliations ↑↓×, Google Scholar ; focus sur le 1er `aria-invalid` | section photo | annonces `aria-live`, erreurs indexées masquées après déplacement, focus |
| `inertia/pages/admin/Authors/{Create,Edit}.tsx` | `useForm` + `transform(toAuthorPayload)` + `post`/`put` | état photo, `photoUrl`, reset après succès | suppression (dialog / texte bloquant) de 9.2 |
| `inertia/pages/admin/Authors/Index.tsx` | colonne Auteur = lien nom | + `Avatar sm` | filtres, tooltip, dialog, états vides |
| `inertia/components/shared/Avatar.tsx` | absent | nouveau | — |
| `inertia/locales/admin/{fr,en}.json` | `authors.*` | clés T8 | parité |
| `tests/unit/infrastructure/deployment.spec.ts` | garde-fous Docker/Caddy | test lockfile sharp | autres tests |

### Infra existante (NE PAS réinventer)

- `FileStorageService.signedUrl(key)` (TTL 1 h) ; disque `r2` privé (`config/drive.ts`), `fakes.location = tmp/drive-fakes` ; `drive.fake('r2')` renvoie un `FakeDisk` avec `assertExists` / `assertMissing` et signe des URL (vérifié : `@adonisjs/drive` fournit un `urlBuilder` au disque factice).
- Compensation : `files_controller.ts#store` (`FileStorageService.delete(key).catch((e) => logger.error({ err: e, key }, …))` après un échec d'INSERT).
- Génération de jeton : `string.generateRandom(20)` (`@adonisjs/core/helpers/string`), comme les clés `productions/…`.
- Erreurs de validation manuelles : `errors.E_VALIDATION_ERROR([{ field, message, rule }])` (`assertAffiliationRule`).
- `formatAuthorName` (« Prénom NOM ») dans `inertia/lib/author_form.ts` ; composant `Section` interne à `AuthorForm` ; boutons `outline` / `ghost` shadcn ; icônes `lucide-react` (`ImageUp`/`Upload`, `X`, `Loader2`).
- CSP désactivée (`config/shield.ts`) : les images signées R2 s'affichent sans configuration.

### Notes sharp 0.35 (dernière version 0.35.5 au 2026-11-18)

- Binaires précompilés via paquets facultatifs `@img/sharp-<plateforme>` + `@img/sharp-libvips-<plateforme>` ; plus de script d'installation qui télécharge. `node:24-bookworm-slim` = Debian glibc x64 → `@img/sharp-linux-x64` + `@img/sharp-libvips-linux-x64`. Le build Docker fait `npm ci` puis `npm ci --omit=dev` dans `build/` (lockfile copié par `node ace build`) : les paquets doivent figurer dans le lock (d'où T1.2 et le test T9.6). La CI (`ubuntu-latest`) installe les mêmes binaires : aucun changement de `ci.yml`.
- `import sharp from 'sharp'` (types fournis). Options : `limitInputPixels` au constructeur ; `.rotate()` sans argument = orientation EXIF (`.autoOrient()` existe depuis 0.34, équivalent ; garder `.rotate()` conforme à l'AC) ; métadonnées retirées par défaut en sortie ; `failOn` par défaut `'warning'` (laisser).
- Avant d'écrire le code, relire `node_modules/sharp/lib/index.d.ts` pour la signature exacte de `withExif` (tests) et des options `webp`/`jpeg` de la version installée.
- Pas de `sharp.cache(false)` ni de réglage de concurrence : volume admin faible.

### Gotchas (memory du topic + code)

- Japa : `.withCsrfToken()` sur POST/PUT/DELETE, `.redirects(0)`, `loginAs()` ; `SESSION_DRIVER=memory` (exporté par `test-local.sh`).
- Tuyau : `inertia.render(page, {})` exige le 2e argument ; pas de nouvelle route → registre inchangé, mais vérifier `.adonisjs/` après build.
- Lucid : `author.id = randomUUID()` avant `save()` → la valeur est insérée telle quelle (le défaut `gen_random_uuid()` ne s'applique pas) ; garder `useTransaction(trx)`.
- Lucid saute l'`UPDATE` sans colonne modifiée : `photoKey` modifié rend l'instance sale, `updatedAt` reste posé explicitement.
- Le verrou `FOR UPDATE` de `update`/`delete` sert aussi à lire le `photo_key` courant (deux remplacements simultanés : chacun supprime l'ancien préfixe qu'il a réellement remplacé ; un orphelin éventuel reste possible et acceptable, pas d'erreur).
- Radix / shadcn : pas de nouveau composant shadcn nécessaire ; alias `~/*` ; jamais de `baseUrl`.
- `aria-invalid` doit porter sur un élément focusable visible (l'effet de focus de `AuthorForm` cible `[aria-invalid="true"]`) : si l'input fichier est `sr-only`, il reste focusable — vérifier que le focus est visible (anneau sur le bouton associé via `peer`/`focus-visible`) ou utiliser un input visible stylé.

### Intelligence des stories précédentes (9.1, 9.2)

- Verrou `SELECT … FOR UPDATE` dans la transaction pour sérialiser les écritures d'une fiche ; journal **après** le commit (`ActivityLogService.log` hors transaction, ne lève jamais).
- Relance de création limitée à la contrainte `authors_slug_unique` ; traduction de 23503 limitée à `production_authors_author_id_foreign` : ne pas élargir.
- Revue 9.2 : double soumission gardée par `useRef` dans `DeleteAuthorDialog` ; le bouton « Enregistrer » est `disabled={processing}` — suffisant pour l'envoi de la photo.
- 9.2 a dû compléter un `deepEqual` de `GET edit` après l'ajout d'une prop : même chose ici (`photoUrl`).
- La CLI shadcn a une fois injecté un paquet npm `cn` : vérifier `git diff package.json` après toute commande npm (T1.3).
- Reports ouverts hors périmètre : `page` non borné, `<Link><Button/></Link>`, `normalizeKey` et apostrophes, performance de la recherche (9.7), `role="alertdialog"` sur `Dialog`.
- 539 tests verts à la fin de la revue 9.2.

### Git (branche `feat/epic-9-authors`)

- `33e19b8` / `7e24424` (9.1 + revue), `7826be9` / `fafdea7` (9.2 + revue). Conventions : fichiers `snake_case`, docblocks anglais dans `app/`, commentaires de tests en français, `// Noms fictifs uniquement (dépôt public).` en tête de spec, messages de commit `feat(authors): … (story 9.3)`.

### Project Structure Notes

- Nouveaux fichiers : `app/services/image_service.ts`, `inertia/components/shared/Avatar.tsx` (emplacement fixé par P2.6 : `inertia/components/shared/`, à côté de `Pagination.tsx`), `tests/unit/services/image_service.spec.ts`, `tests/functional/admin/authors_photo.spec.ts`, `tests/unit/components/avatar.spec.ts`.
- Écarts assumés vis-à-vis de l'epic : (1) validation de taille/extension par `vine.file` dans `authorValidator` plutôt qu'un `request.file()` séparé — mêmes options, erreurs en ligne natives, conforme à P2.6 (« `photo` fichier optionnel ») ; (2) clé d'erreur supplémentaire `photo_dimensions` pour le plafond de 40 Mpx ; (3) suppression des trois clés de variantes au lieu d'un `deleteAll(prefix)`.
- Pas de maquette de la fiche auteur pleine page : grille de 9.1 + DESIGN.md « AuthorForm : photo : dropzone compacte + avatar lg en aperçu ». Une vraie zone de glisser-déposer n'est pas exigée (bouton + input suffisent ; glisser-déposer facultatif).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.3] (+ « Règles communes » de l'Epic 9 ; 9.4–9.8 pour le hors-périmètre)
- [Source: _bmad-output/planning-artifacts/architecture.md#P2.5 Vignettes, photos et image extraite] (validation, normalisation, variantes 1:1, clé, compensation, diffusion `/media` hors story)
- [Source: architecture.md#P2.6] (validateur `photo`/`removePhoto`, routes multipart, composants `Avatar`/`AuthorForm`, journal `update` `fields`) ; [#P2.8] (tests `drive.fake`, images générées par sharp, test lockfile) ; [#P2.10] P2-08, P2-10
- [Source: architecture.md#P2.1] (`photo_key` varchar 255 NULL, préfixe `authors/<id>/<token>`)
- [Source: ux-designs/ux-anta-2026-11-16/EXPERIENCE.md] Component Patterns (Avatar, AuthorForm), états (Fiche auteur : erreurs en ligne dont photo), Accessibilité (textes alternatifs, initiales `aria-hidden`), Voice and Tone (aide vignette, modèle de l'aide photo)
- [Source: ux-designs/ux-anta-2026-11-16/DESIGN.md] tokens `avatar-initials-*`, `components.avatar` (32/56/96 px), « Avatars à initiales » (D25), AuthorFormDialog / AuthorForm (dropzone compacte + avatar lg), AdminAuthorsTable (avatar sm + nom)
- [Source: _bmad-output/implementation-artifacts/9-1-*.md, 9-2-*.md] Dev Notes, Review Findings, reports ; `deferred-work.md`
- Code : `app/services/author_service.ts`, `app/controllers/admin/authors_controller.ts`, `app/controllers/admin/files_controller.ts`, `app/services/file_storage_service.ts`, `config/{bodyparser,drive,app,shield}.ts`, `Dockerfile`, `.npmrc`, `tests/functional/admin/production_files.spec.ts`, `tests/unit/infrastructure/deployment.spec.ts`, `node_modules/@inertiajs/core/dist/index.esm.js` (`objectToFormData`), `node_modules/@adonisjs/bodyparser/build/multipart-*.js` (`FormFields`), `/home/atlas/projects/anta/CLAUDE.local.md`

## Questions ouvertes (non bloquantes, défauts retenus)

1. **Plafond de 40 Mpx** : message dédié `photo_dimensions` (défaut) ou fusion avec `photo_size` ? Défaut : clé dédiée, plus claire.
2. **Position de la section Photo** dans `AuthorForm` : après « Identité » (défaut) ou en dernier, après « Liens » ?
3. **Qualité d'encodage** : WebP 80, JPEG 82 mozjpeg (défauts techniques, ajustables sans impact fonctionnel).
4. **Photo choisie mais création refusée par une autre erreur** : le fichier reste sélectionné côté client tant que la page n'est pas rechargée ; rien n'est envoyé sur R2 tant que la validation complète n'a pas réussi (choix par défaut, aucune décision requise sauf avis contraire).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), skill `bmad-dev-story`.

### Debug Log References

- T1.1 : `npm install sharp@^0.35.5` (atlas, Node 24) → `sharp` dans `dependencies`. Seuls `sharp`, `@img/*`, `@emnapi/runtime` et `semver` (7.7.4 → 7.8.6, requis par sharp) changent dans le lock.
- T1.2 : `node_modules/@img/sharp-linux-x64` (`libc: ["glibc"]`) et `node_modules/@img/sharp-libvips-linux-x64` présents dans `package-lock.json` sans option de plateforme.
- T1.4 (Docker, 2026-11-18) : `docker build --target runtime -t anta-sharp-check .` OK ; `docker run --rm --entrypoint node anta-sharp-check -e "import('sharp')…"` → `{"sharp":"0.35.5", "vips":"8.18.7", …}` sans erreur ; en plus, conversion JPEG → WebP 128×128 réussie dans l'image. Image supprimée (`docker image rm anta-sharp-check`).
- Sonde sharp : `metadata()` lève « Input image exceeds pixel limit » au-delà de `limitInputPixels` (PNG 7000×6000) → `photo_dimensions` ; `withExif({ IFD0: { Orientation } })` ne pose pas l'orientation : le test d'orientation utilise `withMetadata({ orientation: 6 })` côté test uniquement.
- Validations finales : `npm run test:local` 583/583 verts (539 avant la story), `npm run lint` vert, `npm run typecheck` vert, `node ace build` vert ; `.adonisjs/*` régénérés sans changement (aucune route ni page nouvelle).

### Completion Notes List

- `ImageService` (`app/services/image_service.ts`) : garde de taille (5 Mo), décodage réel `limitInputPixels: 40_000_000`, formats jpeg/png/webp seulement, `.rotate()`, `resize(cover, centre)`, WebP 80 / JPEG 82 mozjpeg, métadonnées jamais conservées ; profil de variantes interne (`render(input, variants)`) prêt pour le profil 16:9 de l'Epic 11 (non exporté). Les specs de variante portent `width`/`height` (au lieu d'un seul `size`) pour accueillir le 16:9 sans réécriture.
- `FileStorageService.putObject` / `deleteObjects` (ne lève jamais, renvoie les échecs) ; `validate`/`upload` inchangés.
- `AuthorService` : `photoKeys(prefix)`, `uploadPhoto` (préfixe `authors/<id>/<token 20>`, retrait des variantes déjà envoyées si un envoi échoue), `discardPhoto` best-effort (`logger.error` par clé en échec) ; `create(payload, adminId, photo?)` avec `randomUUID()` avant l'envoi, compensation sur échec définitif, relances de slug avec le même id/préfixe ; `update(author, payload, { photo, removePhoto })` (`'photo'` dans `AuthorField`, ancien `photo_key` relu sur la ligne verrouillée, compensation, suppression de l'ancien préfixe après commit) ; `delete` supprime les variantes après une suppression effective seulement.
- Validateur : `photo` (`vine.file` 5 Mo, jpg/jpeg/png/webp), `removePhoto` (`vine.boolean`), `affiliations` optionnel ; contrôleur : normalisation `affiliations ?? []`, traitement d'image avant toute écriture, `ImageValidationError` → `E_VALIDATION_ERROR` sur `photo`, `photoUrl` signée (w384 dans la fiche, w128 par ligne de la liste, `null` + log si la signature échoue).
- Client : `AuthorFormData.photo/removePhoto`, constantes et contrôles client (mêmes clés), `toAuthorPayload` (photo seulement si `File`, `removePhoto` seulement sans nouveau fichier), `authorInitials` ; composant `Avatar` (sm/md/lg, repli sur initiales `aria-hidden` si erreur de chargement) ; section « Photo » après « Identité » dans `AuthorForm` (input `sr-only` focusable portant `aria-invalid`, libellé stylé en bouton outline avec anneau `peer-focus-visible`, aperçu par URL d'objet révoquée, Annuler, « Retirer la photo », progression d'envoi) ; `Edit` (prop `photoUrl`, `reset('photo','removePhoto')` après succès, pas de `_method`) ; `Create` ; `Index` (Avatar sm dans la colonne Auteur).
- i18n FR/EN : `authors.form.sections.photo`, `authors.form.photo.*`, `authors.form.errors.photo_type|photo_size|photo_dimensions`.
- Tests : `image_service.spec.ts` (7), groupe photo de `author_service.spec.ts` (7, dont compensations création/mise à jour/envoi partiel et échec de suppression journalisé), `authors_photo.spec.ts` (13, multipart Japa), `avatar.spec.ts` (5), compléments `author_form.spec.ts`, `authors_index_page.spec.ts`, `author_validator.spec.ts`, `deployment.spec.ts` (lockfile sharp), `authors_crud.spec.ts` (`photoUrl: null`).
- Tests existants adaptés (comportement voulu par la story) : « pas de photo ni de consentement en 9.1 » → « pas encore de consentement (9.4) » ; « affiliations manquantes → refus » vérifie désormais le refus par `assertAffiliationRule` après normalisation (le schéma accepte l'absence, T5.2) ; destructuration de `Edit` avec `photoUrl`.
- Écart mineur : un test supplémentaire refuse un vrai GIF nommé `.gif` par la règle d'extension ; `removePhoto` n'a pas de message dédié (une valeur non booléenne est improbable depuis l'UI).

### File List

- `package.json` (modifié : `sharp`)
- `package-lock.json` (modifié)
- `app/services/image_service.ts` (nouveau)
- `app/services/file_storage_service.ts` (modifié)
- `app/services/author_service.ts` (modifié)
- `app/validators/admin/author_validator.ts` (modifié)
- `app/controllers/admin/authors_controller.ts` (modifié)
- `inertia/lib/author_form.ts` (modifié)
- `inertia/components/shared/Avatar.tsx` (nouveau)
- `inertia/components/admin/AuthorForm.tsx` (modifié)
- `inertia/pages/admin/Authors/Create.tsx` (modifié)
- `inertia/pages/admin/Authors/Edit.tsx` (modifié)
- `inertia/pages/admin/Authors/Index.tsx` (modifié)
- `inertia/locales/admin/fr.json` (modifié)
- `inertia/locales/admin/en.json` (modifié)
- `tests/unit/services/image_service.spec.ts` (nouveau)
- `tests/unit/services/author_service.spec.ts` (modifié)
- `tests/functional/admin/authors_photo.spec.ts` (nouveau)
- `tests/functional/admin/authors_crud.spec.ts` (modifié)
- `tests/unit/components/avatar.spec.ts` (nouveau)
- `tests/unit/components/author_form.spec.ts` (modifié)
- `tests/unit/components/authors_index_page.spec.ts` (modifié)
- `tests/unit/validators/author_validator.spec.ts` (modifié)
- `tests/unit/infrastructure/deployment.spec.ts` (modifié)
- `_bmad-output/implementation-artifacts/9-3-photo-d-un-auteur.md` (ce fichier)

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-11-18 | 0.1 | Story créée (bmad-create-story), statut ready-for-dev. |
| 2026-11-18 | 1.0 | Implémentation (bmad-dev-story) : sharp + `ImageService`, photo d'auteur sur R2 (envoi, remplacement, retrait, suppression avec compensation), aperçu signé + `Avatar`, i18n, 44 tests ajoutés (583 verts). Statut review. |
