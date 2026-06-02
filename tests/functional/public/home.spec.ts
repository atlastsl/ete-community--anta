import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Production from '#models/production'
import StatsView from '#models/stats_view'

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
    authors: [],
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

  test('GET / → 200 même base vide (sections vides)', async ({ client, assert }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.isNotNull(props)
    assert.lengthOf(props.mostViewed, 0)
    assert.lengthOf(props.recent, 0)
    assert.lengthOf(props.categories, 0)
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

  test('categories : valeurs distinctes des productions publiées', async ({ client, assert }) => {
    await createProduction({ status: 'published', category: 'Livre' })
    await createProduction({ status: 'published', category: 'Livre' })
    await createProduction({ status: 'published', category: 'Article' })
    await createProduction({ status: 'draft', category: 'Thèse' })

    const response = await client.get('/')
    const props = extractProps(response.text())
    assert.deepEqual(props.categories.sort(), ['Article', 'Livre'])
  })
})
