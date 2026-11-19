import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Author from '#models/author'
import AuthorService from '#services/author_service'

// Noms fictifs uniquement (dépôt public). Octets factices : le contrôleur ne décode pas l'image.

const TOKEN = 'AbCdEfGhIjKlMnOp_-12'
const OTHER_TOKEN = 'ZyXwVuTsRqPoNmLk-_98'

async function createAuthor(options: { consent: boolean; withPhoto?: boolean }): Promise<Author> {
  const author = await Author.create({
    firstNames: 'Jeanne',
    lastNames: 'Exemple',
    consentConfirmedAt: options.consent ? DateTime.now() : null,
  })
  if (options.withPhoto !== false) {
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
  }
  return author
}

async function putVariants(prefix: string) {
  const disk = drive.use('r2')
  for (const key of AuthorService.photoKeys(prefix)) {
    await disk.put(key, Buffer.from(`bytes of ${key}`), {
      contentType: key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
    })
  }
}

test.group('Public media | author photos', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('auteur public : 200, Content-Type webp, Cache-Control 1 h, corps de la variante', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)

    const response = await client.get(`/media/${author.photoKey}/w128.webp`)

    response.assertStatus(200)
    response.assertHeader('content-type', 'image/webp')
    response.assertHeader('cache-control', 'public, max-age=3600')
    assert.equal(
      Buffer.from(response.response.body ?? response.text()).toString(),
      `bytes of ${author.photoKey}/w128.webp`
    )
  })

  test('auteur public : og.jpg en image/jpeg, w384.webp servi', async ({ client }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)

    const og = await client.get(`/media/${author.photoKey}/og.jpg`)
    og.assertStatus(200)
    og.assertHeader('content-type', 'image/jpeg')

    const large = await client.get(`/media/${author.photoKey}/w384.webp`)
    large.assertStatus(200)
    large.assertHeader('content-type', 'image/webp')
  })

  test('ETag : If-None-Match identique → 304', async ({ client, assert }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)

    const first = await client.get(`/media/${author.photoKey}/w128.webp`)
    const etag = first.header('etag')
    assert.isString(etag)

    const second = await client
      .get(`/media/${author.photoKey}/w128.webp`)
      .header('If-None-Match', etag!)
    second.assertStatus(304)
  })

  test('auteur non public (consentement absent ou retiré) → 404 no-store, vide', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: false })
    await putVariants(author.photoKey!)

    const response = await client.get(`/media/${author.photoKey}/w128.webp`)

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
    assert.notInclude(response.text(), 'data-page', 'jamais la NotFoundPage HTML')
  })

  test('ancienne clé (photo remplacée) → 404 no-store, même si l’objet existe encore', async ({
    client,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    const oldPrefix = `authors/${author.id}/${OTHER_TOKEN}`
    await putVariants(oldPrefix)
    await putVariants(author.photoKey!)

    const response = await client.get(`/media/${oldPrefix}/w128.webp`)

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
  })

  test('variante inconnue → 404 no-store', async ({ client }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    await drive.use('r2').put(`${author.photoKey}/original.png`, Buffer.from('x'))

    for (const variant of ['original.png', 'w128.png', 'W128.webp', '']) {
      const response = await client.get(`/media/${author.photoKey}/${variant}`)
      response.assertStatus(404)
      response.assertHeader('cache-control', 'no-store')
    }
  })

  test('objet absent de R2 (clé courante d’un auteur public) → 404 no-store', async ({
    client,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })

    const response = await client.get(`/media/${author.photoKey}/w128.webp`)

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
  })

  test('préfixe productions/… (fichier sous licence) → 404 no-store', async ({ client }) => {
    drive.fake('r2')
    const disk = drive.use('r2')
    await disk.put('productions/abc/file.pdf', Buffer.from('%PDF'))

    const response = await client.get('/media/productions/abc/file.pdf')

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
  })

  test('remontée de chemin (.., encodée ou non) et segments surnuméraires → 404 no-store', async ({
    client,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    await drive.use('r2').put('productions/abc/file.pdf', Buffer.from('%PDF'))

    const urls = [
      `/media/authors/${author.id}/${TOKEN}/../../../productions/abc/file.pdf`,
      `/media/authors/${author.id}/${TOKEN}/%2e%2e/w128.webp`,
      `/media/authors/%2e%2e/productions/abc/file.pdf`,
      `/media/authors/..%2f..%2fproductions/abc/file.pdf`,
      `/media/${author.photoKey}/w128.webp/extra`,
      `/media/authors/${author.id}/w128.webp`,
      `/media/authors/not-a-uuid/${TOKEN}/w128.webp`,
      `/media/thumbnails/${author.id}/${TOKEN}/w400.webp`,
    ]
    for (const url of urls) {
      const response = await client.get(url)
      response.assertStatus(404)
      response.assertHeader('cache-control', 'no-store')
    }
  })

  test('auteur public sans photo : aucune clé ne passe', async ({ client }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true, withPhoto: false })
    await putVariants(`authors/${author.id}/${TOKEN}`)

    const response = await client.get(`/media/authors/${author.id}/${TOKEN}/w128.webp`)

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
  })
})
