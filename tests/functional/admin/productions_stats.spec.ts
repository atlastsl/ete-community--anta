import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

async function createAdmin(): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-hashed-by-mixin',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

async function createProduction(): Promise<Production> {
  return Production.create({
    title: `Prod ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'published',
    authors: [],
    tags: [],
    subdomain: [],
    licenseStatus: 'member',
    createdById: null,
  })
}

test.group('Admin production stats (7.1)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET edit → props.stats avec totaux + évolution 30j', async ({ client, assert }) => {
    const admin = await createAdmin()
    const prod = await createProduction()
    for (let i = 0; i < 4; i++) {
      await StatsView.create({ productionId: prod.id, recordedAt: DateTime.now(), ipHash: `v${i}` })
    }
    await StatsDownload.create({
      productionId: prod.id,
      downloadedAt: DateTime.now(),
      ipHash: 'd0',
    })

    const response = await client.get(`/admin/productions/${prod.id}/edit`).loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.stats.totalViews, 4)
    assert.equal(props.stats.totalDownloads, 1)
    assert.lengthOf(props.stats.viewsByDay, 30)
  })

  test('production sans stat → totaux 0', async ({ client, assert }) => {
    const admin = await createAdmin()
    const prod = await createProduction()

    const response = await client.get(`/admin/productions/${prod.id}/edit`).loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.stats.totalViews, 0)
    assert.equal(props.stats.totalDownloads, 0)
  })
})
