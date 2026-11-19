import { test } from '@japa/runner'
import { request as httpRequest } from 'node:http'
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

type RawResponse = {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

/**
 * Raw request on the server started by Japa: the path is sent verbatim (superagent's
 * `new URL()` would resolve `..` / `%2e%2e` client-side, review of Story 10.2).
 */
function rawRequest(path: string, method = 'GET'): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: process.env.HOST || 'localhost', port: Number(process.env.PORT), path, method },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        )
        res.on('error', reject)
      }
    )
    req.setTimeout(5000, () => req.destroy(new Error(`timeout on ${path}`)))
    req.on('error', reject)
    req.end()
  })
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

  test('auteur sans consentement → 404 no-store, vide', async ({ client, assert }) => {
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

  test('remontée de chemin (brute, encodée, double encodée, antislash) et clés mal formées → 404 no-store', async ({
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    await drive.use('r2').put('productions/abc/file.pdf', Buffer.from('%PDF'))

    const base = `/media/authors/${author.id}/${TOKEN}`
    const paths = [
      `${base}/../../../productions/abc/file.pdf`,
      `${base}/%2e%2e/w128.webp`,
      `${base}/%252e%252e/w128.webp`,
      `${base}/..%5cw128.webp`,
      `${base}/%2e%2e%2fw128.webp`,
      `${base}/..\\w128.webp`,
      `/media/authors/%2e%2e/productions/abc/file.pdf`,
      `/media/authors/..%2f..%2fproductions/abc/file.pdf`,
      `/media/..\\productions\\abc\\file.pdf`,
      `/media/../productions/abc/file.pdf`,
      `${base}/w128.webp/extra`,
      `${base}//w128.webp`,
      `/media/authors/${author.id}/w128.webp`,
      `/media/authors/not-a-uuid/${TOKEN}/w128.webp`,
      `/media/thumbnails/${author.id}/${TOKEN}/w400.webp`,
    ]
    for (const path of paths) {
      const response = await rawRequest(path)
      assert.equal(response.status, 404, path)
      assert.equal(response.headers['cache-control'], 'no-store', path)
      assert.notInclude(response.body, '%PDF', path)
    }
    // Témoin : la même requête brute sur la clé valide passe.
    const ok = await rawRequest(`${base}/w128.webp`)
    assert.equal(ok.status, 200)
  })

  test('HEAD : 200 avec en-têtes et Content-Length, sans corps ; 404 no-store si refusé', async ({
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    const body = `bytes of ${author.photoKey}/w128.webp`

    const head = await rawRequest(`/media/${author.photoKey}/w128.webp`, 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.headers['content-type'], 'image/webp')
    assert.equal(head.headers['cache-control'], 'public, max-age=3600')
    assert.equal(head.headers['content-length'], String(Buffer.byteLength(body)))
    assert.equal(head.body, '')

    const refused = await rawRequest(`/media/productions/abc/file.pdf`, 'HEAD')
    assert.equal(refused.status, 404)
    assert.equal(refused.headers['cache-control'], 'no-store')
  })

  test('retrait du consentement après un 200 : revalidation If-None-Match → 404, pas 304', async ({
    client,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    const url = `/media/${author.photoKey}/w128.webp`

    const first = await client.get(url)
    first.assertStatus(200)
    const etag = first.header('etag')!

    author.consentConfirmedAt = null
    await author.save()

    const revalidation = await client.get(url).header('If-None-Match', etag)
    revalidation.assertStatus(404)
    revalidation.assertHeader('cache-control', 'no-store')
  })

  test('sans session ni cookies : aucun Set-Cookie sur une image servie ou refusée', async ({
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)

    const served = await rawRequest(`/media/${author.photoKey}/w128.webp`)
    assert.equal(served.status, 200)
    assert.isUndefined(served.headers['set-cookie'])

    const refused = await rawRequest(`/media/productions/abc/file.pdf`)
    assert.equal(refused.status, 404)
    assert.isUndefined(refused.headers['set-cookie'])
  })

  test('objet supprimé entre les métadonnées et la lecture → 404 vide, no-store, sans en-têtes image', async ({
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    const getMetaData = fakeDisk.getMetaData.bind(fakeDisk)
    fakeDisk.getMetaData = async (key: string) => {
      const meta = await getMetaData(key)
      await fakeDisk.delete(key)
      return meta
    }

    const response = await rawRequest(`/media/${author.photoKey}/w128.webp`)

    assert.equal(response.status, 404)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.isUndefined(response.headers['etag'])
    assert.notEqual(response.headers['content-type'], 'image/webp')
    assert.equal(response.body, '')
  })

  test('panne du stockage (autre que « introuvable ») → 503 no-store', async ({ assert }) => {
    const fakeDisk = drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    fakeDisk.getMetaData = async () => {
      throw new Error('storage unavailable', { cause: { $metadata: { httpStatusCode: 500 } } })
    }

    const response = await rawRequest(`/media/${author.photoKey}/w128.webp`)

    assert.equal(response.status, 503)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.notInclude(response.body, 'data-page')
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
