import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import Production from '#models/production'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
  isActive?: boolean
  createdById?: string | null
}

async function createAdminUser(opts: AdminFixture = {}): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: opts.role ?? 'admin',
    passwordChanged: true,
    isActive: opts.isActive ?? true,
    createdById: opts.createdById ?? null,
  })
}

test.group('Admin users delete | suppression', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin DELETE /admin/users/:id → 302, admin supprimé de la BDD', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })
    const adminId = admin.id

    const response = await client
      .delete(`/admin/users/${adminId}`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    const deleted = await AdminUser.find(adminId)
    assert.isNull(deleted)
  })

  test('les admin_activity_logs liés sont supprimés en cascade', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    await AdminActivityLog.create({
      adminUserId: admin.id,
      actionType: 'login',
      resourceType: 'session',
    })

    const logsBefore = await AdminActivityLog.query().where('adminUserId', admin.id)
    assert.isAbove(logsBefore.length, 0)

    await client.delete(`/admin/users/${admin.id}`).loginAs(superAdmin).withCsrfToken().redirects(0)

    const logsAfter = await AdminActivityLog.query().where('adminUserId', admin.id)
    assert.equal(logsAfter.length, 0)
  })

  test('la suppression conserve les productions (created_by_id → null)', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    const production = await Production.create({
      title: 'Production de test',
      status: 'draft',
      authors: [],
      tags: [],
      licenseStatus: 'member',
      createdById: admin.id,
    })

    await client.delete(`/admin/users/${admin.id}`).loginAs(superAdmin).withCsrfToken().redirects(0)

    await production.refresh()
    assert.isNull(production.createdById)
    const found = await Production.find(production.id)
    assert.isNotNull(found)
  })
})

test.group('Admin users delete | protection', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin ne peut pas se supprimer lui-même → compte intact', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .delete(`/admin/users/${superAdmin.id}`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    const stillExists = await AdminUser.find(superAdmin.id)
    assert.isNotNull(stillExists)
  })

  test('admin DELETE → 302 redirect dashboard (SuperAdminMiddleware)', async ({ client }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const target = await createAdminUser({ role: 'admin' })

    const response = await client
      .delete(`/admin/users/${target.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })

  test('DELETE avec ID inexistant → 404', async ({ client }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .delete('/admin/users/00000000-0000-0000-0000-000000000000')
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(404)
  })
})

test.group('Admin users delete | review findings', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  // D4 — la suppression écrit un log delete attribué au super admin acteur (survit au CASCADE).
  test('la suppression écrit un log delete attribué au super admin acteur', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    await client.delete(`/admin/users/${admin.id}`).loginAs(superAdmin).withCsrfToken().redirects(0)

    const log = await AdminActivityLog.query()
      .where('adminUserId', superAdmin.id)
      .where('actionType', 'delete')
      .where('resourceType', 'admin_user')
      .where('resourceId', admin.id)
      .first()

    assert.isNotNull(log)
  })

  // D1 — un super_admin cible est protégé contre la suppression.
  test('suppression d un super_admin cible → bloquée, compte intact', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const otherSuper = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .delete(`/admin/users/${otherSuper.id}`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const found = await AdminUser.find(otherSuper.id)
    assert.isNotNull(found)
  })
})
