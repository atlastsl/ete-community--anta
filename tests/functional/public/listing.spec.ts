import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'

async function createProduction(
  opts: { title?: string; category?: string | null; antaPublishedAt?: DateTime } = {}
): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    authors: [],
    tags: [],
    status: 'published',
    category: opts.category ?? null,
    licenseStatus: 'member',
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
