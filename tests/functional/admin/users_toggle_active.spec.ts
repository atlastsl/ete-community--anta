import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'

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

test.group('Admin users toggle-active | deactivation', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin PATCH toggle-active sur un compte actif → isActive=false', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin', isActive: true })

    const response = await client
      .patch(`/admin/users/${admin.id}/toggle-active`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    await admin.refresh()
    assert.isFalse(admin.isActive)
  })

  test('la désactivation logue une action via ActivityLogService', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    await client
      .patch(`/admin/users/${admin.id}/toggle-active`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    const log = await AdminActivityLog.query()
      .where('adminUserId', superAdmin.id)
      .where('actionType', 'update')
      .where('resourceType', 'admin_user')
      .where('resourceId', admin.id)
      .first()

    assert.isNotNull(log)
  })
})

test.group('Admin users toggle-active | reactivation', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin PATCH toggle-active sur un compte inactif → isActive=true', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin', isActive: false })

    const response = await client
      .patch(`/admin/users/${admin.id}/toggle-active`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    await admin.refresh()
    assert.isTrue(admin.isActive)
  })
})

test.group('Admin users toggle-active | protection', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin ne peut pas se désactiver lui-même → isActive inchangé', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .patch(`/admin/users/${superAdmin.id}/toggle-active`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    await superAdmin.refresh()
    assert.isTrue(superAdmin.isActive)
  })

  test('admin PATCH toggle-active → 302 redirect dashboard (SuperAdminMiddleware)', async ({
    client,
  }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const target = await createAdminUser({ role: 'admin' })

    const response = await client
      .patch(`/admin/users/${target.id}/toggle-active`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })

  test('PATCH avec ID inexistant → 404', async ({ client }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .patch('/admin/users/00000000-0000-0000-0000-000000000000/toggle-active')
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(404)
  })
})

test.group('Admin users toggle-active | review findings', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  // P4 — un compte désactivé est déconnecté/redirigé vers login à la requête suivante
  // (enforcement de l'invalidation de session via AdminMiddleware).
  test('un compte désactivé est redirigé vers login à la requête suivante', async ({ client }) => {
    const inactive = await createAdminUser({ role: 'admin', isActive: false })
    const response = await client.get('/admin/productions').loginAs(inactive).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })

  // D1 — un super_admin cible est protégé contre la désactivation.
  test('toggle-active sur un super_admin cible → bloqué, isActive inchangé', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const otherSuper = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .patch(`/admin/users/${otherSuper.id}/toggle-active`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    await otherSuper.refresh()
    assert.isTrue(otherSuper.isActive)
  })
})
