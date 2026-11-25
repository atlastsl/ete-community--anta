import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'

async function createProduction(
  opts: {
    title?: string
    summary?: string | null
    category?: string | null
    antaPublishedAt?: DateTime
  } = {}
): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    summary: opts.summary ?? null,
    authorNames: [],
    tags: [],
    status: 'published',
    category: opts.category ?? null,
    licenseStatus: 'member',
    antaPublishedAt: opts.antaPublishedAt ?? DateTime.now(),
    createdById: null,
  })
}

async function addViews(production: Production, count: number, recordedAt = DateTime.now()) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt,
      ipHash: `v${i}`,
    })
  }
}

async function addDownloads(production: Production, count: number, downloadedAt = DateTime.now()) {
  for (let i = 0; i < count; i++) {
    await StatsDownload.create({
      productionId: production.id,
      downloadedAt,
      ipHash: `d${i}`,
    })
  }
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

async function getProps(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  return extractProps(response.text())
}

function titles(results: { title: string }[]): string[] {
  return results.map((r) => r.title)
}

test.group('Public listing | tri', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('?sort=views ordonne par vues décroissantes', async ({ client, assert }) => {
    const a = await createProduction({ title: 'PeuVue' })
    const b = await createProduction({ title: 'TresVue' })
    await addViews(a, 1)
    await addViews(b, 5)

    const props = await getProps(client, '/productions?sort=views')
    assert.deepEqual(titles(props.results), ['TresVue', 'PeuVue'])
    assert.equal(props.sort, 'views')
  })

  test('?sort=downloads ordonne par téléchargements décroissants', async ({ client, assert }) => {
    const a = await createProduction({ title: 'PeuDL' })
    const b = await createProduction({ title: 'BeaucoupDL' })
    await addDownloads(a, 2)
    await addDownloads(b, 9)

    const props = await getProps(client, '/productions?sort=downloads')
    assert.deepEqual(titles(props.results), ['BeaucoupDL', 'PeuDL'])
  })

  test('?sort=date ordonne par antaPublishedAt décroissant', async ({ client, assert }) => {
    await createProduction({ title: 'Ancienne', antaPublishedAt: DateTime.fromISO('2026-01-01') })
    await createProduction({ title: 'Nouvelle', antaPublishedAt: DateTime.fromISO('2026-05-01') })

    const props = await getProps(client, '/productions?sort=date')
    assert.deepEqual(titles(props.results), ['Nouvelle', 'Ancienne'])
  })

  test('sort invalide → fallback (date sans recherche) + non reflété', async ({
    client,
    assert,
  }) => {
    await createProduction({ title: 'X' })
    const props = await getProps(client, '/productions?sort=bogus')
    assert.equal(props.sort, 'date')
  })

  test('sort par défaut = date sans recherche', async ({ client, assert }) => {
    await createProduction({ title: 'X' })
    const props = await getProps(client, '/productions')
    assert.equal(props.sort, 'date')
  })
})

test.group('Public listing | pagination + persistance', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('pagination.total correct + ?page=2&sort=views&category=X préserve tri et filtre', async ({
    client,
    assert,
  }) => {
    for (let i = 0; i < 21; i++) await createProduction({ category: 'Livre' })

    const props = await getProps(client, '/productions?page=2&sort=views&category=Livre')
    assert.equal(props.pagination.total, 21)
    assert.equal(props.pagination.currentPage, 2)
    assert.lengthOf(props.results, 1)
    assert.equal(props.sort, 'views')
    assert.deepEqual(props.activeFilters.category, ['Livre'])
  })
})

test.group('Public listing | tris D34 (12.1)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('views et downloads trient sur les totaux, vues anciennes comprises (D7)', async ({
    client,
    assert,
  }) => {
    const twoYearsAgo = DateTime.now().minus({ years: 2 })
    const recent = await createProduction({ title: 'RecenteSeulement' })
    const old = await createProduction({ title: 'AncienneMaisPlusVue' })
    await addViews(recent, 2)
    await addViews(old, 5, twoYearsAgo)
    await addDownloads(recent, 1)
    await addDownloads(old, 4, twoYearsAgo)

    const byViews = await getProps(client, '/productions?sort=views')
    assert.deepEqual(titles(byViews.results), ['AncienneMaisPlusVue', 'RecenteSeulement'])
    assert.equal(byViews.results[0].viewsCount, 5)

    const byDownloads = await getProps(client, '/productions?sort=downloads')
    assert.deepEqual(titles(byDownloads.results), ['AncienneMaisPlusVue', 'RecenteSeulement'])
    assert.equal(byDownloads.sort, 'downloads')
    assert.equal(byDownloads.results[0].downloadsCount, 4)
  })

  test('relevance avec q : ts_rank, et défaut avec q = relevance', async ({ client, assert }) => {
    await createProduction({
      title: 'Faible',
      summary: 'mention unique de algebre ici',
      antaPublishedAt: DateTime.now(),
    })
    await createProduction({
      title: 'Algebre algebre',
      summary: 'algebre algebre algebre',
      antaPublishedAt: DateTime.now().minus({ days: 30 }),
    })

    const explicit = await getProps(client, '/productions?q=algebre&sort=relevance')
    assert.equal(explicit.sort, 'relevance')
    assert.deepEqual(titles(explicit.results), ['Algebre algebre', 'Faible'])

    const implicit = await getProps(client, '/productions?q=algebre')
    assert.equal(implicit.sort, 'relevance')
    assert.deepEqual(titles(implicit.results), ['Algebre algebre', 'Faible'])

    const byDate = await getProps(client, '/productions?q=algebre&sort=date')
    assert.equal(byDate.sort, 'date')
    assert.deepEqual(titles(byDate.results), ['Faible', 'Algebre algebre'])
  })

  test('relevance sans q retombe sur date, prop sort = date (D-12.1-3)', async ({
    client,
    assert,
  }) => {
    await createProduction({ title: 'Ancienne', antaPublishedAt: DateTime.fromISO('2026-01-01') })
    await createProduction({ title: 'Nouvelle', antaPublishedAt: DateTime.fromISO('2026-05-01') })

    const props = await getProps(client, '/productions?sort=relevance')
    assert.deepEqual(titles(props.results), ['Nouvelle', 'Ancienne'])
    assert.equal(props.sort, 'date')

    const blank = await getProps(client, '/productions?q=%20%20&sort=relevance')
    assert.equal(blank.sort, 'date')
  })

  test('sort invalide avec q → relevance (revue 12.1)', async ({ client, assert }) => {
    await createProduction({ title: 'Algebre lineaire' })
    const props = await getProps(client, '/productions?q=algebre&sort=bogus')
    assert.equal(props.sort, 'relevance')
    assert.deepEqual(titles(props.results), ['Algebre lineaire'])
  })
})
