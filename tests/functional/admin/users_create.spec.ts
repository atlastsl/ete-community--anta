import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
  isActive?: boolean
  createdById?: string | null
  email?: string
}

async function createAdminUser(opts: AdminFixture = {}): Promise<AdminUser> {
  return AdminUser.create({
    email: opts.email ?? `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: opts.role ?? 'admin',
    passwordChanged: true,
    isActive: opts.isActive ?? true,
    createdById: opts.createdById ?? null,
  })
}

test.group('Admin users create | super admin access', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin GET /admin/users/create → 200 + page admin/Users/Create', async ({
    client,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const response = await client.get('/admin/users/create').loginAs(superAdmin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Users/Create')
  })

  test('super admin POST /admin/users avec email valide → 302 redirect + compte créé', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const newEmail = 'new-admin@anta.test'

    const response = await client
      .post('/admin/users')
      .form({ email: newEmail })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/users')

    const created = await AdminUser.findBy('email', newEmail)
    assert.isNotNull(created)
    assert.equal(created!.role, 'admin')
    assert.isTrue(created!.isActive)
    assert.isFalse(created!.passwordChanged)
    assert.equal(created!.createdById, superAdmin.id)
  })

  test('la création logue une action via ActivityLogService', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const newEmail = 'log-test@anta.test'

    await client
      .post('/admin/users')
      .form({ email: newEmail })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    const created = await AdminUser.findBy('email', newEmail)
    const log = await AdminActivityLog.query()
      .where('adminUserId', superAdmin.id)
      .where('actionType', 'create')
      .where('resourceType', 'admin_user')
      .where('resourceId', created!.id)
      .first()

    assert.isNotNull(log)
  })

  test('POST avec email déjà existant → 302 redirect avec erreur de validation', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const existing = await createAdminUser({ role: 'admin' })
    const countBefore = await AdminUser.query().count('* as total')

    const response = await client
      .post('/admin/users')
      .form({ email: existing.email })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const countAfter = await AdminUser.query().count('* as total')
    assert.equal(countBefore[0].$extras.total, countAfter[0].$extras.total)
  })

  test('POST avec email invalide → 302 redirect avec erreur de validation', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const countBefore = await AdminUser.query().count('* as total')

    const response = await client
      .post('/admin/users')
      .form({ email: 'not-an-email' })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const countAfter = await AdminUser.query().count('* as total')
    assert.equal(countBefore[0].$extras.total, countAfter[0].$extras.total)
  })

  test('POST sans email → 302 redirect avec erreur de validation', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const countBefore = await AdminUser.query().count('* as total')

    const response = await client
      .post('/admin/users')
      .form({ email: '' })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const countAfter = await AdminUser.query().count('* as total')
    assert.equal(countBefore[0].$extras.total, countAfter[0].$extras.total)
  })
})

test.group('Admin users create | admin access denied', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin POST /admin/users → 302 redirect dashboard (protégé par SuperAdminMiddleware)', async ({
    client,
  }) => {
    const admin = await createAdminUser({ role: 'admin' })

    const response = await client
      .post('/admin/users')
      .form({ email: 'should-fail@anta.test' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })

  test('admin GET /admin/users/create → 302 redirect dashboard', async ({ client }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/users/create').loginAs(admin).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })
})

test.group('Admin users create | review findings', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  // P3 — En environnement de test le mailer Mailgun n'a pas de clé → l'envoi échoue,
  // la branche catch s'exécute : flash no_email + exposition du mot de passe provisoire.
  test('échec envoi email → flash create_success_no_email + tempPassword exposé', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    const response = await client
      .post('/admin/users')
      .form({ email: 'flash-branch@anta.test' })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'users.create_success_no_email')
    assert.include(JSON.stringify(flash), 'tempPassword')
  })

  // P1 — l'email est normalisé en minuscules avant insertion.
  test('email normalisé en minuscules à la création', async ({ client, assert }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })

    await client
      .post('/admin/users')
      .form({ email: 'MixedCase@Anta.Test' })
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)

    const created = await AdminUser.findBy('email', 'mixedcase@anta.test')
    assert.isNotNull(created)
  })
})
