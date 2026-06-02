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

test.group('Admin users reset-password | super admin', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin POST reset-password → 302, passwordChanged=false, hash modifié', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })
    const oldHash = admin.passwordHash

    const response = await client
      .post(`/admin/users/${admin.id}/reset-password`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    await admin.refresh()
    assert.isFalse(admin.passwordChanged)
    assert.notEqual(admin.passwordHash, oldHash)
  })

  test('la réinitialisation logue une action password_reset via ActivityLogService', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    await client
      .post(`/admin/users/${admin.id}/reset-password`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    const log = await AdminActivityLog.query()
      .where('adminUserId', superAdmin.id)
      .where('actionType', 'password_reset')
      .where('resourceType', 'admin_user')
      .where('resourceId', admin.id)
      .first()

    assert.isNotNull(log)
  })
})

test.group('Admin users reset-password | protection', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin POST reset-password → 302 redirect dashboard (SuperAdminMiddleware)', async ({
    client,
  }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const target = await createAdminUser({ role: 'admin' })

    const response = await client
      .post(`/admin/users/${target.id}/reset-password`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })

  test('POST avec ID inexistant → 404', async ({ client }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .post('/admin/users/00000000-0000-0000-0000-000000000000/reset-password')
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(404)
  })
})

test.group('Admin users reset-password | review findings', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  // D2 — le reset incrémente sessionVersion, ce qui invalide les sessions actives de la cible.
  test('reset incrémente sessionVersion (invalide les sessions actives)', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin = await createAdminUser({ role: 'admin' })

    await client
      .post(`/admin/users/${admin.id}/reset-password`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    await admin.refresh()
    assert.equal(admin.sessionVersion, 1)
  })

  // D5 — un super_admin ne peut pas réinitialiser son propre mot de passe ici.
  test('super admin ne peut pas réinitialiser son propre MDP → inchangé', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const oldHash = superAdmin.passwordHash

    const response = await client
      .post(`/admin/users/${superAdmin.id}/reset-password`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await superAdmin.refresh()
    assert.equal(superAdmin.passwordHash, oldHash)
    assert.isTrue(superAdmin.passwordChanged)
  })

  // D1 — un super_admin cible est protégé contre le reset.
  test('reset sur un super_admin cible → bloqué, hash inchangé', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const otherSuper = await createAdminUser({ role: 'super_admin' })
    const oldHash = otherSuper.passwordHash

    const response = await client
      .post(`/admin/users/${otherSuper.id}/reset-password`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await otherSuper.refresh()
    assert.equal(otherSuper.passwordHash, oldHash)
  })
})
