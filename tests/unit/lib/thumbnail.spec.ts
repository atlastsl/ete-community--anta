import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { THUMBNAIL_EXTNAMES, THUMBNAIL_MAX_MB } from '#validators/admin/thumbnail_validator'
import { IMAGE_MAX_BYTES } from '#services/image_service'

/**
 * Story 11.1 — validation client de `ThumbnailField` (`inertia/lib/thumbnail.ts`). Module pur
 * chargé à l'exécution (aucun import statique : la frontière TS6305 ne vaut qu'au typecheck).
 */
type ThumbnailModule = {
  THUMBNAIL_MAX_BYTES: number
  THUMBNAIL_MIME_TYPES: string[]
  THUMBNAIL_ACCEPT: string
  validateThumbnailFile: (file: {
    name: string
    type: string
    size: number
  }) => 'invalid_type' | 'too_large' | null
  emptyVisitTrace: () => Record<string, boolean>
  visitOutcome: (trace: Record<string, boolean>) => string
  thumbnailErrorKey: (errors: Record<string, string> | null | undefined) => string
}

const load = async (): Promise<ThumbnailModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/thumbnail.ts')).href)

test.group('thumbnail | validation client (11.1)', () => {
  test('limites alignées sur le serveur (5 Mo, JPEG/PNG/WebP)', async ({ assert }) => {
    const lib = await load()
    assert.equal(lib.THUMBNAIL_MAX_BYTES, IMAGE_MAX_BYTES)
    assert.equal(lib.THUMBNAIL_MAX_BYTES, THUMBNAIL_MAX_MB * 1024 * 1024)
    assert.sameMembers(lib.THUMBNAIL_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp'])
    for (const ext of THUMBNAIL_EXTNAMES) assert.include(lib.THUMBNAIL_ACCEPT, `.${ext}`)
  })

  test('types acceptés, refusés, repli sur l’extension sans type MIME', async ({ assert }) => {
    const { validateThumbnailFile } = await load()
    const ok = { size: 1000 }
    assert.isNull(validateThumbnailFile({ ...ok, name: 'a.jpg', type: 'image/jpeg' }))
    assert.isNull(validateThumbnailFile({ ...ok, name: 'a.png', type: 'image/png' }))
    assert.isNull(validateThumbnailFile({ ...ok, name: 'a.webp', type: 'image/webp' }))
    assert.isNull(validateThumbnailFile({ ...ok, name: 'a.JPEG', type: '' }))
    assert.equal(validateThumbnailFile({ ...ok, name: 'a.gif', type: 'image/gif' }), 'invalid_type')
    assert.equal(validateThumbnailFile({ ...ok, name: 'a.pdf', type: '' }), 'invalid_type')
  })

  test('taille : 5 Mo accepté, au-delà refusé ; type vérifié avant la taille', async ({
    assert,
  }) => {
    const { validateThumbnailFile, THUMBNAIL_MAX_BYTES } = await load()
    const base = { name: 'a.jpg', type: 'image/jpeg' }
    assert.isNull(validateThumbnailFile({ ...base, size: THUMBNAIL_MAX_BYTES }))
    assert.equal(validateThumbnailFile({ ...base, size: THUMBNAIL_MAX_BYTES + 1 }), 'too_large')
    assert.equal(
      validateThumbnailFile({ name: 'a.gif', type: 'image/gif', size: THUMBNAIL_MAX_BYTES + 1 }),
      'invalid_type'
    )
  })
})

test.group('thumbnail | issue d’une visite (revue 11.1)', () => {
  test('succès, erreur, annulation', async ({ assert }) => {
    const { emptyVisitTrace, visitOutcome } = await load()
    assert.equal(visitOutcome({ ...emptyVisitTrace(), succeeded: true }), 'success')
    assert.equal(visitOutcome({ ...emptyVisitTrace(), failed: true }), 'error')
    assert.equal(visitOutcome({ ...emptyVisitTrace(), cancelled: true, failed: true }), 'cancelled')
  })

  test('réseau seulement sans réponse HTTP ; réponse non Inertia ou fin inconnue → http_error', async ({
    assert,
  }) => {
    const { emptyVisitTrace, visitOutcome } = await load()
    assert.equal(visitOutcome({ ...emptyVisitTrace(), exception: true }), 'network')
    assert.equal(visitOutcome({ ...emptyVisitTrace(), invalidResponse: true }), 'http_error')
    assert.equal(
      visitOutcome({ ...emptyVisitTrace(), invalidResponse: true, exception: true }),
      'http_error'
    )
    assert.equal(visitOutcome(emptyVisitTrace()), 'http_error')
  })

  test('clé d’erreur : champ thumbnail, sinon erreur générique storage', async ({ assert }) => {
    const { thumbnailErrorKey } = await load()
    assert.equal(
      thumbnailErrorKey({ thumbnail: 'thumbnail.errors.too_large' }),
      'thumbnail.errors.too_large'
    )
    assert.equal(thumbnailErrorKey({ other: 'x' }), 'thumbnail.errors.storage')
    assert.equal(thumbnailErrorKey({}), 'thumbnail.errors.storage')
    assert.equal(thumbnailErrorKey(null), 'thumbnail.errors.storage')
  })
})
