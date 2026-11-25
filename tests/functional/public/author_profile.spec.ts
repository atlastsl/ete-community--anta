import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import PublicAuthorService from '#services/public_author_service'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'
import ProductionAuthorService from '#services/production_author_service'

// Story 10.3 — profil public d'un auteur (D11, D15, D17). Noms fictifs uniquement (dépôt public).
// Les lignes créées sont annulées par la transaction globale de chaque test.

const TOKEN = 'AbCdEfGhIjKlMnOp_-12'

function extractPage(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
}

/** Inertia props of a page answered 200. */
async function propsOf(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  return extractPage(response.text())!.props
}

let sequence = 0

async function createAuthor(
  options: {
    consent?: boolean
    firstNames?: string
    lastNames?: string
    photo?: boolean
    scholar?: string | null
  } = {}
): Promise<Author> {
  sequence++
  const author = await Author.create({
    firstNames: options.firstNames ?? 'Jeanne',
    lastNames: options.lastNames ?? `Exemple${sequence}`,
    googleScholarUrl: options.scholar ?? null,
    consentConfirmedAt: options.consent === false ? null : DateTime.now(),
  })
  if (options.photo) {
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
  }
  return author
}

async function createProduction(
  overrides: {
    status?: 'draft' | 'published'
    title?: string
    workPublishedAt?: DateTime | null
  } = {}
): Promise<Production> {
  sequence++
  return Production.create({
    title: overrides.title ?? `Oeuvre profil ${sequence}`,
    summary: 'Résumé de test.',
    authorNames: ['Jeanne Exemple'],
    tags: [],
    category: 'Livre',
    domain: 'Informatique',
    subdomain: [],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: overrides.status ?? 'published',
    workPublishedAt: overrides.workPublishedAt ?? null,
    antaPublishedAt: overrides.status === 'draft' ? null : DateTime.now(),
  })
}

/** Pivot row + jsonb rewritten from the pivot, as the 9.7 `sync` does (no stale free-text name). */
async function link(production: Production, author: Author, position = 1) {
  await db.table('production_authors').insert({
    production_id: production.id,
    author_id: author.id,
    position,
  })
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
}

async function addViews(production: Production, count: number) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now(),
      ipHash: `v${i}`,
    })
  }
}

async function addDownloads(production: Production, count: number) {
  for (let i = 0; i < count; i++) {
    await StatsDownload.create({
      productionId: production.id,
      downloadedAt: DateTime.now(),
      ipHash: `d${i}`,
    })
  }
}

/** A visible author (public + one published production). */
async function visibleAuthor(options: Parameters<typeof createAuthor>[0] = {}) {
  const author = await createAuthor(options)
  const production = await createProduction()
  await link(production, author)
  return { author, production }
}

test.group('Public | profil d’auteur — visibilité', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('auteur visible → 200, composant author', async ({ client, assert }) => {
    const { author } = await visibleAuthor()
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(200)
    assert.equal(extractPage(response.text())?.component, 'author')
  })

  test('slug inconnu → 404 NotFoundPage', async ({ client, assert }) => {
    const response = await client.get('/authors/auteur-qui-nexiste-pas-404')
    response.assertStatus(404)
    const html = response.text()
    assert.equal(extractPage(html)?.component, 'errors/not_found')
    assert.match(html, /<title[^>]*>\s*Page introuvable — Anta\s*<\/title>/)
  })

  test('auteur sans consentement (production publiée) → 404, aucune donnée exposée', async ({
    client,
    assert,
  }) => {
    const { author } = await visibleAuthor({ consent: false, lastNames: 'Confidentiel' })
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
    const html = response.text()
    assert.equal(extractPage(html)?.component, 'errors/not_found')
    assert.notInclude(html, 'Confidentiel')
  })

  test('auteur public sans production publiée (brouillon seulement) → 404', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    const draft = await createProduction({ status: 'draft' })
    await link(draft, author)
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
    assert.equal(extractPage(response.text())?.component, 'errors/not_found')
  })

  test('auteur public sans aucune production → 404', async ({ client }) => {
    const author = await createAuthor()
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
  })

  test('consentement retiré après un 200 → 404 (D17)', async ({ client, assert }) => {
    const { author } = await visibleAuthor()
    const before = await client.get(`/authors/${author.slug}`)
    before.assertStatus(200)
    author.consentConfirmedAt = null
    await author.save()
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
    assert.equal(extractPage(response.text())?.component, 'errors/not_found')
  })

  test('dernière production dépubliée après un 200 → 404 (D17)', async ({ client }) => {
    const { author, production } = await visibleAuthor()
    const before = await client.get(`/authors/${author.slug}`)
    before.assertStatus(200)
    production.status = 'draft'
    await production.save()
    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(404)
  })
})

test.group('Public | profil d’auteur — contenu', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('props de l’auteur : nom, photo publique, Scholar, affiliations ordonnées', async ({
    client,
    assert,
  }) => {
    const { author } = await visibleAuthor({
      firstNames: 'Awa Marie',
      lastNames: 'Fictive',
      photo: true,
      scholar: 'https://scholar.example.org/citations?user=fictif',
    })
    await AuthorAffiliation.createMany([
      { authorId: author.id, position: 2, institution: 'Institut Second', department: null },
      {
        authorId: author.id,
        position: 1,
        institution: 'Université Première',
        department: 'Lettres',
      },
    ])

    const response = await client.get(`/authors/${author.slug}`)
    response.assertStatus(200)
    const props = extractPage(response.text())!.props
    assert.deepEqual(props.author, {
      slug: author.slug,
      firstNames: 'Awa Marie',
      lastNames: 'Fictive',
      photoBase: `/media/authors/${author.id}/${TOKEN}`,
      googleScholarUrl: 'https://scholar.example.org/citations?user=fictif',
      affiliations: [
        { institution: 'Université Première', department: 'Lettres' },
        { institution: 'Institut Second', department: null },
      ],
    })
    // Pas d'identifiant ni de clé brute en champ propre (l'id ne figure que dans `photoBase`,
    // par conception de /media en 10.2), ni l'état du consentement.
    assert.notProperty(props.author, 'id')
    assert.notProperty(props.author, 'photoKey')
    assert.notProperty(props.author, 'consentConfirmedAt')
  })

  test('sans photo ni Scholar → photoBase et googleScholarUrl null', async ({ client, assert }) => {
    const { author } = await visibleAuthor()
    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.isNull(props.author.photoBase)
    assert.isNull(props.author.googleScholarUrl)
    assert.deepEqual(props.author.affiliations, [])
  })

  test('totaux : vues, téléchargements et productions des seules productions publiées', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    const a = await createProduction()
    const b = await createProduction()
    const draft = await createProduction({ status: 'draft' })
    const other = await createProduction()
    await link(a, author)
    await link(b, author)
    await link(draft, author)
    await addViews(a, 3)
    await addViews(b, 2)
    await addViews(draft, 7)
    await addViews(other, 11)
    await addDownloads(a, 1)
    await addDownloads(draft, 4)

    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.deepEqual(props.stats, { views: 5, downloads: 1, productions: 2 })
    assert.equal(props.pagination.total, 2)
    assert.sameMembers(
      props.productions.map((p: { id: string }) => p.id),
      [a.id, b.id]
    )
  })

  test('cartes : forme du transformer unique + date de l’œuvre (revue 10.3)', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    const production = await createProduction({ workPublishedAt: DateTime.fromISO('2019-03-07') })
    await link(production, author)
    await addViews(production, 2)
    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.deepEqual(Object.keys(props.productions[0]).sort(), [
      'authors',
      'category',
      'domain',
      'downloadsCount',
      'id',
      'language',
      'publishedAt',
      'slug',
      'summary',
      'title',
      'viewsCount',
      'workPublishedAt',
    ])
    assert.equal(props.productions[0].workPublishedAt, '2019-03-07')
    assert.equal(props.productions[0].viewsCount, 2)
    // Story 10.4: byline `{ name, slug }` (pivot written like the 9.7 sync).
    assert.deepEqual(props.productions[0].authors, [
      { name: `Jeanne ${author.lastNames.toUpperCase()}`, slug: author.slug },
    ])
  })

  test('URL Google Scholar non http(s) en base (javascript:) → null', async ({
    client,
    assert,
  }) => {
    const { author } = await visibleAuthor()
    await db
      .from('authors')
      .where('id', author.id)
      .update({ google_scholar_url: 'javascript:alert(1)' })
    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.isNull(props.author.googleScholarUrl)
    assert.equal(
      PublicAuthorService.safeHttpUrl('https://scholar.example.org/x'),
      'https://scholar.example.org/x'
    )
    assert.isNull(PublicAuthorService.safeHttpUrl('data:text/html,x'))
    assert.isNull(PublicAuthorService.safeHttpUrl('pas une url'))
  })

  test('course : plus aucune production publiée après le contrôle de visibilité → 404', async ({
    client,
    assert,
  }) => {
    // Simule la dépublication entre `findVisibleBySlug` et la requête des productions.
    const author = await createAuthor()
    const original = PublicAuthorService.findVisibleBySlug
    PublicAuthorService.findVisibleBySlug = async (slug: string) =>
      slug === author.slug ? author : original.call(PublicAuthorService, slug)
    try {
      const response = await client.get(`/authors/${author.slug}`).redirects(0)
      response.assertStatus(404)
      assert.equal(extractPage(response.text())?.component, 'errors/not_found')
    } finally {
      PublicAuthorService.findVisibleBySlug = original
    }
  })

  test('meta serveur : titre « Prénom NOM — Anta », og:type profile, og:url', async ({
    client,
    assert,
  }) => {
    const { author } = await visibleAuthor({ firstNames: 'Awa', lastNames: 'Fictive' })
    const response = await client.get(`/authors/${author.slug}`)
    const html = response.text()
    assert.match(html, /<title[^>]*>\s*Awa FICTIVE — Anta\s*<\/title>/)
    assert.include(html, '<meta property="og:type" content="profile"')
    assert.include(html, `/authors/${author.slug}"`)
  })
})

test.group('Public | profil d’auteur — tris et pagination', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function authorWithThree() {
    const author = await createAuthor()
    const old = await createProduction({
      title: 'beta ancienne',
      workPublishedAt: DateTime.fromISO('2001-05-01'),
    })
    const recent = await createProduction({
      title: 'Gamma récente',
      workPublishedAt: DateTime.fromISO('2024-01-15'),
    })
    const undated = await createProduction({ title: 'Alpha sans date', workPublishedAt: null })
    for (const p of [old, recent, undated]) await link(p, author)
    await addViews(old, 5)
    await addViews(recent, 1)
    await addDownloads(undated, 4)
    await addDownloads(recent, 2)
    return { author, old, recent, undated }
  }

  const titles = (props: any) => props.productions.map((p: { title: string }) => p.title)

  test('tri par défaut : date de l’œuvre ↓, sans date en dernier ; sort = date', async ({
    client,
    assert,
  }) => {
    const { author } = await authorWithThree()
    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.equal(props.sort, 'date')
    assert.deepEqual(titles(props), ['Gamma récente', 'beta ancienne', 'Alpha sans date'])
  })

  test('sort=views : vues totales ↓', async ({ client, assert }) => {
    const { author } = await authorWithThree()
    const props = await propsOf(client, `/authors/${author.slug}?sort=views`)
    assert.equal(props.sort, 'views')
    assert.deepEqual(titles(props).slice(0, 2), ['beta ancienne', 'Gamma récente'])
  })

  test('sort=downloads : téléchargements totaux ↓', async ({ client, assert }) => {
    const { author } = await authorWithThree()
    const props = await propsOf(client, `/authors/${author.slug}?sort=downloads`)
    assert.deepEqual(titles(props).slice(0, 2), ['Alpha sans date', 'Gamma récente'])
  })

  test('sort=title : A → Z insensible à la casse', async ({ client, assert }) => {
    const { author } = await authorWithThree()
    const props = await propsOf(client, `/authors/${author.slug}?sort=title`)
    assert.deepEqual(titles(props), ['Alpha sans date', 'beta ancienne', 'Gamma récente'])
  })

  test('tri inconnu → défaut date', async ({ client, assert }) => {
    const { author } = await authorWithThree()
    const response = await client.get(`/authors/${author.slug}?sort=hack`)
    response.assertStatus(200)
    assert.equal(extractPage(response.text())!.props.sort, 'date')
  })

  test('12 par page ; page 2 = reste ; pagination exposée', async ({ client, assert }) => {
    const author = await createAuthor()
    for (let i = 0; i < 14; i++) {
      const p = await createProduction({ title: `Titre ${String(i).padStart(2, '0')}` })
      await link(p, author)
    }
    const first = await propsOf(client, `/authors/${author.slug}?sort=title`)
    assert.lengthOf(first.productions, 12)
    assert.deepEqual(first.pagination, { currentPage: 1, lastPage: 2, total: 14, perPage: 12 })
    const second = await propsOf(client, `/authors/${author.slug}?sort=title&page=2`)
    assert.deepEqual(titles(second), ['Titre 12', 'Titre 13'])
  })

  test('page hors limites → 302 vers la dernière page, tri conservé', async ({ client }) => {
    const author = await createAuthor()
    for (let i = 0; i < 13; i++) {
      const p = await createProduction()
      await link(p, author)
    }
    const response = await client.get(`/authors/${author.slug}?sort=views&page=9`).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', `/authors/${author.slug}?sort=views&page=2`)
  })

  test('page hors limites avec une seule page → 302 sans paramètre page ni tri par défaut', async ({
    client,
  }) => {
    const { author } = await visibleAuthor()
    const response = await client.get(`/authors/${author.slug}?page=4`).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', `/authors/${author.slug}`)
  })

  test('page invalide (0, -1, abc, 1.5, 1e21) → page 1', async ({ client, assert }) => {
    const { author } = await visibleAuthor()
    for (const value of ['0', '-1', 'abc', '1.5', '1e21']) {
      const response = await client.get(`/authors/${author.slug}?page=${value}`).redirects(0)
      response.assertStatus(200)
      assert.equal(extractPage(response.text())!.props.pagination.currentPage, 1, value)
    }
  })

  test('départage stable : 13 productions à 0 vue triées par vues → pages disjointes, ordre id', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    const ids: string[] = []
    for (let i = 0; i < 13; i++) {
      const p = await createProduction()
      await link(p, author)
      ids.push(p.id)
    }
    const first = await propsOf(client, `/authors/${author.slug}?sort=views`)
    const second = await propsOf(client, `/authors/${author.slug}?sort=views&page=2`)
    const page1 = first.productions.map((p: { id: string }) => p.id)
    const page2 = second.productions.map((p: { id: string }) => p.id)
    assert.lengthOf(page1, 12)
    assert.lengthOf(page2, 1)
    assert.notInclude(page1, page2[0])
    assert.deepEqual([...page1, ...page2], [...ids].sort())
  })
})
