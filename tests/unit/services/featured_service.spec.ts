import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import FeaturedService, { FEATURED_MAX_SLOTS } from '#services/featured_service'

// Story 11.4 — règle FR50 (P2.5) : vignette requise sauf vidéo hébergée avec image extraite.

const file = (mimeType: string, posterKey: string | null, id = 'f1') => ({
  id,
  mimeType,
  posterKey,
  createdAt: DateTime.fromISO('2026-01-01T00:00:00Z'),
})

test.group('FeaturedService.requiresThumbnail (11.4)', () => {
  test('3 emplacements au plus', ({ assert }) => {
    assert.equal(FEATURED_MAX_SLOTS, 3)
  })

  test('sans fichier (lien externe seulement, PDF…) → vignette requise', ({ assert }) => {
    assert.isTrue(FeaturedService.requiresThumbnail({ files: [] }))
    assert.isTrue(FeaturedService.requiresThumbnail({ files: [file('application/pdf', null)] }))
  })

  test('vidéo hébergée sans image extraite → vignette requise', ({ assert }) => {
    assert.isTrue(FeaturedService.requiresThumbnail({ files: [file('video/mp4', null)] }))
  })

  test('vidéo hébergée avec image extraite → pas de vignette requise', ({ assert }) => {
    assert.isFalse(
      FeaturedService.requiresThumbnail({
        files: [file('video/mp4', null, 'a'), file('video/mp4', 'posters/f/token', 'b')],
      })
    )
  })

  test('poster sur un fichier non MP4 ignoré', ({ assert }) => {
    assert.isTrue(
      FeaturedService.requiresThumbnail({ files: [file('audio/mpeg', 'posters/f/token')] })
    )
  })

  test('missingThumbnail : vignette présente ou image extraite → rien ne manque', ({ assert }) => {
    assert.isFalse(FeaturedService.missingThumbnail({ thumbnailKey: 'thumbnails/p/t', files: [] }))
    assert.isFalse(
      FeaturedService.missingThumbnail({
        thumbnailKey: null,
        files: [file('video/mp4', 'posters/f/token')],
      })
    )
    assert.isTrue(FeaturedService.missingThumbnail({ thumbnailKey: null, files: [] }))
  })
})
