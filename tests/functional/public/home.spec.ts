import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import RankingService from '#services/ranking_service'

type ProductionFixture = {
  title?: string
  status?: 'draft' | 'published' | 'unpublished'
  category?: string | null
  antaPublishedAt?: DateTime | null
}

let fixtureCounter = 0

async function createProduction(opts: ProductionFixture = {}): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${fixtureCounter++}`,
    status: opts.status ?? 'draft',
    authorNames: [],
    tags: [],
    category: opts.category ?? null,
    licenseStatus: 'member',
    antaPublishedAt: opts.antaPublishedAt ?? null,
    createdById: null,
  })
}

/** Published production, published on Anta `daysAgo` days ago (distinct dates by default). */
async function published(title: string, daysAgo = fixtureCounter++): Promise<Production> {
  return createProduction({
    title,
    status: 'published',
    antaPublishedAt: DateTime.now().minus({ days: daysAgo }),
  })
}

async function addViews(production: Production, count: number, daysAgo = 0) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now().minus({ days: daysAgo }),
      ipHash: `hash-${i}`,
      sessionId: null,
    })
  }
}

async function addDownloads(production: Production, count: number, daysAgo = 0) {
  for (let i = 0; i < count; i++) {
    await StatsDownload.create({
      productionId: production.id,
      downloadedAt: DateTime.now().minus({ days: daysAgo }),
      ipHash: `hash-${i}`,
    })
  }
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

const titles = (cards: { title: string }[]) => cards.map((card) => card.title)

async function createAdmin(): Promise<AdminUser> {
  return AdminUser.create({
    email: `home-${fixtureCounter++}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

/** Draft that `POST /admin/productions/:id/publish` accepts (FR21: pivot author + link). */
async function createPublishableDraft(title: string): Promise<Production> {
  const production = await Production.create({
    title,
    summary: 'Résumé complet.',
    authorNames: ['Awa Fictive'],
    tags: ['maths'],
    category: 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: 'draft',
    workPublishedAt: DateTime.fromISO('2024-03-15'),
    createdById: null,
  })
  const author = await Author.create({ firstNames: 'Awa', lastNames: 'Fictive' })
  await db
    .table('production_authors')
    .insert({ production_id: production.id, author_id: author.id, position: 1 })
  await ProductionLink.create({
    productionId: production.id,
    url: 'https://example.com',
    linkType: 'simple',
    label: null,
  })
  return production
}

test.group('Public home | accès', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET / → 200 même base vide : trois blocs vides, sans catégories', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.isNotNull(props)
    assert.lengthOf(props.recent, 0)
    assert.lengthOf(props.mostViewed, 0)
    assert.lengthOf(props.mostDownloaded, 0)
    assert.notProperty(props, 'categories')
  })
})

// Story 12.2 — blocs de l'accueil (FR9, FR45, FR46, D4, D5, D6, P2.3). Données fictives.
test.group('Public home | blocs (12.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('props : featured, recent, mostViewed, mostDownloaded, meta ; pas de categories', async ({
    client,
    assert,
  }) => {
    await createProduction({ status: 'published', category: 'book' })

    const response = await client.get('/')
    const props = extractProps(response.text())
    assert.notProperty(props, 'categories')
    assert.properties(props, ['featured', 'recent', 'mostViewed', 'mostDownloaded', 'meta'])
  })

  test('recent : 3 publiées les plus récentes sur Anta, brouillon exclu', async ({
    client,
    assert,
  }) => {
    await published('Il y a 4 j', 4)
    await published('Il y a 1 j', 1)
    await published('Il y a 3 j', 3)
    await published('Il y a 2 j', 2)
    await createProduction({ title: 'Brouillon récent', antaPublishedAt: DateTime.now() })

    const props = await homeProps(client)
    assert.deepEqual(titles(props.recent), ['Il y a 1 j', 'Il y a 2 j', 'Il y a 3 j'])
  })

  test('recent : même anta_published_at → id ↑', async ({ client, assert }) => {
    const date = DateTime.now().minus({ days: 1 })
    const created = []
    for (const title of ['R1', 'R2', 'R3', 'R4']) {
      created.push(await createProduction({ title, status: 'published', antaPublishedAt: date }))
    }
    const expected = created
      .sort((p, q) => (p.id < q.id ? -1 : 1))
      .slice(0, 3)
      .map((p) => p.title)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.recent), expected)
  })

  test('mostViewed : vues des 365 derniers jours ↓, 3 éléments, totaux affichés', async ({
    client,
    assert,
  }) => {
    const a = await published('A')
    const b = await published('B')
    const c = await published('C')
    const d = await published('D')
    await addViews(a, 4)
    await addViews(b, 3)
    await addViews(c, 2, 364) // still inside the window
    await addViews(d, 1)
    // Old views: they count in the totals, never in the window (366 days ago).
    await addViews(d, 10, 366)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['A', 'B', 'C'])
    assert.equal(props.mostViewed[0].viewsCount, 4)

    // D: 1 view in the window, 11 in total: ranked on the window, shown with the total.
    RankingService.invalidate()
    await db.from('stats_views').where('production_id', a.id).delete()
    await db.from('stats_views').where('production_id', b.id).delete()
    const after = await homeProps(client)
    assert.deepEqual(titles(after.mostViewed), ['C', 'D'])
    assert.equal(after.mostViewed[1].viewsCount, 11)
  })

  test('mostViewed : stats de 366 j ignorées → production à 0 exclue (D5)', async ({
    client,
    assert,
  }) => {
    const old = await published('Vue il y a longtemps')
    const never = await published('Jamais vue')
    const recent = await published('Vue récemment')
    await addViews(old, 50, 366)
    await addViews(recent, 1)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['Vue récemment'])
    assert.notInclude(titles(props.mostViewed), never.title)
  })

  test('mostViewed : ex æquo départagés par anta_published_at ↓', async ({ client, assert }) => {
    const older = await published('Plus ancienne', 10)
    const newer = await published('Plus récente', 2)
    await addViews(older, 2)
    await addViews(newer, 2)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['Plus récente', 'Plus ancienne'])
  })

  test('mostViewed : même compte et même date → id ↑', async ({ client, assert }) => {
    const date = DateTime.now().minus({ days: 5 })
    const one = await createProduction({ title: 'X', status: 'published', antaPublishedAt: date })
    const two = await createProduction({ title: 'Y', status: 'published', antaPublishedAt: date })
    await addViews(one, 1)
    await addViews(two, 1)
    const expected = [one, two].sort((p, q) => (p.id < q.id ? -1 : 1)).map((p) => p.title)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), expected)
  })

  test('mostViewed : brouillon et dépubliée exclus même très vus', async ({ client, assert }) => {
    const draft = await createProduction({ title: 'Brouillon', status: 'draft' })
    const unpub = await createProduction({
      title: 'Dépubliée',
      status: 'unpublished',
      antaPublishedAt: DateTime.now().minus({ days: 3 }),
    })
    const pub = await published('Publiée')
    await addViews(draft, 9)
    await addViews(unpub, 9)
    await addViews(pub, 1)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['Publiée'])
  })

  test('mostDownloaded : téléchargements 365 j ↓, 0 exclu, totaux affichés', async ({
    client,
    assert,
  }) => {
    const a = await published('Téléchargée récemment')
    const b = await published('Téléchargée autrefois')
    const c = await published('Peu téléchargée')
    await addDownloads(a, 3)
    await addDownloads(a, 5, 400)
    await addDownloads(b, 7, 366)
    await addDownloads(c, 1)
    await addViews(c, 4)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostDownloaded), ['Téléchargée récemment', 'Peu téléchargée'])
    assert.equal(props.mostDownloaded[0].downloadsCount, 8) // total ≠ 3 in the window
    assert.equal(props.mostDownloaded[1].viewsCount, 4)
    assert.notInclude(titles(props.mostDownloaded), b.title)
  })

  test('blocs : 3 éléments au plus ; un classement sans stats sur 365 j est vide', async ({
    client,
    assert,
  }) => {
    for (let i = 0; i < 5; i++) {
      const production = await published(`P${i}`, i + 1)
      await addViews(production, 5 - i)
    }

    const props = await homeProps(client)
    assert.lengthOf(props.recent, 3)
    assert.deepEqual(titles(props.mostViewed), ['P0', 'P1', 'P2'])
    assert.lengthOf(props.mostDownloaded, 0) // bloc absent côté client
  })

  test('cartes : forme du transformer, sans image (D37)', async ({ client, assert }) => {
    const production = await published('Carte')
    await addViews(production, 1)
    await addDownloads(production, 2)

    const props = await homeProps(client)
    for (const card of [props.recent[0], props.mostViewed[0], props.mostDownloaded[0]]) {
      assert.containsSubset(card, { slug: production.slug, viewsCount: 1, downloadsCount: 2 })
      assert.notProperty(card, 'imageUrl')
      assert.notProperty(card, 'thumbnailKey')
    }
  })
})

// Story 12.2 — cache des classements (P2-06) et invalidation après commit.
test.group('Public home | cache des classements (12.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('les classements sont servis depuis le cache ; « Récemment publiées » ne l’est pas', async ({
    client,
    assert,
  }) => {
    const a = await published('A', 5)
    await addViews(a, 2)
    await client.get('/')
    assert.sameMembers(RankingService.cachedKeys(), ['mostViewed', 'mostDownloaded', 'topAuthors'])

    // New stats and a new publication written behind the service's back (no invalidation).
    const b = await published('B', 1)
    await addViews(b, 9)

    const props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['A']) // cached ids
    assert.equal(props.recent[0].title, 'B') // not cached
  })

  test('dépublication → cache invalidé (le 4e entre dans le bloc)', async ({ client, assert }) => {
    const admin = await createAdmin()
    const productions = []
    for (const [index, title] of ['A', 'B', 'C', 'D'].entries()) {
      const production = await published(title, index + 1)
      await addViews(production, 4 - index)
      productions.push(production)
    }
    let props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['A', 'B', 'C'])

    const response = await client
      .post(`/admin/productions/${productions[0].id}/unpublish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)

    props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['B', 'C', 'D'])
  })

  test('publication → cache invalidé', async ({ client, assert }) => {
    const admin = await createAdmin()
    const a = await published('A')
    await addViews(a, 1)
    const draft = await createPublishableDraft('Brouillon très vu')
    await addViews(draft, 5)
    let props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['A'])

    const response = await client
      .post(`/admin/productions/${draft.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)

    props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['Brouillon très vu', 'A'])
  })

  test('suppression → cache invalidé', async ({ client, assert }) => {
    const admin = await createAdmin()
    const productions = []
    for (const [index, title] of ['A', 'B', 'C', 'D'].entries()) {
      const production = await published(title, index + 1)
      await addDownloads(production, 4 - index)
      productions.push(production)
    }
    let props = await homeProps(client)
    assert.deepEqual(titles(props.mostDownloaded), ['A', 'B', 'C'])

    const response = await client
      .delete(`/admin/productions/${productions[1].id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)

    props = await homeProps(client)
    assert.deepEqual(titles(props.mostDownloaded), ['A', 'C', 'D'])
  })

  test('édition rendant la production incomplète → dépubliée et cache invalidé', async ({
    client,
    assert,
  }) => {
    const admin = await createAdmin()
    const productions = []
    for (const [index, title] of ['A', 'B', 'C', 'D'].entries()) {
      const production = await createPublishableDraft(title)
      production.status = 'published'
      production.antaPublishedAt = DateTime.now().minus({ days: index + 1 })
      await production.save()
      await addViews(production, 4 - index)
      productions.push(production)
    }
    let props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['A', 'B', 'C'])

    // Summary emptied: the edit auto-unpublishes A (FR21), authors untouched (no `authorIds`).
    const response = await client
      .put(`/admin/productions/${productions[0].id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ title: 'A' })
    response.assertStatus(302)
    await productions[0].refresh()
    assert.equal(productions[0].status, 'draft')

    props = await homeProps(client)
    assert.deepEqual(titles(props.mostViewed), ['B', 'C', 'D'])
  })
})

// Story 12.1 (D8, P2.6) — prop `categories` toujours absente.
test.group('Public home | categories (12.1)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('categories : prop absente (D8)', async ({ client, assert }) => {
    await createProduction({ status: 'published', category: 'book' })
    const props = await homeProps(client)
    assert.notProperty(props, 'categories')
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

  test('blocs avec une bannière : aucun dédoublonnage (D6)', async ({ client, assert }) => {
    const production = await createFeaturable({ title: 'À la une et récente' })
    await addViews(production, 1)
    await feature(production)
    const props = await homeProps(client)
    assert.lengthOf(props.featured, 1)
    assert.equal(props.recent[0].title, 'À la une et récente')
    assert.equal(props.mostViewed[0].title, 'À la une et récente')
    assert.notProperty(props, 'categories')
    assert.notProperty(props.recent[0], 'imageUrl')
  })
})

// Story 12.3 — bloc « Auteurs les plus consultés » (FR45, FR46, FR53, D3, D5, D36, P2.3).
// Noms fictifs (dépôt public).
type AuthorFixture = { consent?: boolean; firstNames?: string }

async function createAuthor(lastNames: string, opts: AuthorFixture = {}): Promise<Author> {
  return Author.create({
    firstNames: opts.firstNames ?? 'Awa',
    lastNames,
    consentConfirmedAt: opts.consent === false ? null : DateTime.now(),
  })
}

async function link(production: Production, ...authors: Author[]) {
  for (const author of authors) {
    const row = await db
      .from('production_authors')
      .where('production_id', production.id)
      .max('position as max')
      .first()
    await db.table('production_authors').insert({
      production_id: production.id,
      author_id: author.id,
      position: Number(row?.max ?? 0) + 1,
    })
  }
}

const authorNames = (cards: { lastNames: string }[]) => cards.map((card) => card.lastNames)

test.group('Public home | auteurs les plus consultés (12.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('prop topAuthors : base vide → [] (bloc absent)', async ({ client, assert }) => {
    const props = await homeProps(client)
    assert.property(props, 'topAuthors')
    assert.deepEqual(props.topAuthors, [])
  })

  test('vues 365 j ↓, 3 éléments, forme AuthorCard avec le total des vues (D3)', async ({
    client,
    assert,
  }) => {
    const authors = []
    for (const [index, name] of ['UN', 'DEUX', 'TROIS', 'QUATRE'].entries()) {
      const author = await createAuthor(name)
      const production = await published(`Production de ${name}`)
      await link(production, author)
      await addViews(production, 4 - index)
      authors.push(author)
    }
    // Old views of TROIS: in its total, never in the window.
    const troisOld = await published('Ancienne de TROIS', 400)
    await link(troisOld, authors[2])
    await addViews(troisOld, 10, 366)

    const props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['UN', 'DEUX', 'TROIS'])
    assert.deepEqual(Object.keys(props.topAuthors[2]).sort(), [
      'firstNames',
      'lastNames',
      'photoBase',
      'primaryInstitution',
      'productionsCount',
      'slug',
      'viewsCount',
    ])
    assert.equal(props.topAuthors[2].slug, authors[2].slug)
    assert.equal(props.topAuthors[2].viewsCount, 12) // total ≠ 2 in the window
    assert.equal(props.topAuthors[2].productionsCount, 2)
  })

  test('total des vues identique à la carte de /authors', async ({ client, assert }) => {
    const author = await createAuthor('PAREIL')
    const recent = await published('Récente')
    const old = await published('Ancienne', 500)
    await link(recent, author)
    await link(old, author)
    await addViews(recent, 3)
    await addViews(old, 5, 400)

    const home = await homeProps(client)
    const listResponse = await client.get('/authors')
    const list = extractProps(listResponse.text())
    const listCard = list.authors.find((card: { slug: string }) => card.slug === author.slug)
    assert.deepEqual(home.topAuthors[0], listCard)
    assert.equal(home.topAuthors[0].viewsCount, 8)
  })

  test('profil non public exclu : sans consentement, ou sans production publiée', async ({
    client,
    assert,
  }) => {
    const noConsent = await createAuthor('SANSACCORD', { consent: false })
    const p1 = await published('P1')
    await link(p1, noConsent)
    await addViews(p1, 9)

    // Consent but only a draft (with views): not public, and draft views never count.
    const draftOnly = await createAuthor('BROUILLON')
    const draft = await createProduction({ title: 'Brouillon vu' })
    await link(draft, draftOnly)
    await addViews(draft, 9)

    const visible = await createAuthor('VISIBLE')
    const p2 = await published('P2')
    await link(p2, visible)
    await addViews(p2, 1)

    const props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['VISIBLE'])
  })

  test('vues d’un brouillon ou d’une dépubliée ignorées pour un auteur visible', async ({
    client,
    assert,
  }) => {
    const a = await createAuthor('MIXTE')
    const pub = await published('Publiée')
    const unpublished = await createProduction({ title: 'Dépubliée', status: 'unpublished' })
    await link(pub, a)
    await link(unpublished, a)
    await addViews(pub, 1)
    await addViews(unpublished, 50)

    const b = await createAuthor('DEUX')
    const pb = await published('Pb')
    await link(pb, b)
    await addViews(pb, 2)

    const props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['DEUX', 'MIXTE'])
    assert.equal(props.topAuthors[1].viewsCount, 1)
  })

  test('auteur à 0 vue sur 365 j exclu (D5)', async ({ client, assert }) => {
    const old = await createAuthor('ANCIEN')
    const p = await published('Vue il y a longtemps')
    await link(p, old)
    await addViews(p, 7, 366)
    const never = await createAuthor('JAMAIS')
    await link(await published('Jamais vue'), never)

    const props = await homeProps(client)
    assert.deepEqual(props.topAuthors, [])
  })

  // Garde-fou de non-régression : l'unicité vient de la clé primaire du pivot, pas de la
  // logique de la requête.
  test('co-signature : chaque vue compte une fois pour chaque auteur', async ({
    client,
    assert,
  }) => {
    const a = await createAuthor('ALPHA')
    const b = await createAuthor('BETA')
    const c = await createAuthor('GAMMA')
    const shared = await published('Co-signée', 10)
    await link(shared, a, b)
    await addViews(shared, 3)
    const solo = await published('Solo', 20)
    await link(solo, c)
    await addViews(solo, 4)

    const props = await homeProps(client)
    // GAMMA 4 > ALPHA 3 = BETA 3 (same last publication → last name).
    assert.deepEqual(authorNames(props.topAuthors), ['GAMMA', 'ALPHA', 'BETA'])
    assert.deepEqual(
      props.topAuthors.map((card: { viewsCount: number }) => card.viewsCount),
      [4, 3, 3]
    )
  })

  test('ex æquo : dernière production publiée sur Anta ↓ (toutes, même non vues)', async ({
    client,
    assert,
  }) => {
    const older = await createAuthor('AAA')
    const newer = await createAuthor('ZZZ')
    const p1 = await published('Vue de AAA', 30)
    const p2 = await published('Vue de ZZZ', 30)
    await link(p1, older)
    await link(p2, newer)
    await addViews(p1, 2)
    await addViews(p2, 2)
    // ZZZ's latest publication (never viewed) breaks the tie in its favour.
    await link(await published('Récente de ZZZ, jamais vue', 1), newer)

    const props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['ZZZ', 'AAA'])
  })

  test('ex æquo et même dernière publication : nom, puis prénom', async ({ client, assert }) => {
    const shared = await published('Commune', 5)
    const b = await createAuthor('DIOP', { firstNames: 'Binta' })
    const a = await createAuthor('DIOP', { firstNames: 'Awa' })
    const c = await createAuthor('BA', { firstNames: 'Zeyna' })
    await link(shared, b, a, c)
    await addViews(shared, 2)

    const props = await homeProps(client)
    assert.deepEqual(
      props.topAuthors.map((card: { firstNames: string; lastNames: string }) => card.firstNames),
      ['Zeyna', 'Awa', 'Binta']
    )
  })

  test('retrait du consentement par l’admin → absent, le 4e remonte (FR53, cache invalidé)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdmin()
    const authors = []
    for (const [index, name] of ['RETIRE', 'DEUX', 'TROIS', 'QUATRE'].entries()) {
      const author = await createAuthor(name)
      const production = await published(`Production de ${name}`)
      await link(production, author)
      await addViews(production, 5 - index)
      authors.push(author)
    }

    let props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['RETIRE', 'DEUX', 'TROIS'])
    assert.include(RankingService.cachedKeys(), 'topAuthors')

    const response = await client
      .post(`/admin/authors/${authors[0].id}/withdraw-consent`)
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    response.assertStatus(302)
    assert.notInclude(RankingService.cachedKeys(), 'topAuthors')

    // QUATRE enters only through a recomputation: the re-filtering alone (D-12.3-4) would
    // leave ['DEUX', 'TROIS'].
    props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['DEUX', 'TROIS', 'QUATRE'])
  })

  test('ex æquo : une production dépubliée garde sa date mais ne compte pas (D36)', async ({
    client,
    assert,
  }) => {
    const withUnpublished = await createAuthor('AAA')
    const other = await createAuthor('ZZZ')
    const old = await published('Ancienne de AAA', 30)
    const recent = await published('Publiée de ZZZ', 10)
    await link(old, withUnpublished)
    await link(recent, other)
    await addViews(old, 2)
    await addViews(recent, 2)
    // AAA's newest production, unpublished but still dated: ignored in the tie-break.
    const unpublished = await createProduction({
      title: 'Dépubliée récente de AAA',
      status: 'unpublished',
      antaPublishedAt: DateTime.now().minus({ days: 1 }),
    })
    await link(unpublished, withUnpublished)

    const props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['ZZZ', 'AAA'])
  })

  test('identifiant resté en cache d’un profil devenu non public : jamais affiché (D-12.3-4)', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor('PERIME')
    const p = await published('P')
    await link(p, author)
    await addViews(p, 3)
    let props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['PERIME'])

    // Consent withdrawn behind the service's back (another process): no invalidation.
    await db.from('authors').where('id', author.id).update({ consent_confirmed_at: null })
    assert.include(RankingService.cachedKeys(), 'topAuthors')
    props = await homeProps(client)
    assert.deepEqual(props.topAuthors, [])
  })

  test('cache : identifiants servis depuis le cache jusqu’à invalidation', async ({
    client,
    assert,
  }) => {
    const a = await createAuthor('PREMIER')
    const pa = await published('Pa')
    await link(pa, a)
    await addViews(pa, 2)
    await homeProps(client)

    const b = await createAuthor('SECOND')
    const pb = await published('Pb')
    await link(pb, b)
    await addViews(pb, 9)

    let props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['PREMIER'])
    RankingService.invalidate()
    props = await homeProps(client)
    assert.deepEqual(authorNames(props.topAuthors), ['SECOND', 'PREMIER'])
  })
})
