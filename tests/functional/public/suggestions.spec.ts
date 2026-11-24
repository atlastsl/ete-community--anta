import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { DateTime } from 'luxon'
import Production from '#models/production'
import Author from '#models/author'
import StatsView from '#models/stats_view'
import SuggestionService from '#services/suggestion_service'
import { formatAuthorName } from '#helpers/author_name'
import testUtils from '@adonisjs/core/services/test_utils'
import ProductionsController from '#controllers/public/productions_controller'

/**
 * Story 12.4 — suggestions de productions similaires (FR61, D22, P2.4, P2-07) :
 * `GET /productions/:slug/suggestions` et `SuggestionService`.
 */

type Fixture = {
  title?: string
  status?: 'draft' | 'published' | 'unpublished'
  tags?: string[]
  subdomain?: string[]
  domain?: string | null
  daysAgo?: number | null
}

let counter = 0

async function createProduction(opts: Fixture = {}): Promise<Production> {
  const status = opts.status ?? 'published'
  const daysAgo = opts.daysAgo === undefined ? counter : opts.daysAgo
  return Production.create({
    title: opts.title ?? `Production ${counter++}`,
    status,
    authorNames: [],
    tags: opts.tags ?? [],
    subdomain: opts.subdomain ?? [],
    domain: opts.domain ?? null,
    category: 'article',
    summary: 'Résumé fictif.',
    licenseStatus: 'member',
    antaPublishedAt:
      status === 'draft' || daysAgo === null ? null : DateTime.now().minus({ days: daysAgo }),
    createdById: null,
  })
}

async function createAuthor(consent = false): Promise<Author> {
  const n = counter++
  return Author.create({
    firstNames: `Prénom${n}`,
    lastNames: `NOM${n}`,
    consentConfirmedAt: consent ? DateTime.now() : null,
  })
}

async function link(production: Production, ...authors: Author[]) {
  let position = 1
  for (const author of authors) {
    await db.table('production_authors').insert({
      production_id: production.id,
      author_id: author.id,
      position: position++,
    })
  }
}

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: string }

/** Raw HTTP request: the Japa client would add its own cookies. */
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

const url = (p: Production) => `/productions/${p.slug}/suggestions`
const titles = (cards: { title: string }[]) => cards.map((card) => card.title)

test.group('Suggestions | SuggestionService', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('ordre : auteur > tag > sous-domaine > domaine, quel que soit le nombre', async ({
    assert,
  }) => {
    const author = await createAuthor()
    const current = await createProduction({
      title: 'Courante',
      tags: ['t1', 't2', 't3'],
      subdomain: ['s1', 's2'],
      domain: 'mathematics',
    })
    await link(current, author)

    // Le domaine seul, le plus récent : dernier malgré sa date.
    await createProduction({ title: 'Domaine', domain: 'mathematics', daysAgo: 0 })
    // Deux sous-domaines + domaine (3 éléments) : sous le tag seul (critère plus fort).
    await createProduction({
      title: 'Sous-domaines',
      subdomain: ['s1', 's2'],
      domain: 'mathematics',
      daysAgo: 1,
    })
    // Trois tags (3 éléments) : sous l'auteur seul (1 élément).
    await createProduction({ title: 'Tags', tags: ['t1', 't2', 't3'], daysAgo: 2 })
    const byAuthor = await createProduction({ title: 'Auteur', daysAgo: 300 })
    await link(byAuthor, author)

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Auteur', 'Tags', 'Sous-domaines', 'Domaine'])
  })

  test('même critère : nombre d’éléments communs ↓, puis date ↓, puis id', async ({ assert }) => {
    const current = await createProduction({
      title: 'Courante',
      tags: ['t1', 't2'],
      domain: 'physics',
    })
    await createProduction({ title: 'Un tag récent', tags: ['t1'], daysAgo: 1 })
    // « Deux tags » (2) et « Tag et domaine » (2) : même critère (tag), même nombre → date.
    await createProduction({ title: 'Deux tags ancien', tags: ['t1', 't2'], daysAgo: 50 })
    await createProduction({
      title: 'Tag et domaine récent',
      tags: ['t2'],
      domain: 'physics',
      daysAgo: 10,
    })
    await createProduction({ title: 'Trois éléments', tags: ['t1', 't2'], domain: 'physics' })

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), [
      'Trois éléments',
      'Tag et domaine récent',
      'Deux tags ancien',
      'Un tag récent',
    ])
  })

  test('ex æquo complets : départage par id croissant ; date absente en dernier', async ({
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['x'] })
    const sameDate = DateTime.now().minus({ days: 5 })
    const a = await createProduction({ title: 'A', tags: ['x'] })
    const b = await createProduction({ title: 'B', tags: ['x'] })
    a.antaPublishedAt = sameDate
    b.antaPublishedAt = sameDate
    await a.save()
    await b.save()
    await createProduction({ title: 'Sans date', tags: ['x'], daysAgo: null })

    const rows = await SuggestionService.forProduction(current.id)
    const expected = [a, b].sort((x, y) => (x.id < y.id ? -1 : 1)).map((p) => p.title)
    assert.deepEqual(titles(rows), [...expected, 'Sans date'])
  })

  test('éléments distincts : un tag répété ne compte qu’une fois', async ({ assert }) => {
    const current = await createProduction({ title: 'Courante', tags: ['a', 'b'] })
    await createProduction({ title: 'Répété', tags: ['a', 'a', 'a'], daysAgo: 1 })
    await createProduction({ title: 'Deux distincts', tags: ['a', 'b'], daysAgo: 30 })

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Deux distincts', 'Répété'])
  })

  test('chaque auteur commun compte ; auteur sans consentement compris (pivot)', async ({
    assert,
  }) => {
    const [a1, a2] = [await createAuthor(false), await createAuthor(true)]
    const current = await createProduction({ title: 'Courante' })
    await link(current, a1, a2)
    const one = await createProduction({ title: 'Un auteur', daysAgo: 1 })
    await link(one, a1)
    const two = await createProduction({ title: 'Deux auteurs', daysAgo: 100 })
    await link(two, a2, a1)

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Deux auteurs', 'Un auteur'])
  })

  test('domaine nul sur la production courante : les candidates à auteur ou tag commun restent (revue)', async ({
    assert,
  }) => {
    const author = await createAuthor()
    const current = await createProduction({ title: 'Courante', tags: ['k'], domain: null })
    await link(current, author)
    const byAuthor = await createProduction({ title: 'Auteur', domain: 'law', daysAgo: 1 })
    await link(byAuthor, author)
    await createProduction({ title: 'Tag', tags: ['k'], domain: 'law', daysAgo: 2 })
    await createProduction({ title: 'Domaine seul', domain: 'law', daysAgo: 3 })

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Auteur', 'Tag'])
  })

  test('domaine nul sur la candidate : son tag commun suffit', async ({ assert }) => {
    const current = await createProduction({ title: 'Courante', tags: ['k'], domain: 'law' })
    await createProduction({ title: 'Tag sans domaine', tags: ['k'], domain: null })
    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Tag sans domaine'])
  })

  test('exclusions : production courante, brouillons, dépubliées, domaine nul, rien en commun', async ({
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['k'], domain: null })
    await createProduction({ title: 'Brouillon', status: 'draft', tags: ['k'] })
    await createProduction({ title: 'Dépubliée', status: 'unpublished', tags: ['k'] })
    await createProduction({ title: 'Domaine nul aussi', domain: null })
    await createProduction({ title: 'Autre tag', tags: ['autre'] })
    await createProduction({ title: 'Candidate', tags: ['k'] })

    const rows = await SuggestionService.forProduction(current.id)
    assert.deepEqual(titles(rows), ['Candidate'])
  })

  test('4 au maximum', async ({ assert }) => {
    const current = await createProduction({ title: 'Courante', domain: 'law' })
    for (let i = 0; i < 6; i++) await createProduction({ domain: 'law' })
    const rows = await SuggestionService.forProduction(current.id)
    assert.lengthOf(rows, 4)
  })

  test('aucune candidate → []', async ({ assert }) => {
    const current = await createProduction({ title: 'Isolée', tags: ['unique'] })
    await createProduction({ title: 'Sans rien' })
    assert.deepEqual(await SuggestionService.forProduction(current.id), [])
  })
})

test.group('Suggestions | GET /productions/:slug/suggestions', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('200 : { results } en cartes du transformer, bylines, sans image, Cache-Control', async ({
    client,
    assert,
  }) => {
    const visible = await createAuthor(true)
    const hidden = await createAuthor(false)
    const current = await createProduction({ title: 'Courante', tags: ['t'] })
    await link(current, visible)
    const similar = await createProduction({ title: 'Similaire', tags: ['t'] })
    await link(similar, visible, hidden)
    await StatsView.create({
      productionId: similar.id,
      recordedAt: DateTime.now(),
      ipHash: 'hash-1',
      sessionId: null,
    })

    const response = await client.get(url(current))
    response.assertStatus(200)
    response.assertHeader('cache-control', 'public, max-age=300')
    assert.include(response.header('content-type') ?? '', 'application/json')
    assert.equal(response.header('x-content-type-options'), 'nosniff')

    const { results } = response.body()
    assert.lengthOf(results, 1)
    const card = results[0]
    assert.deepEqual(Object.keys(card).sort(), [
      'authors',
      'category',
      'domain',
      'downloadsCount',
      'id',
      'publishedAt',
      'slug',
      'summary',
      'title',
      'viewsCount',
    ])
    assert.equal(card.slug, similar.slug)
    assert.equal(card.viewsCount, 1)
    assert.deepEqual(card.authors, [
      { name: formatAuthorName(visible.firstNames, visible.lastNames), slug: visible.slug },
      { name: formatAuthorName(hidden.firstNames, hidden.lastNames), slug: null },
    ])
    // D37 : aucune image dans une carte.
    assert.notMatch(JSON.stringify(results), /thumbnail|image|photo/i)
  })

  test('aucune candidate → 200 { results: [] }', async ({ client }) => {
    const current = await createProduction({ title: 'Isolée' })
    const response = await client.get(url(current))
    response.assertStatus(200)
    response.assertBody({ results: [] })
  })

  test('brouillon, dépubliée ou slug inconnu → 404 JSON, no-store, rien de la production', async ({
    client,
    assert,
  }) => {
    const draft = await createProduction({
      title: 'Brouillon secret',
      status: 'draft',
      tags: ['t'],
    })
    const gone = await createProduction({ title: 'Retirée', status: 'unpublished', tags: ['t'] })
    await createProduction({ title: 'Publiée', tags: ['t'] })

    for (const path of [url(draft), url(gone), '/productions/inconnue-xyz/suggestions']) {
      const response = await client.get(path)
      response.assertStatus(404)
      response.assertHeader('cache-control', 'no-store')
      response.assertBody({ error: 'not_found' })
      assert.notInclude(response.text(), 'Publiée')
    }
  })

  test('sans session ni cookies : aucun Set-Cookie (réponse cachable publiquement)', async ({
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['t'] })
    await createProduction({ title: 'Similaire', tags: ['t'] })
    // Requête brute vers le serveur de test (même processus, même transaction globale).
    const served = await rawRequest(url(current))
    assert.equal(served.status, 200)
    assert.equal(served.headers['cache-control'], 'public, max-age=300')
    assert.isUndefined(served.headers['set-cookie'])
    assert.deepEqual(titles(JSON.parse(served.body).results), ['Similaire'])

    const missing = await rawRequest('/productions/inconnue-xyz/suggestions')
    assert.equal(missing.status, 404)
    assert.isUndefined(missing.headers['set-cookie'])
  })

  test('HEAD et barre oblique finale : servis sans session, aucun Set-Cookie (revue)', async ({
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['t'] })
    await createProduction({ title: 'Similaire', tags: ['t'] })

    const head = await rawRequest(url(current), 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.headers['cache-control'], 'public, max-age=300')
    assert.isUndefined(head.headers['set-cookie'])
    assert.equal(head.body, '')

    const slash = await rawRequest(`${url(current)}/`)
    assert.equal(slash.status, 200)
    assert.equal(slash.headers['cache-control'], 'public, max-age=300')
    assert.isUndefined(slash.headers['set-cookie'])
    assert.deepEqual(titles(JSON.parse(slash.body).results), ['Similaire'])
  })

  test('appelé par le routeur (sous session) : jamais de cache public (défense en profondeur)', async ({
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['t'] })
    await createProduction({ title: 'Similaire', tags: ['t'] })
    const ctx = await testUtils.createHttpContext()
    ctx.params = { slug: current.slug }
    await new ProductionsController().suggestions(ctx)
    assert.equal(ctx.response.getHeader('cache-control'), 'private, no-store')

    const stateless = await testUtils.createHttpContext()
    stateless.params = { slug: current.slug }
    await new ProductionsController().suggestions(stateless, true)
    assert.equal(stateless.response.getHeader('cache-control'), 'public, max-age=300')
  })

  test('la page de détail ne dépend pas des suggestions (aucune prop ajoutée)', async ({
    client,
    assert,
  }) => {
    const current = await createProduction({ title: 'Courante', tags: ['t'] })
    await createProduction({ title: 'Similaire', tags: ['t'] })
    const response = await client.get(`/productions/${current.slug}`)
    response.assertStatus(200)
    const match = response.text().match(/data-page="([^"]*)"/)
    const props = JSON.parse(match![1].replace(/&quot;/g, '"')).props
    assert.notProperty(props, 'suggestions')
    assert.notInclude(response.text(), 'Similaire')
  })

  test('route nommée production.suggestions, sans masquer /productions/:slug', async ({
    client,
    assert,
  }) => {
    const { urlFor } = await import('@adonisjs/core/services/url_builder')
    assert.equal(urlFor('production.suggestions', { slug: 'abc' }), '/productions/abc/suggestions')
    const current = await createProduction({ title: 'suggestions' })
    const detail = await client.get(`/productions/${current.slug}`)
    detail.assertStatus(200)
  })
})
