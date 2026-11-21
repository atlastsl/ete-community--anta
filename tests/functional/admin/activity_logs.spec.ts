import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

async function createUser(role: 'admin' | 'super_admin'): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-hashed-by-mixin',
    role,
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

test.group('Admin activity logs (7.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super_admin → 200 + logs/filtres/pagination', async ({ client, assert }) => {
    const su = await createUser('super_admin')
    const actor = await createUser('admin')
    await AdminActivityLog.create({
      adminUserId: actor.id,
      actionType: 'publish',
      resourceType: 'production',
      resourceId: 'abc',
    })

    const response = await client.get('/admin/activity').loginAs(su)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.properties(props, ['logs', 'pagination', 'admins', 'actionTypes'])
    assert.equal(props.pagination.perPage, 20)
    assert.lengthOf(props.actionTypes, 11)
    assert.includeMembers(props.actionTypes, [
      'consent_confirm',
      'consent_withdraw',
      'featured_update',
      'featured_auto_remove',
    ])
  })

  test('entrée auteur → resourceName issu de metadata ; null sans metadata', async ({
    client,
    assert,
  }) => {
    const su = await createUser('super_admin')
    await AdminActivityLog.create({
      adminUserId: su.id,
      actionType: 'create',
      resourceType: 'author',
      resourceId: 'author-id',
      metadata: { name: 'Jean Fictif' },
    })
    await AdminActivityLog.create({
      adminUserId: su.id,
      actionType: 'publish',
      resourceType: 'production',
      resourceId: 'prod-id',
    })

    const response = await client.get('/admin/activity').loginAs(su)
    const props = extractProps(response.text())
    const byType = Object.fromEntries(
      props.logs.map((l: { resourceType: string; resourceName: string | null }) => [
        l.resourceType,
        l.resourceName,
      ])
    )
    assert.equal(byType.author, 'Jean Fictif')
    assert.isNull(byType.production)
  })

  test('filtre par administrateur', async ({ client, assert }) => {
    const su = await createUser('super_admin')
    const a = await createUser('admin')
    const b = await createUser('admin')
    await AdminActivityLog.create({
      adminUserId: a.id,
      actionType: 'create',
      resourceType: 'production',
      resourceId: '1',
    })
    await AdminActivityLog.create({
      adminUserId: b.id,
      actionType: 'create',
      resourceType: 'production',
      resourceId: '2',
    })

    const response = await client.get(`/admin/activity?adminId=${a.id}`).loginAs(su)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.isAtLeast(props.logs.length, 1)
    for (const log of props.logs) assert.equal(log.adminEmail, a.email)
  })

  test('filtre par type d’action', async ({ client, assert }) => {
    const su = await createUser('super_admin')
    const actor = await createUser('admin')
    await AdminActivityLog.create({
      adminUserId: actor.id,
      actionType: 'publish',
      resourceType: 'production',
      resourceId: '1',
    })
    await AdminActivityLog.create({
      adminUserId: actor.id,
      actionType: 'delete',
      resourceType: 'production',
      resourceId: '2',
    })

    const response = await client
      .get(`/admin/activity?adminId=${actor.id}&actionType=publish`)
      .loginAs(su)
    const props = extractProps(response.text())
    assert.lengthOf(props.logs, 1)
    assert.equal(props.logs[0].actionType, 'publish')
  })

  test('filtre consent_confirm (Story 9.4) : entrée auteur avec son nom', async ({
    client,
    assert,
  }) => {
    const su = await createUser('super_admin')
    await AdminActivityLog.create({
      adminUserId: su.id,
      actionType: 'consent_confirm',
      resourceType: 'author',
      resourceId: 'author-id',
      metadata: { name: 'Jean Fictif' },
    })
    await AdminActivityLog.create({
      adminUserId: su.id,
      actionType: 'consent_withdraw',
      resourceType: 'author',
      resourceId: 'author-id',
      metadata: { name: 'Jean Fictif' },
    })

    const response = await client
      .get(`/admin/activity?adminId=${su.id}&actionType=consent_confirm`)
      .loginAs(su)
    const props = extractProps(response.text())
    assert.equal(props.currentActionType, 'consent_confirm')
    assert.lengthOf(props.logs, 1)
    assert.equal(props.logs[0].resourceName, 'Jean Fictif')
  })

  test('pagination 20/page', async ({ client, assert }) => {
    const su = await createUser('super_admin')
    const actor = await createUser('admin')
    await AdminActivityLog.createMany(
      Array.from({ length: 25 }, (_, i) => ({
        adminUserId: actor.id,
        actionType: 'update' as const,
        resourceType: 'production',
        resourceId: String(i),
      }))
    )

    const response = await client.get(`/admin/activity?adminId=${actor.id}`).loginAs(su)
    const props = extractProps(response.text())
    assert.equal(props.pagination.total, 25)
    assert.equal(props.pagination.lastPage, 2)
    assert.lengthOf(props.logs, 20)
  })

  test('rôle admin → 302 (accès refusé, SuperAdminMiddleware)', async ({ client }) => {
    const admin = await createUser('admin')
    const response = await client.get('/admin/activity').loginAs(admin).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })
})
