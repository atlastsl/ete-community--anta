import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import MediaService from '#services/media_service'

const ID = '0b6f1c1e-4a7d-4b8e-9a51-1f2d3c4b5a69'
const TOKEN = 'AbCdEfGhIjKlMnOp_-12'

test.group('MediaService | parseAuthorKey', () => {
  test('clé valide → id, préfixe, variante, type et cache', ({ assert }) => {
    assert.deepEqual(MediaService.parseAuthorKey(['authors', ID, TOKEN, 'w128.webp']), {
      authorId: ID,
      prefix: `authors/${ID}/${TOKEN}`,
      key: `authors/${ID}/${TOKEN}/w128.webp`,
      contentType: 'image/webp',
    })
    assert.equal(
      MediaService.parseAuthorKey(['authors', ID, TOKEN, 'og.jpg'])?.contentType,
      'image/jpeg'
    )
    assert.equal(
      MediaService.parseAuthorKey(['authors', ID, TOKEN, 'w384.webp'])?.contentType,
      'image/webp'
    )
  })

  test('clés refusées : préfixe, uuid, jeton, variante, nombre de segments, ..', ({ assert }) => {
    const refused: string[][] = [
      [],
      ['authors'],
      ['productions', ID, TOKEN, 'w128.webp'],
      ['thumbnails', ID, TOKEN, 'w400.webp'],
      ['authors', 'not-a-uuid', TOKEN, 'w128.webp'],
      ['authors', ID, 'short', 'w128.webp'],
      ['authors', ID, `${TOKEN}x`, 'w128.webp'],
      ['authors', ID, 'AbCdEfGhIjKlMnOp/.12', 'w128.webp'],
      ['authors', ID, TOKEN, 'original.png'],
      ['authors', ID, TOKEN, 'W128.webp'],
      ['authors', ID, TOKEN, '..'],
      ['authors', '..', TOKEN, 'w128.webp'],
      ['authors', ID, TOKEN, 'w128.webp', 'extra'],
      ['authors', ID, TOKEN, ''],
    ]
    for (const segments of refused) {
      assert.isNull(MediaService.parseAuthorKey(segments), segments.join('/'))
    }
  })
})

test.group('MediaService | authorPhotoUrl', () => {
  test('base /media/<photo_key> pour un profil public avec photo', ({ assert }) => {
    assert.equal(
      MediaService.authorPhotoUrl({
        photoKey: `authors/${ID}/${TOKEN}`,
        consentConfirmedAt: DateTime.now(),
      }),
      `/media/authors/${ID}/${TOKEN}`
    )
  })

  test('null sans consentement (aucune clé d’un profil non public) ou sans photo', ({ assert }) => {
    assert.isNull(
      MediaService.authorPhotoUrl({ photoKey: `authors/${ID}/${TOKEN}`, consentConfirmedAt: null })
    )
    assert.isNull(
      MediaService.authorPhotoUrl({ photoKey: null, consentConfirmedAt: DateTime.now() })
    )
  })
})
