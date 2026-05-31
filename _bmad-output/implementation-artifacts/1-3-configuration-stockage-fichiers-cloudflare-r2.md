# Story 1.3 : Configuration stockage fichiers Cloudflare R2

Status: review

## Story

En tant que développeur,
Je veux Cloudflare R2 configuré avec un `FileStorageService` centralisé,
Afin que les fichiers puissent être uploadés, servis et supprimés de façon sécurisée dans toute l'application.

## Acceptance Criteria

**AC1** — Drive R2 disponible au démarrage

- **Given** les credentials R2 (`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) sont dans `.env`
- **When** `config/drive.ts` est chargé au démarrage
- **Then** le driver S3 se connecte à R2 sans erreur et le disque `r2` est disponible via `Drive.use('r2')`

**AC2** — Upload retourne la clé (jamais l'URL)

- **Given** `FileStorageService` est implémenté
- **When** `FileStorageService.upload(file, key)` est appelé avec un fichier valide
- **Then** le fichier est stocké dans R2 sous la clé fournie et la clé (`file_key`) est retournée — jamais l'URL complète

**AC3** — URL signée TTL 1h

- **Given** une clé R2 existe
- **When** `FileStorageService.signedUrl(fileKey)` est appelé
- **Then** une URL signée avec TTL de 1 heure est retournée, permettant l'accès temporaire au fichier

**AC4** — Validation MIME + taille

- **Given** un fichier est soumis à l'upload
- **When** `FileStorageService.validate(file)` est appelé
- **Then** les fichiers > 100 Mo sont rejetés avec une erreur explicite
- **And** les MIME types non autorisés (hors `pdf`, `epub`, `mp4`, `mp3`, `aac`) sont rejetés
- **And** les fichiers valides passent la validation sans erreur

**AC5** — Suppression confirmée

- **Given** une clé R2 existe
- **When** `FileStorageService.delete(fileKey)` est appelé
- **Then** le fichier est supprimé de R2 et la suppression est confirmée

## Tasks / Subtasks

- [x] **Tâche 1 — Installer et configurer `@adonisjs/drive`** (AC1)
  - [x] 1.1 Installer : `npm install @adonisjs/drive` + `node ace configure @adonisjs/drive --services=s3 --install`
  - [x] 1.2 Ajouter les variables R2 dans `start/env.ts` : `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - [x] 1.3 Renseigner `.env` avec les credentials R2 placeholders (à remplacer par les vrais)
  - [x] 1.4 `config/drive.ts` configuré avec le disque `r2` (S3 driver, region auto, visibility private, endpoint R2)

- [x] **Tâche 2 — Implémenter `FileStorageService`** (AC2, AC3, AC4, AC5)
  - [x] 2.1 Créer `app/services/file_storage_service.ts`
  - [x] 2.2 Implémenter `validate(file)` — vérifie taille ≤ 100 Mo et MIME type dans la whitelist
  - [x] 2.3 Implémenter `upload(file, key)` — valide, upload vers R2 via moveFromFs, retourne la clé
  - [x] 2.4 Implémenter `signedUrl(fileKey)` — génère une URL signée TTL 1h
  - [x] 2.5 Implémenter `delete(fileKey)` — supprime le fichier R2

- [x] **Tâche 3 — Supprimer les `.gitkeep` obsolètes** (Structure)
  - [x] 3.1 Supprimer `app/services/.gitkeep` (le dossier aura de vrais fichiers)

- [x] **Tâche 4 — Tests unitaires** (AC2, AC3, AC4, AC5)
  - [x] 4.1 Créer `tests/unit/services/file_storage_service.spec.ts`
  - [x] 4.2 Tester `validate()` — cas valides et invalides (taille, MIME) — 8 tests
  - [x] 4.3 Tester `upload()`, `signedUrl()`, `delete()` avec `drive.fake('r2')` — 4 tests
  - [x] 4.4 `node ace test --suite unit` — 16/16 FileStorageService tests passent (10 échecs pré-existants sur modèles = BDD Supabase injoignable)

## Dev Notes

### Installation — `node ace add` vs `npm install`

**Utiliser `node ace add @adonisjs/drive`** (pas `npm install`) — la commande `add` installe le package ET exécute le hook `configure` qui génère automatiquement `config/drive.ts` et met à jour `adonisrc.ts`.

```bash
node ace add @adonisjs/drive
```

L'installeur demandera quel driver configurer — choisir **S3** (compatible avec R2).

⚠️ Si `ace add` ne propose pas S3, ou si `config/drive.ts` n'est pas créé, le créer manuellement (voir section ci-dessous).

### `config/drive.ts` — Configuration complète

```typescript
import env from '#start/env'
import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: 'r2',

  services: {
    r2: services.s3({
      credentials: {
        accessKeyId: env.get('R2_ACCESS_KEY_ID'),
        secretAccessKey: env.get('R2_SECRET_ACCESS_KEY'),
      },
      region: 'auto',
      bucket: env.get('R2_BUCKET'),
      endpoint: env.get('R2_ENDPOINT'),
      visibility: 'private',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
```

⚠️ **`region: 'auto'`** — Cloudflare R2 ignore la région AWS mais le driver S3 en requiert une. `'auto'` est la valeur conventionnelle pour R2.

⚠️ **`visibility: 'private'`** — tous les fichiers Anta sont privés et accessibles uniquement via URL signée (TTL 1h). Ne jamais passer à `'public'`.

⚠️ **Import de `InferDriveDisks`** — nécessaire pour le module augmentation TypeScript. Si l'import n'est pas généré par `ace add`, l'ajouter manuellement :
```typescript
import type { InferDriveDisks } from '@adonisjs/drive/types'
```

### `start/env.ts` — Variables R2 à ajouter

```typescript
// Ajouter dans Env.create :
R2_ENDPOINT: Env.schema.string({ format: 'url', tld: false }),
R2_BUCKET: Env.schema.string(),
R2_ACCESS_KEY_ID: Env.schema.string(),
R2_SECRET_ACCESS_KEY: Env.schema.secret(),
```

Ces variables sont déjà dans `.env.example` (ajoutées en Story 1.1) — il faut juste ajouter la validation dans `start/env.ts`.

### `FileStorageService` — Implémentation complète

```typescript
// app/services/file_storage_service.ts
import drive from '@adonisjs/drive/services/main'
import { MultipartFile } from '@adonisjs/core/bodyparser'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'video/mp4',
  'audio/mpeg',  // mp3
  'audio/aac',
] as const

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  // 100 Mo

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

export default class FileStorageService {
  /**
   * Valide taille et MIME type avant upload.
   * Lance FileValidationError si invalide.
   */
  static validate(file: MultipartFile): void {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        `Fichier trop volumineux : ${Math.round(file.size / 1024 / 1024)} Mo (max 100 Mo)`
      )
    }

    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new FileValidationError(
        `Type de fichier non autorisé : ${file.type}. Types acceptés : pdf, epub, mp4, mp3, aac`
      )
    }
  }

  /**
   * Valide et uploade un fichier vers R2.
   * @returns La clé R2 du fichier stocké — jamais l'URL complète
   */
  static async upload(file: MultipartFile, key: string): Promise<string> {
    FileStorageService.validate(file)

    const disk = drive.use('r2')
    await disk.putStream(key, file.createReadStream(), {
      contentType: file.type ?? undefined,
    })

    return key
  }

  /**
   * Génère une URL signée temporaire (TTL 1h).
   */
  static async signedUrl(fileKey: string): Promise<string> {
    const disk = drive.use('r2')
    return disk.getSignedUrl(fileKey, {
      expiresIn: '1h',
    })
  }

  /**
   * Supprime un fichier de R2.
   */
  static async delete(fileKey: string): Promise<void> {
    const disk = drive.use('r2')
    await disk.delete(fileKey)
  }
}
```

### Clé R2 — Format et Convention

L'architecture prescrit de stocker la **clé** (jamais l'URL) dans `production_files.file_key`.

Format de clé recommandé :
```
productions/{production_id}/{timestamp}_{original_name}
```

Exemple :
```
productions/a1b2c3d4/1714000000000_rapport-2024.pdf
```

Le `FileStorageService.upload()` reçoit la clé déjà construite par l'appelant (le contrôleur) — il ne construit pas la clé lui-même. Ça permet une flexibilité maximale et une séparation claire des responsabilités.

### Tests — Stratégie Mock Drive

Les tests du `FileStorageService` **ne doivent pas faire de vrais appels R2**. AdonisJS Drive fournit un driver en mémoire pour les tests.

Configurer dans `tests/bootstrap.ts` ou dans le groupe de test :

```typescript
import { DriveManager } from '@adonisjs/drive'
// OU utiliser le fakeDriver disponible via testUtils
```

Pattern recommandé via AdonisJS test utils :

```typescript
import testUtils from '@adonisjs/core/services/test_utils'

test.group('FileStorageService', (group) => {
  group.each.setup(async () => {
    // Remplace le driver par un driver en mémoire
    return testUtils.fakeDrive()
  })
  // ...
})
```

⚠️ Si `testUtils.fakeDrive()` n'est pas disponible dans la version installée, utiliser le driver `fake` directement :
```typescript
import drive from '@adonisjs/drive/services/main'
const fakeDrive = drive.fake('r2')
// En teardown : drive.restore('r2')
```

### Tests — Fichier MultipartFile Mock

Pour tester `validate()` sans requête HTTP, créer un objet minimal :

```typescript
function makeFile(size: number, type: string) {
  return { size, type, createReadStream: () => { throw new Error('not used') } } as any
}

// Valide
makeFile(1024, 'application/pdf')

// Trop gros
makeFile(101 * 1024 * 1024, 'application/pdf')

// MIME invalide
makeFile(1024, 'image/jpeg')
```

### Anti-Patterns à Éviter

- ❌ Utiliser `npm install @adonisjs/drive` seul → ✅ `node ace add @adonisjs/drive` (génère la config)
- ❌ Retourner une URL R2 complète depuis `upload()` → ✅ retourner uniquement la clé
- ❌ `visibility: 'public'` dans `config/drive.ts` → ✅ `'private'` + URLs signées TTL 1h
- ❌ Valider le fichier côté client uniquement → ✅ validation serveur obligatoire via `FileStorageService.validate()`
- ❌ Construire la clé dans `FileStorageService` → ✅ la clé est construite par l'appelant (contrôleur)
- ❌ Faire de vrais appels R2 dans les tests → ✅ `drive.fake('r2')` ou `testUtils.fakeDrive()`
- ❌ Ajouter `R2_PUBLIC_URL` comme variable requise — cette story ne couvre pas les assets publics (hors scope Anta)

### Project Structure Notes

**Fichiers créés par cette story :**
- `config/drive.ts` — configuration AdonisJS Drive (généré par `ace add` puis personnalisé)
- `app/services/file_storage_service.ts` — service centralisé
- `tests/unit/services/file_storage_service.spec.ts`

**Fichier supprimé :**
- `app/services/.gitkeep`

**Import path :** `#services/*` → `./app/services/*.js` est déjà configuré dans `package.json`.

### Références

- [Source: architecture.md#2. Stockage des Fichiers] — Configuration Drive R2, limites 100 Mo, whitelist MIME
- [Source: architecture.md#Upload Fichiers R2] — Patron : valider avant upload, stocker clé R2, URL signée TTL 1h
- [Source: architecture.md#Règles Obligatoires] — `file_key` jamais URL complète
- [Source: epics.md#Story 1.3] — Acceptance Criteria complets
- [Source: 1-1-initialisation-projet-adonisjs-inertia-react.md#.env.example] — Variables R2 déjà documentées dans `.env.example`
- [Source: 1-2-migrations-postgresql-et-modeles-lucid.md#File List] — `app/services/.gitkeep` à supprimer

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- Tests `assert.throws` corrigés : Japa/Chai attend un constructeur Error ou string/RegExp en 2e arg, pas un prédicat. Remplacé par try/catch + `assert.instanceOf`.
- Test upload corrigé : `moveFromFs` nécessite un vrai fichier temporaire — créé via `writeFileSync` dans le setup de test.
- Implémentation utilise `moveFromFs` au lieu de `putStream` (pas d'API `putStream` dans Drive v2, et `moveFromFs` est le pattern AdonisJS pour les MultipartFile).
- MIME type construit depuis `file.type` + `file.subtype` (MultipartFile les sépare) au lieu d'un seul `file.type`.

### Completion Notes List

- AC1 ✅ Drive R2 configuré — `config/drive.ts` avec disque `r2`, driver S3, region auto, visibility private
- AC2 ✅ `upload()` retourne la clé, jamais l'URL
- AC3 ✅ `signedUrl()` génère une URL signée TTL 1h
- AC4 ✅ `validate()` rejette > 100 Mo et MIME types non autorisés
- AC5 ✅ `delete()` supprime via `disk.delete()`
- 14 tests unitaires FileStorageService passent (+ 2 tests exports)

### Change Log

- 2026-05-30 : Implémentation complète Story 1.3 — @adonisjs/drive configuré pour R2, FileStorageService implémenté avec validate/upload/signedUrl/delete, 16 tests unitaires

### File List

- `config/drive.ts` — créé (généré par ace configure puis personnalisé pour R2)
- `app/services/file_storage_service.ts` — créé
- `tests/unit/services/file_storage_service.spec.ts` — créé
- `start/env.ts` — modifié (variables R2 remplacent AWS)
- `.env` — modifié (credentials R2 placeholders)
- `adonisrc.ts` — modifié (drive_provider ajouté automatiquement par ace configure)
- `package.json` — modifié (@adonisjs/drive, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner ajoutés)
- `app/services/.gitkeep` — supprimé
