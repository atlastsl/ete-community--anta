# Story 4.4 : Upload de fichiers hébergés vers R2

Status: done

## Story

En tant qu'administrateur,
Je veux uploader des fichiers (PDF, EPUB, MP4, MP3, AAC) directement dans le formulaire de production,
Afin d'associer le contenu hébergé à la production pour le rendre accessible aux visiteurs (FR18, NFR3, NFR10, NFR12).

## Acceptance Criteria

**AC1 — Drag-and-drop avec prévisualisation (UX-DR7)**

- **Given** le composant `FileUploader` est affiché dans le formulaire
- **When** l'admin fait glisser un fichier dans la zone de dépôt
- **Then** la bordure devient green-700 animée (état drag-over)
- **And** le nom du fichier et sa taille sont affichés en prévisualisation

**AC2 — Upload valide + enregistrement `production_files`**

- **Given** l'admin sélectionne ou dépose un fichier valide (≤ 100 Mo, MIME autorisé)
- **When** l'upload démarre
- **Then** une barre de progression s'affiche avec le pourcentage d'avancement
- **And** après succès, le fichier apparaît dans la liste des fichiers associés avec son nom et sa taille
- **And** un enregistrement `production_files` est créé avec `file_key` (jamais l'URL complète)

**AC3 — Rejet client : fichier > 100 Mo (NFR3)**

- **Given** l'admin tente d'uploader un fichier > 100 Mo
- **When** la validation côté client s'exécute (avant l'envoi réseau)
- **Then** un message d'erreur s'affiche : "Fichier trop volumineux. Maximum 100 Mo."
- **And** aucune requête réseau n'est envoyée

**AC4 — Rejet client : format non supporté**

- **Given** l'admin tente d'uploader un fichier d'un format non supporté (ex. `.docx`)
- **When** la validation côté client s'exécute
- **Then** un message d'erreur s'affiche : "Format non supporté. Formats acceptés : PDF, EPUB, MP4, MP3, AAC."

**AC5 — Rejet serveur : MIME falsifié (NFR10)**

- **Given** la validation serveur échoue (extension/MIME falsifié côté client)
- **When** `FilesController` traite la requête
- **Then** le fichier est rejeté (aucun upload R2, aucun enregistrement `production_files`) et une erreur est retournée

**AC6 — Suppression d'un fichier**

- **Given** un fichier est uploadé avec succès
- **When** l'admin clique sur "Supprimer" sur ce fichier
- **Then** le fichier est supprimé de R2 via `FileStorageService.delete(fileKey)`
- **And** l'enregistrement `production_files` est supprimé

## Tasks / Subtasks

- [x] **Tâche 1 — Créer le `FilesController` admin** (AC2, AC5, AC6)
  - [x] 1.1–1.4 `files_controller.ts` : `store` (findOrFail production → request.file size/extnames → FileStorageService.validate → upload → ProductionFile.create → flash) + `destroy` (firstOrFail scopé → FileStorageService.delete → delete). Enregistré `Files` dans le registre

- [x] **Tâche 2 — Routes** (AC2, AC6)
  - [x] 2.1 `POST /admin/productions/:productionId/files` + `DELETE .../:fileId` (groupe admin)

- [x] **Tâche 3 — Composant `FileUploader` (UX-DR7)** (AC1, AC2, AC3, AC4, AC6)
  - [x] 3.1–3.9 `FileUploader.tsx` : drag-and-drop (états vide/drag-over green-700/en cours/erreur), validation client AVANT upload (NFR3) via `validateFileConstraints`, upload `router.post` `forceFormData` + `onProgress`, prévisualisation, liste + suppression, constantes dans `inertia/lib/file_constraints.ts`, tout via `t()`

- [x] **Tâche 4 — Intégrer `FileUploader` dans `ProductionForm`** (AC1)
  - [x] 4.1–4.3 Props `productionId?`/`files?` ajoutées ; section Fichiers rend `<FileUploader>` si `productionId`, sinon hint. Create ne passe pas `productionId` (Edit le fera en 4.7)

- [x] **Tâche 5 — Clés i18n** (AC2, AC3, AC4, AC6)
  - [x] 5.1–5.2 `productions.files.*` (drop_hint, browse, uploading, uploaded, deleted, delete, errors.*) FR + EN, parité OK

- [x] **Tâche 6 — Tests fonctionnels** (AC2, AC5, AC6)
  - [x] 6.1–6.6 `production_files.spec.ts` avec `drive.fake('r2')` : 4 tests (upload PDF valide + assertExists, MIME falsifié rejeté + 0 enregistrement, non-auth, delete + assertMissing)
  - [x] 6.7 `FileStorageService.validate` déjà couvert par Story 1.3

- [x] **Tâche 7 — Validation finale**
  - [x] 7.1 `node ace test` → 204 tests passent (200 + 4)
  - [x] 7.2 `npm run lint` → 0 erreur
  - [x] 7.3 `npm run typecheck` → 0 erreur

## Dev Notes

### Flux & contrainte d'architecture (IMPORTANT)

Un `production_files` exige un `production_id` (FK NOT NULL, CASCADE). L'upload n'est donc possible **qu'après la création de la production** (brouillon enregistré). Or la page de **création** (Story 4.3) n'a pas encore d'id (elle redirige vers la liste après save).

Conséquence de l'ordre des stories (upload **avant** édition) :
- 4.4 livre l'**endpoint** (`FilesController`) + le **composant** `FileUploader`, intégrés dans `ProductionForm`.
- Le `FileUploader` est **fonctionnel uniquement quand un `productionId` est disponible** — c'est-à-dire sur la page d'**édition** (Story 4.7). Sur la page de création, la section affiche le hint « enregistrez d'abord le brouillon ».
- Les AC de 4.4 (validation, R2, enregistrement, suppression) sont **livrées et testées au niveau du contrôleur** (tests fonctionnels avec `drive.fake()`). Les états visuels du composant (drag-over, progression) relèvent d'une vérification manuelle (pas de suite browser configurée).

> C'est la conséquence normale du séquencement. Le flux complet (créer brouillon → éditer → uploader → publier) se referme en Story 4.7.

### `FileStorageService` (Story 1.3) — déjà complet, à réutiliser tel quel

```ts
FileStorageService.validate(file)            // throws FileValidationError si taille/MIME invalide
FileStorageService.upload(file, key)         // moveFromFs vers R2, retourne la key
FileStorageService.signedUrl(fileKey)        // URL signée TTL 1h (utilisé en Epic 6)
FileStorageService.delete(fileKey)           // supprime de R2
```
Constantes exportées : `ALLOWED_MIME_TYPES` (`application/pdf`, `application/epub+zip`, `video/mp4`, `audio/mpeg`, `audio/aac`), `MAX_FILE_SIZE_BYTES` (100 Mo). **Pas besoin d'un nouveau `FileUploadValidator` VineJS** — la validation route (`request.file` options) + `FileStorageService.validate` couvrent FR/NFR. (Déviation mineure vs archi qui listait `FileUploadValidator.ts` — non nécessaire ici.)

### Modèle `ProductionFile` (Story 1.2) — champs

`id`, `productionId`, `fileKey`, `originalName`, `mimeType`, `sizeBytes`, `storageProvider` (défaut `'r2'`), `createdAt`, `updatedAt`. FK `production_id` → `productions.id` `onDelete('CASCADE')` (la suppression d'une production efface ses fichiers en BDD — mais PAS de R2 ; le nettoyage R2 à la suppression de production est géré en Story 4.7).

### Génération de la `file_key`

Format : `productions/${production.id}/${string.generateRandom(20)}.${file.extname}`. Stocker **uniquement la key** (jamais l'URL complète — règle architecture). `string` depuis `@adonisjs/core/helpers`.

### Pattern contrôleur `store` — cible

```ts
import string from '@adonisjs/core/helpers/string'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import FileStorageService, { FileValidationError } from '#services/file_storage_service'

async store({ request, params, response, session }: HttpContext) {
  const production = await Production.findOrFail(params.productionId)
  const file = request.file('file', {
    size: '100mb',
    extnames: ['pdf', 'epub', 'mp4', 'mp3', 'aac'],
  })

  if (!file) {
    session.flashErrors({ file: 'productions.files.errors.no_file' })
    return response.redirect().back()
  }

  try {
    FileStorageService.validate(file)
  } catch (error) {
    if (error instanceof FileValidationError) {
      session.flashErrors({ file: 'productions.files.errors.invalid' })
      return response.redirect().back()
    }
    throw error
  }

  const key = `productions/${production.id}/${string.generateRandom(20)}.${file.extname}`
  await FileStorageService.upload(file, key)

  await ProductionFile.create({
    productionId: production.id,
    fileKey: key,
    originalName: file.clientName,
    mimeType: `${file.type}/${file.subtype}`,
    sizeBytes: file.size,
    storageProvider: 'r2',
  })

  session.flash('success', 'productions.files.uploaded')
  return response.redirect().back()
}
```

### Sémantique du rejet (AC5)

L'AC parle de « 422 ». Conformément au pattern Inertia du projet (validation → 302 + flash errors), le rejet est réalisé via `session.flashErrors({ file })` + `redirect().back()` : l'erreur remonte dans `props.errors.file` et s'affiche dans le `FileUploader`. La défense en profondeur reste effective : **aucun upload R2, aucun `production_files`** pour un fichier invalide (le MIME est détecté côté serveur via les octets magiques par le bodyparser AdonisJS, indépendamment de l'extension). Documenter ce choix.

### Validation client (NFR3) — FileUploader

Avant tout envoi réseau, vérifier :
- `file.size <= 100 * 1024 * 1024` → sinon erreur `errors.too_large`
- extension ∈ `['pdf','epub','mp4','mp3','aac']` (et/ou `file.type` ∈ whitelist MIME) → sinon `errors.unsupported_format`

Définir les constantes côté client (dupliquées depuis le serveur — duplication intentionnelle comme la double validation VineJS/Zod de l'archi) dans le composant ou un petit module `inertia/lib/file_constraints.ts`.

### Upload Inertia avec progression

```tsx
router.post(`/admin/productions/${productionId}/files`, { file }, {
  forceFormData: true,
  preserveScroll: true,
  onProgress: (event) => setProgress(event?.percentage ?? 0),
  onFinish: () => setProgress(null),
})
```
Après succès, Inertia recharge la page → la liste `files` (prop) reflète le nouvel enregistrement (la liste vient du contrôleur de la page parente, ex. Edit en 4.7).

### Tests avec `drive.fake()`

```ts
import drive from '@adonisjs/drive/services/main'
// setup
const fakeDisk = drive.fake('r2')
// ... uploads vont en mémoire ...
// assertions : fakeDisk.exists(key) / absence
// teardown
drive.restore('r2')
```
Pour un PDF valide en test : écrire un buffer commençant par les octets `%PDF-1.4` (détecté `application/pdf` par le bodyparser). Attacher via api-client `.file('file', tmpPath)`. Créer le tmp via `node:fs` dans le test.

### Fichiers à créer

| Fichier | Description |
|---|---|
| `app/controllers/admin/files_controller.ts` | `store` (upload) + `destroy` (suppression) |
| `inertia/components/admin/FileUploader.tsx` | Composant drag-and-drop (UX-DR7) |
| `inertia/lib/file_constraints.ts` *(optionnel)* | Constantes whitelist + taille (client) |
| `tests/functional/admin/production_files.spec.ts` | Tests upload/delete avec `drive.fake()` |

### Fichiers à modifier

| Fichier | Modification |
|---|---|
| `start/routes.ts` | Routes `POST`/`DELETE` fichiers (groupe admin) |
| `.adonisjs/server/controllers.ts` | Import `Files` |
| `inertia/components/admin/ProductionForm.tsx` | Section Fichiers : rendre `FileUploader` si `productionId` |
| `inertia/locales/admin/fr.json` | Clés `productions.files.*` |
| `inertia/locales/admin/en.json` | Mêmes clés traduites |

### Anti-patterns à éviter

- **NE PAS** stocker l'URL R2 complète — uniquement la `file_key` (règle architecture)
- **NE PAS** uploader vers R2 avant la validation serveur (`FileStorageService.validate` AVANT `upload`)
- **NE PAS** créer le `production_files` si l'upload R2 échoue (ordre : validate → upload → create)
- **NE PAS** se fier uniquement à la validation client — le serveur revalide (MIME via octets magiques)
- **NE PAS** réimplémenter la validation : réutiliser `FileStorageService.validate` (Story 1.3)
- **NE PAS** rendre le `FileUploader` fonctionnel sans `productionId` (page création → hint)
- **NE PAS** toucher à R2 réel dans les tests — utiliser `drive.fake('r2')`
- **NE PAS** importer `Link` depuis `@inertiajs/react` — `router` depuis `@inertiajs/react` est OK pour les actions

### Tests — patterns à suivre

- `drive.fake('r2')` en setup / `drive.restore('r2')` en teardown ; transaction rollback DB.
- Fichier PDF valide : buffer `%PDF-1.4\n%âãÏÓ\n...` écrit en tmp, attaché via `.file('file', tmpPath)`.
- Fichier invalide : un `.txt` (octets texte) → MIME `text/plain` détecté → rejet.
- Vérifier : `ProductionFile.query().where('productionId', p.id)` (présence/absence) + `fakeDisk.exists(key)`.
- Auth `.loginAs(admin).withCsrfToken()` ; un seul POST/DELETE par test.
- `redirect().back()` nécessite un header `Referer` — l'api-client peut l'envoyer via `.header('referer', '/admin/productions')` si besoin, sinon `redirect().back()` retombe sur `/`. Vérifier le code de statut 302 plutôt que la cible exacte.

### Sécurité

- Routes sous `AdminMiddleware`. Admin et super_admin peuvent gérer les fichiers.
- Validation serveur stricte (taille + MIME réel) — défense contre extension/MIME falsifié (NFR10).
- `file_key` opaque (random) sous `productions/{id}/` — pas d'énumération facile ; accès public via URL signée TTL 1h (Epic 6).
- CSRF automatique (multipart inclut le token via `forceFormData` + cookie).

### Dépendances cross-story

- **Story 1.3** : `FileStorageService` + config R2 (réutilisés tels quels).
- **Story 1.2** : modèle `ProductionFile`, migration, relation `Production.files`.
- **Story 4.3** : `ProductionForm` (section Fichiers réservée à compléter) ; `hasFileOrLink` du `CompletionIndicator`.
- **Story 4.5** : `LinkManager` (liens externes) — complétera `hasFileOrLink`.
- **Story 4.7** : page `Edit` fournira `productionId` + `files` → `FileUploader` pleinement fonctionnel ; nettoyage R2 à la suppression de production.
- **Story 6.x** : `signedUrl` pour servir/télécharger les fichiers côté public.

### Previous Story Intelligence

**Story 4.3 :**
- `ProductionForm` a une section "Fichiers & Liens" avec un hint placeholder (`productions.form.files_placeholder`) — à enrichir conditionnellement.
- `hasFileOrLink` est passé au `CompletionIndicator` (false en création).
- Pattern : `router` d'`@inertiajs/react` pour les actions ; flash → toast (Story 4.1).

**Story 4.2 :**
- Enregistrement d'un nouveau contrôleur dans `.adonisjs/server/controllers.ts` (ajout manuel).

**Revue Epic 3 / général :**
- Prettier : multi-lignes ; lancer `npx prettier --write` au besoin.
- `node ace migration:run` déjà appliqué pour `session_version` ; pas de migration nouvelle ici.

### Project Structure Notes

- `app/controllers/admin/files_controller.ts`, `inertia/components/admin/FileUploader.tsx` → prévus dans l'arborescence architecture.
- Tests dans `tests/functional/admin/`.

### References

- [Source: epics.md#Story 4.4] — Acceptance criteria
- [Source: epics.md#FR18] — Association de fichiers hébergés
- [Source: epics.md#NFR3/NFR10/NFR12] — 100 Mo max, formats whitelist, intégrité
- [Source: ux-design-specification.md:770-772] — `FileUploader` (états drag-over/progress/erreur, validation client)
- [Source: architecture.md#Upload Fichiers R2] — validate→upload→key, jamais l'URL
- [Source: app/services/file_storage_service.ts] — service complet (validate/upload/signedUrl/delete)
- [Source: app/models/production_file.ts] — modèle
- [Source: database/migrations/1775918734339_create_production_files_table.ts] — table + FK CASCADE
- [Source: config/drive.ts] — disque `r2` (S3)
- [Source: inertia/components/admin/ProductionForm.tsx] — section Fichiers à enrichir
- [Source: _bmad-output/implementation-artifacts/4-3-formulaire-creation-production.md] — Intelligence story précédente
- [Source: _bmad-output/implementation-artifacts/1-3-*] — FileStorageService (si présent)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context)

### Debug Log References

- `drive.fake('r2')` exige une config `fakes` dans le `DriveManager` (sinon `RuntimeException`). Non auto-injectée par `@adonisjs/drive` → ajout de `fakes: { location: app.tmpPath('drive-fakes') }` dans `config/drive.ts`. Sans effet en production.
- FakeDisk (flydrive) expose `assertExists(key)` / `assertMissing(key)` (utilisés dans les tests) plutôt qu'un `exists()` async.
- `drive.fake('r2')` appelé une seule fois par test (capture du FakeDisk) ; `drive.restore('r2')` en teardown. Pas d'appel dans le setup pour éviter le double-fake.
- Le PDF de test est généré avec octets magiques `%PDF-1.4` (détecté `application/pdf` par le bodyparser) ; le fichier « MIME falsifié » est un `.pdf` contenant du texte → détecté `text/plain` → rejeté par `FileStorageService.validate` (défense en profondeur AC5).

### Completion Notes List

- **AC1 satisfait** : `FileUploader` drag-and-drop avec états (vide/drag-over green-700/en cours/erreur) + prévisualisation nom/taille.
- **AC2 satisfait** : upload valide → barre de progression (`onProgress`), `production_files` créé avec `file_key` (jamais l'URL), fichier sur R2 (vérifié via fake `assertExists`).
- **AC3/AC4 satisfaits** : validation client (`validateFileConstraints`) AVANT envoi → messages `too_large` / `unsupported_format`, aucune requête réseau (NFR3).
- **AC5 satisfait** : MIME falsifié rejeté côté serveur (octets magiques) — aucun upload R2, aucun `production_files` (test vérifie count=0).
- **AC6 satisfait** : suppression → `FileStorageService.delete` + `production_files` supprimé (test vérifie `assertMissing` + record null).
- **Contrainte de flux documentée** : `FileUploader` fonctionnel uniquement avec `productionId` → page création affiche le hint, plein fonctionnement en Edit (Story 4.7).
- Tests : 204/204. Lint + typecheck verts.

### File List

**Créés :**
- `app/controllers/admin/files_controller.ts` — `store` (upload) + `destroy`
- `inertia/components/admin/FileUploader.tsx` — drag-and-drop (UX-DR7)
- `inertia/lib/file_constraints.ts` — constantes + `validateFileConstraints`/`formatBytes` (client)
- `tests/functional/admin/production_files.spec.ts` — 4 tests (drive.fake)

**Modifiés :**
- `start/routes.ts` — routes upload/delete fichiers
- `.adonisjs/server/controllers.ts` — import `Files`
- `inertia/components/admin/ProductionForm.tsx` — section Fichiers conditionnelle (`FileUploader` si `productionId`)
- `config/drive.ts` — ajout config `fakes` (pour `drive.fake` en test)
- `inertia/locales/admin/fr.json` — clés `productions.files.*`
- `inertia/locales/admin/en.json` — mêmes clés traduites

### Change Log

- 2026-06-01 : Implémentation Story 4.4 (Upload fichiers R2). `FilesController` (validate→upload→record / delete), `FileUploader` drag-and-drop avec validation client (NFR3) + progression, `file_constraints.ts`, intégration conditionnelle dans `ProductionForm`, config `fakes` drive, i18n FR/EN. 4 tests fonctionnels avec `drive.fake('r2')`. Tests totaux : 204/204.

## Review Findings

- [x] [Review][Patch] Orphelin R2 si `ProductionFile.create` échoue — RÉSOLU : `store()` enveloppe le `create` dans un try/catch ; en cas d'échec, `FileStorageService.delete(key)` supprime l'objet R2 (compensation) avant de relancer l'erreur. [app/controllers/admin/files_controller.ts:store]
- [x] [Review][Patch] Erreur serveur de rejet fichier (AC5) jamais affichée — RÉSOLU : `FileUploader` lit `usePage().props.errors.file` et l'affiche (traduit) sous la zone de dépôt. [inertia/components/admin/FileUploader.tsx]
- [x] [Review][Patch] Zone de dépôt non gardée + multi-fichiers — RÉSOLU : `upload()`/`handleDrop` gardés par `progress !== null` ; dépôt de >1 fichier → message `one_at_a_time` (aucun upload). [inertia/components/admin/FileUploader.tsx]
- [x] [Review][Patch] Clé R2 avec extension client — RÉSOLU : extension dérivée du type RÉEL validé via `MIME_TO_EXT` (fallback `file.extname` puis `bin`). [app/controllers/admin/files_controller.ts:store]
- [x] [Review][Defer] `mime_type` stocké depuis `file.type`/`file.subtype` (déclaré client) plutôt que du type vérifié par magic bytes — risque de mismatch si utilisé en `Content-Type` au serving. Pas de sink en Epic 4 (serving = Epic 6). Reporté à l'Epic 6. [app/controllers/admin/files_controller.ts] (source: blind)
