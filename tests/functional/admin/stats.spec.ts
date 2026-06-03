import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'

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

test.group('Admin stats | vue agrégée (7.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET /admin/stats → 200 + props.stats structurées', async ({ client, assert }) => {
    const admin = await createAdmin()
    const response = await client.get('/admin/stats').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.properties(props.stats, [
      'totalPublished',
      'totalViews',
      'totalDownloads',
      'topViewed',
      'topDownloaded',
      'evolution',
    ])
    assert.lengthOf(props.stats.evolution, 30)
    assert.isAtMost(props.stats.topViewed.length, 10)
    assert.isAtMost(props.stats.topDownloaded.length, 10)
  })

  test('accès anonyme → redirigé (middleware admin)', async ({ client }) => {
    const response = await client.get('/admin/stats').redirects(0)
    response.assertStatus(302)
  })
})
