import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
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

// Story 11.2 — vignettes de la bannière (`thumbnails/<productionId>/<token>/<variante>`).
test.group('MediaService | parseThumbnailKey', () => {
  test('clé valide → id, préfixe, clé, image/webp pour les 3 variantes', ({ assert }) => {
    assert.deepEqual(MediaService.parseThumbnailKey(['thumbnails', ID, TOKEN, 'w400.webp']), {
      productionId: ID,
      prefix: `thumbnails/${ID}/${TOKEN}`,
      key: `thumbnails/${ID}/${TOKEN}/w400.webp`,
      contentType: 'image/webp',
    })
    for (const variant of ['w800.webp', 'w1600.webp']) {
      assert.equal(
        MediaService.parseThumbnailKey(['thumbnails', ID, TOKEN, variant])?.contentType,
        'image/webp'
      )
    }
  })

  test('clés refusées : préfixe, uuid, jeton, variante (dont celles des auteurs), segments', ({
    assert,
  }) => {
    const refused: string[][] = [
      [],
      ['thumbnails'],
      ['authors', ID, TOKEN, 'w400.webp'],
      ['posters', ID, TOKEN, 'w400.webp'],
      ['productions', ID, TOKEN, 'w400.webp'],
      ['thumbnails', 'not-a-uuid', TOKEN, 'w400.webp'],
      ['thumbnails', ID, 'short', 'w400.webp'],
      ['thumbnails', ID, `${TOKEN}x`, 'w400.webp'],
      ['thumbnails', ID, TOKEN, 'w128.webp'],
      ['thumbnails', ID, TOKEN, 'og.jpg'],
      ['thumbnails', ID, TOKEN, 'W400.webp'],
      ['thumbnails', ID, TOKEN, '..'],
      ['thumbnails', ID, TOKEN, ''],
      ['thumbnails', ID, TOKEN, 'w400.webp', 'extra'],
    ]
    for (const segments of refused) {
      assert.isNull(MediaService.parseThumbnailKey(segments), segments.join('/'))
    }
  })
})

test.group('MediaService | productionImageUrl', () => {
  test('base /media/<thumbnail_key> pour une production publiée avec vignette', ({ assert }) => {
    assert.equal(
      MediaService.productionImageUrl({
        status: 'published',
        thumbnailKey: `thumbnails/${ID}/${TOKEN}`,
      }),
      `/media/thumbnails/${ID}/${TOKEN}`
    )
  })

  test('null : brouillon, dépubliée (aucune clé non publiée) ou sans vignette', ({ assert }) => {
    for (const status of ['draft', 'unpublished'] as const) {
      assert.isNull(
        MediaService.productionImageUrl({ status, thumbnailKey: `thumbnails/${ID}/${TOKEN}` })
      )
    }
    assert.isNull(MediaService.productionImageUrl({ status: 'published', thumbnailKey: null }))
  })

  // Story 11.3 : repli sur l'image extraite (P2.1, D-11.3-2).
  const at = (minutes: number) => DateTime.fromISO('2026-01-01T00:00:00Z').plus({ minutes })
  const video = (
    id: string,
    posterKey: string | null,
    minutes: number,
    mimeType = 'video/mp4'
  ) => ({
    id,
    mimeType,
    posterKey,
    createdAt: at(minutes),
  })

  test('sans vignette : poster du premier MP4 pourvu d’un poster (ordre de création)', ({
    assert,
  }) => {
    const files = [
      video('b', `posters/b/${TOKEN}`, 5),
      video('a', null, 0),
      video('p', `posters/p/${TOKEN}`, -5, 'application/pdf'),
      video('c', `posters/c/${OTHER}`, 2),
    ]
    assert.equal(
      MediaService.productionImageUrl({ status: 'published', thumbnailKey: null, files }),
      `/media/posters/c/${OTHER}`
    )
  })

  test('la vignette prime ; la retirer fait réapparaître le poster sans retraitement', ({
    assert,
  }) => {
    const files = [video('c', `posters/c/${OTHER}`, 0)]
    const thumbnailKey = `thumbnails/${ID}/${TOKEN}`
    assert.equal(
      MediaService.productionImageUrl({ status: 'published', thumbnailKey, files }),
      `/media/${thumbnailKey}`
    )
    assert.equal(
      MediaService.productionImageUrl({ status: 'published', thumbnailKey: null, files }),
      `/media/posters/c/${OTHER}`
    )
  })

  test('null : non publiée (même avec poster), aucun MP4 pourvu d’un poster', ({ assert }) => {
    const files = [video('c', `posters/c/${OTHER}`, 0)]
    for (const status of ['draft', 'unpublished'] as const) {
      assert.isNull(MediaService.productionImageUrl({ status, thumbnailKey: null, files }))
    }
    assert.isNull(
      MediaService.productionImageUrl({
        status: 'published',
        thumbnailKey: null,
        files: [video('a', null, 0), video('p', `posters/p/${TOKEN}`, 1, 'audio/mpeg')],
      })
    )
  })

  test('posterUrl : variante w1600 du poster, null sans poster', ({ assert }) => {
    assert.equal(
      MediaService.posterUrl({ posterKey: `posters/${ID}/${TOKEN}` }),
      `/media/posters/${ID}/${TOKEN}/w1600.webp`
    )
    assert.isNull(MediaService.posterUrl({ posterKey: null }))
  })
})

test.group('MediaService | parsePosterKey (11.3)', () => {
  test('clé valide → id du fichier, préfixe, variante 16:9, webp', ({ assert }) => {
    assert.deepEqual(MediaService.parsePosterKey(['posters', ID, TOKEN, 'w800.webp']), {
      fileId: ID,
      prefix: `posters/${ID}/${TOKEN}`,
      key: `posters/${ID}/${TOKEN}/w800.webp`,
      contentType: 'image/webp',
    })
  })

  test('clés refusées', ({ assert }) => {
    const refused: string[][] = [
      [],
      ['posters'],
      ['thumbnails', ID, TOKEN, 'w400.webp'],
      ['posters', 'not-a-uuid', TOKEN, 'w400.webp'],
      ['posters', ID, 'short', 'w400.webp'],
      ['posters', ID, TOKEN, 'w128.webp'],
      ['posters', ID, TOKEN, 'og.jpg'],
      ['posters', ID, TOKEN, '..'],
      ['posters', ID, TOKEN, 'w400.webp', 'extra'],
    ]
    for (const segments of refused) {
      assert.isNull(MediaService.parsePosterKey(segments), segments.join('/'))
    }
  })
})

test.group('MediaService | resolve (vignettes)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  let sequence = 0
  async function production(
    status: 'draft' | 'published' | 'unpublished',
    token: string | null = TOKEN
  ) {
    sequence++
    const created = await Production.create({
      title: `Oeuvre média ${sequence}`,
      summary: 'Résumé.',
      authorNames: [],
      tags: [],
      category: 'Livre',
      domain: 'Informatique',
      subdomain: [],
      language: 'fr',
      publicationCountry: 'Sénégal',
      licenseStatus: 'member',
      status,
    })
    if (token) {
      created.thumbnailKey = `thumbnails/${created.id}/${token}`
      await created.save()
    }
    return created
  }

  test('clé courante d’une production publiée → clé, webp, cache d’un an immutable', async ({
    assert,
  }) => {
    const p = await production('published')
    assert.deepEqual(await MediaService.resolve(['thumbnails', p.id, TOKEN, 'w1600.webp']), {
      key: `thumbnails/${p.id}/${TOKEN}/w1600.webp`,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    })
  })

  test('null : brouillon, dépubliée, ancienne clé, sans vignette, id croisé', async ({
    assert,
  }) => {
    const draft = await production('draft')
    assert.isNull(await MediaService.resolve(['thumbnails', draft.id, TOKEN, 'w400.webp']))

    const unpublished = await production('unpublished')
    assert.isNull(await MediaService.resolve(['thumbnails', unpublished.id, TOKEN, 'w400.webp']))

    const current = await production('published')
    assert.isNull(await MediaService.resolve(['thumbnails', current.id, OTHER, 'w400.webp']))

    const none = await production('published', null)
    assert.isNull(await MediaService.resolve(['thumbnails', none.id, TOKEN, 'w400.webp']))

    // Le jeton de `current` sous l'id d'une autre production publiée : refusé.
    const other = await production('published', OTHER)
    assert.isNull(await MediaService.resolve(['thumbnails', other.id, TOKEN, 'w400.webp']))
  })

  test('les photos d’auteurs gardent leur cache d’1 h (10.2 inchangé)', async ({ assert }) => {
    const author = await Author.create({
      firstNames: 'Jeanne',
      lastNames: 'Exemple',
      consentConfirmedAt: DateTime.now(),
      photoKey: null,
    })
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
    const served = await MediaService.resolve(['authors', author.id, TOKEN, 'w128.webp'])
    assert.equal(served?.cacheControl, 'public, max-age=3600')
  })
})

test.group('MediaService | resolve sans requête pour une clé mal formée (revue 11.2)', (group) => {
  const originals = {
    production: Production.query,
    author: Author.query,
    file: ProductionFile.query,
  }
  let queries = 0
  group.each.setup(() => {
    queries = 0
    Production.query = function (this: typeof Production, ...args: any[]) {
      queries++
      return originals.production.apply(this, args as any)
    } as typeof Production.query
    Author.query = function (this: typeof Author, ...args: any[]) {
      queries++
      return originals.author.apply(this, args as any)
    } as typeof Author.query
    ProductionFile.query = function (this: typeof ProductionFile, ...args: any[]) {
      queries++
      return originals.file.apply(this, args as any)
    } as typeof ProductionFile.query
    return () => {
      Production.query = originals.production
      Author.query = originals.author
      ProductionFile.query = originals.file
    }
  })

  test('vignettes et photos : aucune requête base pour une clé refusée par la liste blanche', async ({
    assert,
  }) => {
    const malformed: string[][] = [
      ['thumbnails', 'not-a-uuid', TOKEN, 'w400.webp'],
      ['thumbnails', ID, 'short', 'w400.webp'],
      ['thumbnails', ID, TOKEN, 'w128.webp'],
      ['thumbnails', ID, TOKEN, 'w400%2Ewebp'],
      ['thumbnails', ID, TOKEN, 'w400.webp', 'extra'],
      ['posters', ID, TOKEN, 'w128.webp'],
      ['posters', 'not-a-uuid', TOKEN, 'w400.webp'],
      ['posters', ID, TOKEN, 'w400.webp', 'extra'],
      ['productions', ID, TOKEN, 'w400.webp'],
      ['authors', ID, TOKEN, 'w400.webp'],
    ]
    for (const segments of malformed) {
      assert.isNull(await MediaService.resolve(segments), segments.join('/'))
    }
    assert.equal(queries, 0)
  })

  test('témoin : une clé bien formée interroge la base', async ({ assert }) => {
    await MediaService.resolve(['thumbnails', ID, TOKEN, 'w400.webp'])
    assert.equal(queries, 1)
    await MediaService.resolve(['posters', ID, TOKEN, 'w400.webp'])
    assert.equal(queries, 2)
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
