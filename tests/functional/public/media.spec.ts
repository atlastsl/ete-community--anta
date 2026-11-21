import { test } from '@japa/runner'
import { request as httpRequest } from 'node:http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Author from '#models/author'
import Production from '#models/production'
import AuthorService from '#services/author_service'
import ThumbnailService from '#services/thumbnail_service'
import ProductionAuthorService from '#services/production_author_service'

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

// Story 11.2 — vignettes de la bannière : clé courante d'une production publiée, cache d'un an.
let sequence = 0

async function createProduction(
  options: { status?: 'draft' | 'published' | 'unpublished'; withThumbnail?: boolean } = {}
): Promise<Production> {
  sequence++
  const production = await Production.create({
    title: `Oeuvre vignette ${sequence}`,
    summary: 'Résumé de test.',
    authorNames: [],
    tags: [],
    category: 'Livre',
    domain: 'Informatique',
    subdomain: [],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: options.status ?? 'published',
    antaPublishedAt: DateTime.now(),
  })
  if (options.withThumbnail !== false) {
    production.thumbnailKey = `thumbnails/${production.id}/${TOKEN}`
    await production.save()
  }
  return production
}

async function putThumbnail(prefix: string) {
  const disk = drive.use('r2')
  for (const key of ThumbnailService.keys(prefix)) {
    await disk.put(key, Buffer.from(`bytes of ${key}`), { contentType: 'image/webp' })
  }
}

const YEAR = 'public, max-age=31536000, immutable'

test.group('Public media | vignettes de la bannière (Story 11.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('production publiée : w400 / w800 / w1600 en image/webp, cache d’un an immutable, corps', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    await putThumbnail(production.thumbnailKey!)

    for (const variant of ['w400.webp', 'w800.webp', 'w1600.webp']) {
      const response = await client.get(`/media/${production.thumbnailKey}/${variant}`)
      response.assertStatus(200)
      response.assertHeader('content-type', 'image/webp')
      response.assertHeader('cache-control', YEAR)
      assert.equal(
        Buffer.from(response.response.body ?? response.text()).toString(),
        `bytes of ${production.thumbnailKey}/${variant}`
      )
    }
  })

  test('ETag → 304 ; HEAD : en-têtes sans corps ; aucun Set-Cookie', async ({ client, assert }) => {
    drive.fake('r2')
    const production = await createProduction()
    await putThumbnail(production.thumbnailKey!)
    const url = `/media/${production.thumbnailKey}/w800.webp`

    const first = await client.get(url)
    const etag = first.header('etag')
    assert.isString(etag)
    const second = await client.get(url).header('If-None-Match', etag!)
    second.assertStatus(304)
    second.assertHeader('cache-control', YEAR)

    const head = await rawRequest(url, 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.headers['content-type'], 'image/webp')
    assert.equal(head.headers['cache-control'], YEAR)
    assert.equal(
      head.headers['content-length'],
      String(Buffer.byteLength(`bytes of ${production.thumbnailKey}/w800.webp`))
    )
    assert.equal(head.body, '')
    assert.isUndefined(head.headers['set-cookie'])
  })

  test('brouillon ou dépubliée → 404 no-store, vide (jamais la NotFoundPage)', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    for (const status of ['draft', 'unpublished'] as const) {
      const production = await createProduction({ status })
      await putThumbnail(production.thumbnailKey!)

      const response = await client.get(`/media/${production.thumbnailKey}/w400.webp`)
      response.assertStatus(404)
      response.assertHeader('cache-control', 'no-store')
      assert.notInclude(response.text(), 'data-page', status)
    }
  })

  test('ancienne clé (vignette remplacée) ou vignette retirée → 404 no-store', async ({
    client,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    const oldPrefix = `thumbnails/${production.id}/${OTHER_TOKEN}`
    await putThumbnail(oldPrefix)
    await putThumbnail(production.thumbnailKey!)

    const replaced = await client.get(`/media/${oldPrefix}/w400.webp`)
    replaced.assertStatus(404)
    replaced.assertHeader('cache-control', 'no-store')

    const current = production.thumbnailKey!
    production.thumbnailKey = null
    await production.save()
    const removed = await client.get(`/media/${current}/w400.webp`)
    removed.assertStatus(404)
    removed.assertHeader('cache-control', 'no-store')
  })

  test('jeton d’une production sous l’id d’une autre, variante inconnue, clé mal formée → 404', async ({
    assert,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    // `other` a sa propre vignette (autre jeton) : seuls les croisements id/jeton sont testés.
    const other = await createProduction({ withThumbnail: false })
    other.thumbnailKey = `thumbnails/${other.id}/${OTHER_TOKEN}`
    await other.save()
    await putThumbnail(production.thumbnailKey!)
    await putThumbnail(other.thumbnailKey)
    // Objets présents sous les clés croisées : le refus vient de la base, pas de R2.
    await putThumbnail(`thumbnails/${other.id}/${TOKEN}`)
    await putThumbnail(`thumbnails/${production.id}/${OTHER_TOKEN}`)
    await drive.use('r2').put(`${production.thumbnailKey}/original.png`, Buffer.from('x'))

    const base = `/media/${production.thumbnailKey}`
    const paths = [
      `/media/thumbnails/${other.id}/${TOKEN}/w400.webp`,
      `/media/thumbnails/${production.id}/${OTHER_TOKEN}/w400.webp`,
      // 4 segments encodés dont la forme décodée est une clé valide existante : les segments
      // bruts (non décodés) sont refusés par la liste blanche.
      `${base}/w400%2Ewebp`,
      `/media/thumbnails/${production.id}/${TOKEN.slice(0, 19)}%32/w400.webp`,
      `/media/thumbnails%2F${production.id}/${TOKEN}/w400.webp`,
      `/%6Dedia/${production.thumbnailKey}/w400.webp`,
      `${base}/w128.webp`,
      `${base}/og.jpg`,
      `${base}/original.png`,
      `${base}/W400.webp`,
      `${base}/w400.webp/extra`,
      `${base}//w400.webp`,
      `/media/thumbnails/${production.id}/w400.webp`,
      `/media/thumbnails/not-a-uuid/${TOKEN}/w400.webp`,
      `/media/thumbnails/${production.id}/short/w400.webp`,
      `${base}/%2e%2e/w400.webp`,
      `/media/posters/${production.id}/${TOKEN}/w400.webp`,
    ]
    for (const path of paths) {
      const response = await rawRequest(path)
      assert.equal(response.status, 404, path)
      assert.equal(response.headers['cache-control'], 'no-store', path)
    }
    const ok = await rawRequest(`${base}/w400.webp`)
    assert.equal(ok.status, 200)
    const otherOk = await rawRequest(`/media/${other.thumbnailKey}/w400.webp`)
    assert.equal(otherOk.status, 200)
  })

  test('panne du stockage (autre que « introuvable ») → 503 no-store', async ({ assert }) => {
    const fakeDisk = drive.fake('r2')
    const production = await createProduction()
    await putThumbnail(production.thumbnailKey!)
    fakeDisk.getMetaData = async () => {
      throw new Error('storage unavailable', { cause: { $metadata: { httpStatusCode: 500 } } })
    }

    const response = await rawRequest(`/media/${production.thumbnailKey}/w400.webp`)

    assert.equal(response.status, 503)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers['x-content-type-options'], 'nosniff')
  })

  test('objet absent de R2 (clé courante d’une production publiée) → 404 no-store', async ({
    client,
  }) => {
    drive.fake('r2')
    const production = await createProduction()

    const response = await client.get(`/media/${production.thumbnailKey}/w1600.webp`)

    response.assertStatus(404)
    response.assertHeader('cache-control', 'no-store')
  })

  test('dépublication après un 200 : le serveur refuse une revalidation If-None-Match (404, pas 304) — le cache immutable du navigateur, lui, ne revalide pas', async ({
    client,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    await putThumbnail(production.thumbnailKey!)
    const url = `/media/${production.thumbnailKey}/w800.webp`

    const first = await client.get(url)
    first.assertStatus(200)
    const etag = first.header('etag')!

    production.status = 'unpublished'
    await production.save()

    const revalidation = await client.get(url).header('If-None-Match', etag)
    revalidation.assertStatus(404)
    revalidation.assertHeader('cache-control', 'no-store')
  })
})

// Story 11.2 / D37 — la vignette n'apparaît que dans la bannière : aucune page publique
// existante (blocs d'accueil, listing, profil, détail) n'expose la clé ni une URL d'image.
test.group('Public pages | cartes texte malgré une vignette (D37)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('accueil, listing, profil et détail : ni thumbnails/ ni /media/thumbnails', async ({
    client,
    assert,
  }) => {
    const production = await createProduction()
    const author = await Author.create({
      firstNames: 'Jeanne',
      lastNames: 'Vignettefictive',
      consentConfirmedAt: DateTime.now(),
    })
    await db.table('production_authors').insert({
      production_id: production.id,
      author_id: author.id,
      position: 1,
    })
    await ProductionAuthorService.refreshDenormalizedNames([production.id])

    const pages = [
      '/',
      `/productions?q=${encodeURIComponent(production.title)}`,
      `/authors/${author.slug}`,
      `/productions/${production.slug}`,
    ]
    for (const url of pages) {
      const response = await client.get(url)
      response.assertStatus(200)
      const html = response.text()
      assert.include(html, production.slug, `${url} : la production est bien rendue`)
      assert.notInclude(html, 'thumbnails/', url)
      assert.notInclude(html, production.thumbnailKey!, url)
      assert.notInclude(html, 'thumbnailKey', url)
      assert.notInclude(html, 'imageUrl', url)
    }
  })
})

// Revue 11.2 — `MediaMiddleware` court-circuite shield : `nosniff` est posé par le contrôleur.
test.group('Public media | X-Content-Type-Options', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('nosniff sur 200, 304 et 404 (photos d’auteurs et vignettes), HEAD compris', async ({
    assert,
  }) => {
    drive.fake('r2')
    const author = await createAuthor({ consent: true })
    await putVariants(author.photoKey!)
    const production = await createProduction()
    await putThumbnail(production.thumbnailKey!)
    const draft = await createProduction({ status: 'draft' })
    await putThumbnail(draft.thumbnailKey!)

    for (const url of [
      `/media/${author.photoKey}/w128.webp`,
      `/media/${production.thumbnailKey}/w800.webp`,
    ]) {
      const served = await rawRequest(url)
      assert.equal(served.status, 200, url)
      assert.equal(served.headers['x-content-type-options'], 'nosniff', url)

      const etag = served.headers['etag'] as string
      const notModified = await new Promise<RawResponse>((resolve, reject) => {
        const req = httpRequest(
          {
            host: process.env.HOST || 'localhost',
            port: Number(process.env.PORT),
            path: url,
            headers: { 'If-None-Match': etag },
          },
          (res) => {
            res.resume()
            res.on('end', () =>
              resolve({ status: res.statusCode ?? 0, headers: res.headers, body: '' })
            )
          }
        )
        req.on('error', reject)
        req.end()
      })
      assert.equal(notModified.status, 304, url)
      assert.equal(notModified.headers['x-content-type-options'], 'nosniff', url)

      const head = await rawRequest(url, 'HEAD')
      assert.equal(head.headers['x-content-type-options'], 'nosniff', url)
    }

    for (const url of [
      `/media/authors/${author.id}/${OTHER_TOKEN}/w128.webp`,
      `/media/${draft.thumbnailKey}/w400.webp`,
      '/media/productions/abc/file.pdf',
      '/media/thumbnails/%2e%2e/x/w400.webp',
    ]) {
      const refused = await rawRequest(url)
      assert.equal(refused.status, 404, url)
      assert.equal(refused.headers['x-content-type-options'], 'nosniff', url)
    }
  })
})
