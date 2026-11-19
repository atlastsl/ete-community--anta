import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import MediaService from '#services/media_service'
import { isStorageNotFound } from '#controllers/public/media_controller'

const ID = '0b6f1c1e-4a7d-4b8e-9a51-1f2d3c4b5a69'
const TOKEN = 'AbCdEfGhIjKlMnOp_-12'
const OTHER = 'ZyXwVuTsRqPoNmLk-_98'

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

test.group('MediaService | resolve', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function author(consent: boolean, token: string | null = TOKEN) {
    const created = await Author.create({
      firstNames: 'Jeanne',
      lastNames: 'Exemple',
      consentConfirmedAt: consent ? DateTime.now() : null,
    })
    if (token) {
      created.photoKey = `authors/${created.id}/${token}`
      await created.save()
    }
    return created
  }

  test('clé courante d’un profil public → clé, type, cache 1 h', async ({ assert }) => {
    const a = await author(true)
    assert.deepEqual(await MediaService.resolve(['authors', a.id, TOKEN, 'og.jpg']), {
      key: `authors/${a.id}/${TOKEN}/og.jpg`,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=3600',
    })
  })

  test('null : sans consentement, ancienne clé, sans photo, préfixe d’un autre auteur', async ({
    assert,
  }) => {
    const hidden = await author(false)
    assert.isNull(await MediaService.resolve(['authors', hidden.id, TOKEN, 'w128.webp']))

    const current = await author(true)
    assert.isNull(await MediaService.resolve(['authors', current.id, OTHER, 'w128.webp']))

    const noPhoto = await author(true, null)
    assert.isNull(await MediaService.resolve(['authors', noPhoto.id, TOKEN, 'w128.webp']))

    // Le jeton de `current` sous l'id d'un autre auteur public : refusé (id et préfixe liés).
    const other = await author(true, OTHER)
    assert.isNull(await MediaService.resolve(['authors', other.id, TOKEN, 'w128.webp']))
  })

  test('clé mal formée : null sans requête', async ({ assert }) => {
    assert.isNull(await MediaService.resolve(['authors', 'not-a-uuid', TOKEN, 'w128.webp']))
  })
})

test.group('isStorageNotFound', () => {
  test('introuvable : ENOENT (fake), NoSuchKey / NotFound / 404 (S3), à travers cause', ({
    assert,
  }) => {
    const enoent = Object.assign(new Error('x'), { code: 'ENOENT' })
    assert.isTrue(isStorageNotFound(new Error('wrapped', { cause: enoent })))
    assert.isTrue(isStorageNotFound({ name: 'NoSuchKey' }))
    assert.isTrue(isStorageNotFound(new Error('w', { cause: { name: 'NotFound' } })))
    assert.isTrue(isStorageNotFound({ $metadata: { httpStatusCode: 404 } }))
  })

  test('autres erreurs : pas introuvable (→ 503)', ({ assert }) => {
    assert.isFalse(isStorageNotFound(new Error('boom')))
    assert.isFalse(isStorageNotFound({ $metadata: { httpStatusCode: 500 } }))
    assert.isFalse(
      isStorageNotFound(Object.assign(new Error('x'), { code: 'EACCES', status: 404 }))
    )
    assert.isFalse(isStorageNotFound(null))
  })
})
