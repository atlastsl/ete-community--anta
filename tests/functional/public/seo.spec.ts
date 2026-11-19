import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import ProductionAuthorService from '#services/production_author_service'

test.group('Public SEO | meta tags côté serveur', () => {
  test('GET / contient les meta SEO dans le HTML brut', async ({ client, assert }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    const html = response.text()

    assert.match(html, /<title[^>]*>[^<]*Anta[^<]*<\/title>/)
    assert.include(html, '<meta name="description"')
    assert.include(html, '<meta property="og:title"')
    assert.include(html, '<meta property="og:description"')
    assert.include(html, '<meta property="og:type" content="website"')
  })

  test('GET /productions contient les meta génériques', async ({ client, assert }) => {
    const response = await client.get('/productions')
    response.assertStatus(200)
    const html = response.text()

    assert.include(html, '<meta property="og:title"')
    assert.include(html, '<meta property="og:type" content="website"')
  })

  test('GET /privacy-policy contient des meta', async ({ client, assert }) => {
    const response = await client.get('/privacy-policy')
    response.assertStatus(200)
    assert.include(response.text(), '<meta property="og:title"')
  })

  test('cookie i18n_lang=en → description anglaise + html lang="en"', async ({
    client,
    assert,
  }) => {
    // Cookie brut (comme posé par i18next côté client) : on insère directement dans le jar
    // — le serializer api-client (`prepare`) le transmet tel quel, sans signer ni encoder.
    const request = client.get('/')
    request.cookiesJar['i18n_lang'] = { name: 'i18n_lang', value: 'en' }
    const response = await request
    response.assertStatus(200)
    const html = response.text()

    assert.include(html, '<html lang="en"')
    assert.include(html, 'community digital library')
  })

  test('sans cookie → français par défaut + html lang="fr"', async ({ client, assert }) => {
    const response = await client.get('/')
    const html = response.text()

    assert.include(html, '<html lang="fr"')
    assert.include(html, 'bibliothèque numérique communautaire')
  })
})

// Story 10.7 — référencement des pages auteurs (og:image, twitter:card), sans fuite d'un
// auteur non public dans les meta d'une production. Noms fictifs ; données annulées par la
// transaction globale de chaque test.
const TOKEN = 'AbCdEfGhIjKlMnOp_-12'
const APP_URL = String(env.get('APP_URL')).replace(/\/$/, '')

/** The `<head>` of the HTML shell (the `data-page` of the body legitimately holds the byline). */
function headOf(html: string): string {
  return html.split('</head>')[0]
}

function metaContent(head: string, attr: 'property' | 'name', key: string): string | null {
  const match = head.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))
  return match ? match[1] : null
}

let sequence = 0

async function createAuthor(
  options: { consent?: boolean; firstNames?: string; lastNames?: string; photo?: boolean } = {}
): Promise<Author> {
  sequence++
  const author = await Author.create({
    firstNames: options.firstNames ?? 'Jeanne',
    lastNames: options.lastNames ?? `Seofictive${sequence}`,
    consentConfirmedAt: options.consent === false ? null : DateTime.now(),
  })
  if (options.photo) {
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
  }
  return author
}

async function createProduction(): Promise<Production> {
  sequence++
  return Production.create({
    title: `Oeuvre SEO ${sequence}`,
    summary: 'Résumé de test.',
    authorNames: [],
    tags: [],
    category: 'Livre',
    domain: 'Informatique',
    subdomain: [],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: 'published',
    antaPublishedAt: DateTime.now(),
  })
}

async function link(production: Production, author: Author, position = 1) {
  await db.table('production_authors').insert({
    production_id: production.id,
    author_id: author.id,
    position,
  })
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
}

test.group('Public SEO | pages auteurs (Story 10.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('profil avec photo : profile, og:url, og:image og.jpg absolue, summary_large_image', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor({
      firstNames: 'Awa Marie',
      lastNames: 'Fictive',
      photo: true,
    })
    await AuthorAffiliation.createMany([
      { authorId: author.id, position: 1, institution: 'Université Exemple', department: null },
    ])
    await link(await createProduction(), author)
    await link(await createProduction(), author)

    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(200)
    const head = headOf(response.text())

    assert.match(head, /<title[^>]*>\s*Awa Marie FICTIVE — Anta\s*<\/title>/)
    assert.equal(
      metaContent(head, 'name', 'description'),
      'Université Exemple — 2 productions publiées sur Anta'
    )
    assert.equal(metaContent(head, 'property', 'og:title'), 'Awa Marie FICTIVE')
    assert.equal(metaContent(head, 'property', 'og:type'), 'profile')
    assert.equal(metaContent(head, 'property', 'og:url'), `${APP_URL}/authors/${author.slug}`)
    assert.equal(
      metaContent(head, 'property', 'og:image'),
      `${APP_URL}/media/authors/${author.id}/${TOKEN}/og.jpg`
    )
    assert.equal(metaContent(head, 'property', 'og:image:width'), '600')
    assert.equal(metaContent(head, 'property', 'og:image:height'), '600')
    assert.equal(metaContent(head, 'property', 'og:image:type'), 'image/jpeg')
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary_large_image')
  })

  test('photo mais consentement retiré → 404, aucune meta de l’auteur', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor({ lastNames: 'Retiree', photo: true })
    await link(await createProduction(), author)
    author.consentConfirmedAt = null
    await author.save()

    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
    const head = headOf(response.text())
    assert.isNull(metaContent(head, 'property', 'og:image'))
    assert.notInclude(head, '/media/authors')
    assert.notInclude(head, 'RETIREE')
    assert.notInclude(head.toLowerCase(), 'retiree')
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary')
  })

  test('photo et consentement mais aucune production publiée → 404, aucune meta de l’auteur', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor({ lastNames: 'Sansoeuvre', photo: true })
    const draft = await createProduction()
    draft.status = 'draft'
    draft.antaPublishedAt = null
    await draft.save()
    await link(draft, author)

    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
    const head = headOf(response.text())
    assert.isNull(metaContent(head, 'property', 'og:image'))
    assert.notInclude(head, '/media/authors')
    assert.notInclude(head.toLowerCase(), 'sansoeuvre')
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary')
  })

  test('profil sans photo : pas d’og:image, twitter:card summary', async ({ client, assert }) => {
    const author = await createAuthor()
    await link(await createProduction(), author)

    const response = await client.get(`/authors/${author.slug}?sort=title&page=1`)
    response.assertStatus(200)
    const head = headOf(response.text())

    assert.equal(metaContent(head, 'property', 'og:type'), 'profile')
    assert.equal(metaContent(head, 'property', 'og:url'), `${APP_URL}/authors/${author.slug}`)
    assert.isNull(metaContent(head, 'property', 'og:image'))
    assert.isNull(metaContent(head, 'property', 'og:image:width'))
    assert.isNull(metaContent(head, 'property', 'og:image:type'))
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary')
  })

  test('nom piégé : valeurs échappées dans le <head>', async ({ client, assert }) => {
    const author = await createAuthor({ firstNames: 'Awa"><script>alert(1)</script>', photo: true })
    await link(await createProduction(), author)

    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(200)
    const head = headOf(response.text())

    assert.notInclude(head, '<script>alert(1)')
    assert.notInclude(head, '"><script>')
    assert.include(head, '&lt;script&gt;')
    // The head stays well-formed: the og:image and twitter:card tags are still parsed.
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary_large_image')
  })

  test('liste /authors : titre, description, og:url /authors (sans paramètres), summary', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/authors?q=fictive&sort=name&page=1')
    response.assertStatus(200)
    const head = headOf(response.text())

    assert.match(head, /<title[^>]*>\s*Auteurs — Anta\s*<\/title>/)
    assert.equal(
      metaContent(head, 'name', 'description'),
      'Les auteurs des productions publiées sur Anta.'
    )
    assert.equal(metaContent(head, 'property', 'og:type'), 'website')
    assert.equal(metaContent(head, 'property', 'og:url'), `${APP_URL}/authors`)
    assert.isNull(metaContent(head, 'property', 'og:image'))
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary')
  })

  test('production : aucune og:image (D37), aucune donnée d’un auteur non public hors son nom', async ({
    client,
    assert,
  }) => {
    const hidden = await createAuthor({
      consent: false,
      firstNames: 'Inès',
      lastNames: 'Cachee',
      photo: true,
    })
    await AuthorAffiliation.createMany([
      { authorId: hidden.id, position: 1, institution: 'Institut Secret', department: null },
    ])
    const shown = await createAuthor({ firstNames: 'Awa', lastNames: 'Visible', photo: true })
    const production = await createProduction()
    await link(production, hidden, 1)
    await link(production, shown, 2)

    const response = await client.get(`/productions/${production.slug}`)
    response.assertStatus(200)
    const head = headOf(response.text())

    assert.equal(metaContent(head, 'property', 'og:type'), 'article')
    assert.isNull(metaContent(head, 'property', 'og:image'))
    assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary')
    // The names shown on the page (byline), nothing else.
    assert.include(metaContent(head, 'name', 'description')!, 'Inès CACHEE')
    assert.notInclude(head, hidden.slug)
    assert.notInclude(head, hidden.id)
    assert.notInclude(head, '/media/authors')
    assert.notInclude(head, 'Institut Secret')
  })

  test('pages génériques : twitter:card summary, pas d’og:image', async ({ client, assert }) => {
    for (const url of ['/', '/productions', '/privacy-policy']) {
      const response = await client.get(url)
      response.assertStatus(200)
      const head = headOf(response.text())
      assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary', url)
      assert.isNull(metaContent(head, 'property', 'og:image'), url)
    }
    const missing = await client.get('/authors/auteur-introuvable-seo')
    missing.assertStatus(404)
    assert.equal(metaContent(headOf(missing.text()), 'name', 'twitter:card'), 'summary')
    assert.isNull(metaContent(headOf(missing.text()), 'property', 'og:image'))
  })
})
