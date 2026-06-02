import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'
import SearchService, { EMPTY_FILTERS, type ProductionFilters } from '#services/search_service'

/**
 * Tests unitaires de `SearchService` (Story 5.7). Le service exécute du SQL réel
 * (tsvector `websearch_to_tsquery('simple')`, `jsonb @>`, `withAggregate`, tri) :
 * on l'appelle directement avec rollback transactionnel. Le trigger
 * `productions_search_vector_trigger` peuple `search_vector` à l'INSERT.
 */
type ProductionFixture = {
  title?: string
  summary?: string | null
  authors?: string[]
  status?: 'draft' | 'published' | 'unpublished'
  category?: string | null
  domain?: string | null
  subdomain?: string[]
  language?: string | null
  publicationCountry?: string | null
  licenseStatus?: 'member' | 'free_license' | 'external_link'
  antaPublishedAt?: DateTime
}

async function createProduction(opts: ProductionFixture = {}): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    summary: opts.summary ?? null,
    authors: opts.authors ?? [],
    tags: [],
    status: opts.status ?? 'published',
    category: opts.category ?? null,
    domain: opts.domain ?? null,
    subdomain: opts.subdomain ?? [],
    language: opts.language ?? null,
    publicationCountry: opts.publicationCountry ?? null,
    licenseStatus: opts.licenseStatus ?? 'member',
    antaPublishedAt: opts.antaPublishedAt ?? DateTime.now(),
    createdById: null,
  })
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

type SearchOpts = {
  q?: string | null
  filters?: Partial<ProductionFilters>
  sort?: 'relevance' | 'date' | 'views' | 'downloads'
  page?: number
}

async function searchTitles(opts: SearchOpts = {}): Promise<string[]> {
  const paginator = await SearchService.search({
    q: opts.q ?? null,
    filters: { ...EMPTY_FILTERS, ...(opts.filters ?? {}) },
    sort: opts.sort ?? 'date',
    page: opts.page ?? 1,
    perPage: 20,
  })
  return paginator.all().map((p) => p.title)
}

test.group('SearchService | recherche tsvector', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('matche le titre', async ({ assert }) => {
    await createProduction({ title: 'Topologie quantique' })
    await createProduction({ title: 'Cuisine traditionnelle' })
    assert.deepEqual(await searchTitles({ q: 'topologie' }), ['Topologie quantique'])
  })

  test('matche le résumé et les auteurs', async ({ assert }) => {
    await createProduction({ title: 'A', summary: 'étude sur les mathématiques' })
    await createProduction({ title: 'B', authors: ['Cheikh Anta Diop'] })
    assert.lengthOf(await searchTitles({ q: 'mathématiques' }), 1)
    assert.lengthOf(await searchTitles({ q: 'Cheikh' }), 1)
  })

  test('terme sans correspondance → 0 résultat', async ({ assert }) => {
    await createProduction({ title: 'Topologie' })
    assert.lengthOf(await searchTitles({ q: 'zzzaucunecorrespondance' }), 0)
  })

  test("requête multi-mots ne lève pas d'erreur", async ({ assert }) => {
    await createProduction({ title: 'Topologie quantique avancée' })
    assert.lengthOf(await searchTitles({ q: 'topologie quantique' }), 1)
  })

  test('brouillon jamais retourné', async ({ assert }) => {
    await createProduction({ title: 'Secret', status: 'draft' })
    assert.lengthOf(await searchTitles({ q: 'secret' }), 0)
  })
})

test.group('SearchService | filtres isolés', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('category', async ({ assert }) => {
    await createProduction({ title: 'A', category: 'Livre' })
    await createProduction({ title: 'B', category: 'Article' })
    assert.deepEqual(await searchTitles({ filters: { category: ['Livre'] } }), ['A'])
  })

  test('domain', async ({ assert }) => {
    await createProduction({ title: 'A', domain: 'Maths' })
    await createProduction({ title: 'B', domain: 'Bio' })
    assert.deepEqual(await searchTitles({ filters: { domain: ['Maths'] } }), ['A'])
  })

  test('subdomain (jsonb multi-valeurs)', async ({ assert }) => {
    await createProduction({ title: 'A', subdomain: ['Topo', 'Algebre'] })
    await createProduction({ title: 'B', subdomain: ['Reseaux'] })
    assert.deepEqual(await searchTitles({ filters: { subdomain: ['Topo'] } }), ['A'])
  })

  test('language', async ({ assert }) => {
    await createProduction({ title: 'A', language: 'fr' })
    await createProduction({ title: 'B', language: 'en' })
    assert.deepEqual(await searchTitles({ filters: { language: ['fr'] } }), ['A'])
  })

  test('country (publication_country)', async ({ assert }) => {
    await createProduction({ title: 'A', publicationCountry: 'SN' })
    await createProduction({ title: 'B', publicationCountry: 'FR' })
    assert.deepEqual(await searchTitles({ filters: { country: ['SN'] } }), ['A'])
  })

  test('license', async ({ assert }) => {
    await createProduction({ title: 'A', licenseStatus: 'member' })
    await createProduction({ title: 'B', licenseStatus: 'free_license' })
    assert.deepEqual(await searchTitles({ filters: { license: ['free_license'] } }), ['B'])
  })

  test('author (jsonb)', async ({ assert }) => {
    await createProduction({ title: 'A', authors: ['Kofi Annan', 'Autre'] })
    await createProduction({ title: 'B', authors: ['Personne'] })
    assert.deepEqual(await searchTitles({ filters: { author: ['Kofi Annan'] } }), ['A'])
  })
})

test.group('SearchService | combinaison de filtres', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('AND inter-dimensions', async ({ assert }) => {
    await createProduction({ title: 'Match', category: 'Livre', language: 'fr' })
    await createProduction({ title: 'WrongLang', category: 'Livre', language: 'en' })
    await createProduction({ title: 'WrongCat', category: 'Article', language: 'fr' })
    assert.deepEqual(await searchTitles({ filters: { category: ['Livre'], language: ['fr'] } }), [
      'Match',
    ])
  })

  test('OR intra-dimension', async ({ assert }) => {
    await createProduction({ title: 'A', category: 'Livre' })
    await createProduction({ title: 'B', category: 'Article' })
    await createProduction({ title: 'C', category: 'Thèse' })
    const titles = await searchTitles({ filters: { category: ['Livre', 'Article'] } })
    assert.sameMembers(titles, ['A', 'B'])
  })
})

test.group('SearchService | tri', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('views (vues décroissantes)', async ({ assert }) => {
    const low = await createProduction({ title: 'Low' })
    const high = await createProduction({ title: 'High' })
    await addViews(low, 1)
    await addViews(high, 5)
    assert.deepEqual(await searchTitles({ sort: 'views' }), ['High', 'Low'])
  })

  test('downloads (téléchargements décroissants)', async ({ assert }) => {
    const low = await createProduction({ title: 'Low' })
    const high = await createProduction({ title: 'High' })
    await addDownloads(low, 2)
    await addDownloads(high, 9)
    assert.deepEqual(await searchTitles({ sort: 'downloads' }), ['High', 'Low'])
  })

  test('date (antaPublishedAt décroissant)', async ({ assert }) => {
    await createProduction({ title: 'Ancienne', antaPublishedAt: DateTime.fromISO('2026-01-01') })
    await createProduction({ title: 'Nouvelle', antaPublishedAt: DateTime.fromISO('2026-05-01') })
    assert.deepEqual(await searchTitles({ sort: 'date' }), ['Nouvelle', 'Ancienne'])
  })

  test('relevance (par ts_rank quand q présent) — match le plus fort en tête', async ({
    assert,
  }) => {
    // "Fort" contient le terme dans le titre ET le résumé → rang supérieur à "Faible" (une occurrence).
    await createProduction({ title: 'Faible', summary: 'mention unique de algebre ici' })
    await createProduction({ title: 'Algebre algebre', summary: 'algebre algebre algebre' })
    const titles = await searchTitles({ q: 'algebre', sort: 'relevance' })
    assert.lengthOf(titles, 2)
    assert.equal(titles[0], 'Algebre algebre')
  })
})

test.group('SearchService | facets', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('valeurs distinctes des productions publiées + auteurs aplatis', async ({ assert }) => {
    await createProduction({ category: 'Livre', language: 'fr', authors: ['Diop'] })
    await createProduction({ category: 'Article', language: 'fr', authors: ['Diop', 'Senghor'] })
    await createProduction({ category: 'Livre', status: 'draft', language: 'en' })

    const facets = await SearchService.facets()
    assert.deepEqual([...facets.category].sort(), ['Article', 'Livre'])
    assert.deepEqual([...facets.language].sort(), ['fr'])
    assert.sameMembers(facets.author, ['Diop', 'Senghor'])
  })
})
