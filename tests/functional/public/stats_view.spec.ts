import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import StatsView from '#models/stats_view'

async function createProduction(status: 'draft' | 'published' | 'unpublished' = 'published') {
  return Production.create({
    title: `View ${Math.floor(Math.random() * 1_000_000)}`,
    status,
    authors: [],
    tags: [],
    subdomain: [],
    licenseStatus: 'member',
  })
}

test.group('Public stats | POST /stats/view', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('production publiée → 204 + 1 vue enregistrée (ip_hash anonymisé)', async ({
    client,
    assert,
  }) => {
    const prod = await createProduction('published')

    // Route exemptée de CSRF (beacon) → pas de .withCsrfToken()
    const response = await client.post('/stats/view').json({ productionId: prod.id })
    response.assertStatus(204)

    const row = await StatsView.query().where('production_id', prod.id).firstOrFail()
    assert.isNotNull(row.ipHash)
    assert.match(row.ipHash!, /^[a-f0-9]{64}$/)
  })

  test('production non publiée → 404 + aucune vue', async ({ client, assert }) => {
    const prod = await createProduction('draft')
    const response = await client.post('/stats/view').json({ productionId: prod.id })
    response.assertStatus(404)

    const count = await StatsView.query().where('production_id', prod.id).count('* as total')
    assert.equal(Number(count[0].$extras.total), 0)
  })

  test('productionId inexistant (UUID valide) → 404', async ({ client }) => {
    const response = await client
      .post('/stats/view')
      .json({ productionId: '00000000-0000-0000-0000-000000000000' })
    response.assertStatus(404)
  })

  test('productionId format invalide → 404 (pas de 500)', async ({ client }) => {
    const response = await client.post('/stats/view').json({ productionId: 'pas-un-uuid' })
    response.assertStatus(404)
  })

  test('productionId absent → 404', async ({ client }) => {
    const response = await client.post('/stats/view').json({})
    response.assertStatus(404)
  })
})
