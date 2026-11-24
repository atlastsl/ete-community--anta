import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'
import ProductionFile from '#models/production_file'
import AdminUser from '#models/admin_user'
import Author from '#models/author'

type ProductionFixture = {
  title?: string
  status?: 'draft' | 'published' | 'unpublished'
  category?: string | null
  antaPublishedAt?: DateTime | null
}

async function createProduction(opts: ProductionFixture = {}): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: opts.status ?? 'draft',
    authorNames: [],
    tags: [],
    category: opts.category ?? null,
    licenseStatus: 'member',
    antaPublishedAt: opts.antaPublishedAt ?? null,
    createdById: null,
  })
}

async function addViews(production: Production, count: number) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now(),
      ipHash: `hash-${i}`,
      sessionId: null,
    })
  }
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

test.group('Public home | accès', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET / → 200 même base vide (sections vides, sans catégories)', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.isNotNull(props)
    assert.lengthOf(props.mostViewed, 0)
    assert.lengthOf(props.recent, 0)
    assert.notProperty(props, 'categories')
  })
})

test.group('Public home | sections', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('mostViewed : publiées uniquement, triées par vues décroissantes, max 6', async ({
    client,
    assert,
  }) => {
    const low = await createProduction({ title: 'Peu vue', status: 'published' })
    const high = await createProduction({ title: 'Très vue', status: 'published' })
    await createProduction({ title: 'Brouillon', status: 'draft' })
    await addViews(low, 2)
    await addViews(high, 10)

    const response = await client.get('/')
    response.assertStatus(200)
    const props = extractProps(response.text())

    assert.lengthOf(props.mostViewed, 2)
    assert.equal(props.mostViewed[0].title, 'Très vue')
    assert.equal(props.mostViewed[0].viewsCount, 10)
    assert.equal(props.mostViewed[1].title, 'Peu vue')
    assert.isFalse(props.mostViewed.some((p: { title: string }) => p.title === 'Brouillon'))
  })

  test('recent : triées par antaPublishedAt décroissant, max 6', async ({ client, assert }) => {
    await createProduction({
      title: 'Ancienne',
      status: 'published',
      antaPublishedAt: DateTime.fromISO('2026-01-01'),
    })
    await createProduction({
      title: 'Nouvelle',
      status: 'published',
      antaPublishedAt: DateTime.fromISO('2026-05-01'),
    })

    const response = await client.get('/')
    const props = extractProps(response.text())

    assert.equal(props.recent[0].title, 'Nouvelle')
    assert.equal(props.recent[1].title, 'Ancienne')
  })

  test('limite à 6 items par section', async ({ client, assert }) => {
    for (let i = 0; i < 8; i++) {
      await createProduction({
        title: `Prod ${i}`,
        status: 'published',
        antaPublishedAt: DateTime.now().minus({ days: i }),
      })
    }

    const response = await client.get('/')
    const props = extractProps(response.text())
    assert.lengthOf(props.mostViewed, 6)
    assert.lengthOf(props.recent, 6)
  })

  // Story 12.1 (D8, P2.6) : puces de catégories du hero supprimées, prop retirée.
  test('categories : prop absente (D8)', async ({ client, assert }) => {
    await createProduction({ status: 'published', category: 'book' })

    const response = await client.get('/')
    const props = extractProps(response.text())
    assert.notProperty(props, 'categories')
    assert.properties(props, ['featured', 'mostViewed', 'recent', 'meta'])
  })
})

// Story 11.6 — bannière des productions à la une (FR48, FR49, D35, D37). Données fictives.
let featuredCounter = 0

const fakeToken = (seed: number) => `${'T'.repeat(16)}${String(seed).padStart(4, '0')}`

/** Production publiée avec vignette par défaut (image affichable). */
async function createFeaturable(overrides: Partial<Production> = {}): Promise<Production> {
  const n = featuredCounter++
  const production = await Production.create({
    title: `Production à la une ${n}`,
    status: 'published',
    authorNames: [],
    tags: [],
    category: 'article',
    licenseStatus: 'member',
    antaPublishedAt: DateTime.now().minus({ days: n }),
    createdById: null,
    ...overrides,
  })
  if (!('thumbnailKey' in overrides)) {
    production.thumbnailKey = `thumbnails/${production.id}/${fakeToken(n)}`
    await production.save()
  }
  return production
}

async function feature(...productions: Production[]) {
  await db.from('featured_productions').delete()
  for (const [index, production] of productions.entries()) {
    await db
      .table('featured_productions')
      .insert({ position: index + 1, production_id: production.id, created_by_id: null })
  }
}

async function addVideoWithPoster(production: Production, posterToken: string | null) {
  const file = await ProductionFile.create({
    productionId: production.id,
    fileKey: `productions/${production.id}/video-${featuredCounter++}.mp4`,
    originalName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 10,
    storageProvider: 'r2',
    posterKey: null,
  })
  if (posterToken) {
    file.posterKey = `posters/${file.id}/${posterToken}`
    await file.save()
  }
  return file
}

async function homeHtml(client: any): Promise<string> {
  const response = await client.get('/')
  return response.text()
}

async function homeProps(client: any) {
  return extractProps(await homeHtml(client))
}

function headOf(html: string): string {
  return html.slice(0, html.indexOf('</head>'))
}

test.group('Public home | bannière à la une (11.6)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sans production à la une → featured = [] (bannière absente)', async ({
    client,
    assert,
  }) => {
    await createFeaturable()
    const props = await homeProps(client)
    assert.deepEqual(props.featured, [])
  })

  test('ordre des positions et forme publique stricte (FR49)', async ({ client, assert }) => {
    const a = await createFeaturable({ title: 'Alpha fictive', authorNames: ['Awa FICTIVE'] })
    const b = await createFeaturable({ title: 'Bêta fictive' })
    const c = await createFeaturable({ title: 'Gamma fictive' })
    await feature(c, a, b)
    await addViews(a, 3)
    await StatsDownload.create({ productionId: a.id, downloadedAt: DateTime.now(), ipHash: 'h' })

    const props = await homeProps(client)
    assert.deepEqual(
      props.featured.map((item: { title: string }) => item.title),
      ['Gamma fictive', 'Alpha fictive', 'Bêta fictive']
    )
    assert.deepEqual(props.featured[1], {
      id: a.id,
      slug: a.slug,
      title: 'Alpha fictive',
      authors: [{ name: 'Awa FICTIVE', slug: null }],
      imageUrl: `/media/${a.thumbnailKey}`,
      viewsCount: 3,
      downloadsCount: 1,
    })
  })

  test('sans vignette : image extraite du premier MP4 pourvu d’un poster', async ({
    client,
    assert,
  }) => {
    const production = await createFeaturable({ thumbnailKey: null })
    await addVideoWithPoster(production, null)
    const withPoster = await addVideoWithPoster(production, fakeToken(9001))
    await feature(production)

    const props = await homeProps(client)
    assert.lengthOf(props.featured, 1)
    assert.equal(props.featured[0].imageUrl, `/media/${withPoster.posterKey}`)
    assert.match(props.featured[0].imageUrl, /^\/media\/posters\//)
  })

  test('brouillon, dépubliée et production sans image exclus ; disposition recalculée', async ({
    client,
    assert,
  }) => {
    const kept = await createFeaturable({ title: 'Gardée' })
    const draft = await createFeaturable({ title: 'Brouillon', status: 'draft' })
    const unpublished = await createFeaturable({ title: 'Dépubliée', status: 'unpublished' })
    const noImage = await createFeaturable({ title: 'Sans image', thumbnailKey: null })
    await addVideoWithPoster(noImage, null)
    await feature(draft, kept, noImage)

    let props = await homeProps(client)
    assert.deepEqual(
      props.featured.map((item: { title: string }) => item.title),
      ['Gardée']
    )

    await feature(unpublished)
    props = await homeProps(client)
    assert.deepEqual(props.featured, [])
  })

  test('aucune clé brute ni URL signée dans la prop', async ({ client, assert }) => {
    const production = await createFeaturable()
    await feature(production)
    const props = await homeProps(client)
    const item = props.featured[0]
    assert.notProperty(item, 'thumbnailKey')
    assert.notProperty(item, 'summary')
    assert.notProperty(item, 'category')
    assert.notInclude(item.imageUrl, 'X-Amz')
    assert.isTrue(item.imageUrl.startsWith('/media/thumbnails/'))
  })

  test('byline de la bannière : profil visible lié, sans consentement non lié (D34)', async ({
    client,
    assert,
  }) => {
    const visible = await Author.create({
      firstNames: 'Clarisse',
      lastNames: 'Fictive',
      consentConfirmedAt: DateTime.now(),
    })
    const hidden = await Author.create({
      firstNames: 'Paul',
      lastNames: 'Essai',
      consentConfirmedAt: null,
    })
    const production = await createFeaturable({
      title: 'Œuvre à deux auteurs',
      authorNames: ['Clarisse Fictive', 'Paul Essai'],
    })
    await db.table('production_authors').multiInsert([
      { production_id: production.id, author_id: visible.id, position: 1 },
      { production_id: production.id, author_id: hidden.id, position: 2 },
    ])
    await feature(production)

    const props = await homeProps(client)
    assert.deepEqual(props.featured[0].authors, [
      { name: 'Clarisse FICTIVE', slug: visible.slug },
      { name: 'Paul ESSAI', slug: null },
    ])
    // Même byline que la carte de la même production dans les blocs (un seul passage).
    assert.deepEqual(props.recent[0].authors, props.featured[0].authors)
  })

  test('mise à jour immédiate après PUT /admin/featured (non cachée)', async ({
    client,
    assert,
  }) => {
    const first = await createFeaturable({ title: 'Première' })
    const second = await createFeaturable({ title: 'Seconde' })
    await feature(first)
    let props = await homeProps(client)
    assert.deepEqual(
      props.featured.map((item: { title: string }) => item.title),
      ['Première']
    )

    const admin = await AdminUser.create({
      email: `home-featured-${Date.now()}@anta.test`,
      passwordHash: 'plain-password-hashed-by-mixin',
      role: 'admin',
      passwordChanged: true,
      isActive: true,
      createdById: null,
    })
    const response = await client
      .put('/admin/featured')
      .header('referer', '/admin/featured')
      .json({ productionIds: [second.id, first.id] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)

    props = await homeProps(client)
    assert.deepEqual(
      props.featured.map((item: { title: string }) => item.title),
      ['Seconde', 'Première']
    )
  })

  test('aucune og:image de production sur l’accueil (D37)', async ({ client, assert }) => {
    const production = await createFeaturable()
    await feature(production)
    const head = headOf(await homeHtml(client))
    assert.notInclude(head, 'og:image')
    assert.notInclude(head, 'twitter:image')
    assert.notInclude(head, production.thumbnailKey!)
  })

  test('sections existantes intactes avec une bannière', async ({ client, assert }) => {
    const production = await createFeaturable({ title: 'À la une et récente' })
    await feature(production)
    const props = await homeProps(client)
    assert.lengthOf(props.featured, 1)
    assert.equal(props.recent[0].title, 'À la une et récente')
    assert.equal(props.mostViewed[0].title, 'À la une et récente')
    assert.notProperty(props, 'categories')
    assert.notProperty(props.recent[0], 'imageUrl')
  })
})
