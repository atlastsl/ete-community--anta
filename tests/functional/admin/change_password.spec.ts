import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
  passwordChanged?: boolean
  isActive?: boolean
}

const PROVISIONAL_PASSWORD = 'ProvisionalPwd!!'
const NEW_PASSWORD = 'BrandNewPassword123' // 19 chars

async function createAdminUser(opts: AdminFixture = {}): Promise<AdminUser> {
  const email = `${Math.floor(Math.random() * 1_000_000)}@anta.test`
  return AdminUser.create({
    email,
    passwordHash: PROVISIONAL_PASSWORD, // hashé par le mixin AuthFinder au save
    role: opts.role ?? 'admin',
    passwordChanged: opts.passwordChanged ?? false,
    isActive: opts.isActive ?? true,
  })
}

test.group('Admin change-password | page (GET)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin avec passwordChanged=false → 200 + page rendue', async ({ client }) => {
    const user = await createAdminUser({ passwordChanged: false })
    const response = await client.get('/admin/auth/change-password').loginAs(user)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Auth/ChangePassword')
  })

  test('admin avec passwordChanged=true → 302 vers /admin/productions', async ({ client }) => {
    const user = await createAdminUser({ passwordChanged: true })
    const response = await client.get('/admin/auth/change-password').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })
})

test.group('Admin change-password | POST valide', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('password ≥ 12 + confirmation OK → BDD mise à jour + 302 vers /admin/productions', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password: NEW_PASSWORD, password_confirmation: NEW_PASSWORD })
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.isTrue(refreshed.passwordChanged, 'passwordChanged doit être true en BDD')
    assert.isTrue(
      await hash.verify(refreshed.passwordHash, NEW_PASSWORD),
      'le nouveau password doit hasher en BDD'
    )
    assert.isFalse(
      await hash.verify(refreshed.passwordHash, PROVISIONAL_PASSWORD),
      "l'ancien password ne doit plus valider"
    )
  })
})

test.group('Admin change-password | POST invalides', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('password < 12 chars → 302 + flashErrors password_too_short + BDD inchangée', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })
    const tooShort = 'ShortPwd123' // 11 chars

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password: tooShort, password_confirmation: tooShort })
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.change_password.errors.password_too_short')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.isFalse(refreshed.passwordChanged, 'passwordChanged doit rester false')
  })

  test('confirmation ≠ password → 302 + flashErrors confirmation_mismatch + BDD inchangée', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password: NEW_PASSWORD, password_confirmation: 'DifferentValue123' })
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.change_password.errors.confirmation_mismatch')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.isFalse(refreshed.passwordChanged)
  })

  test('password absent → 302 + flashErrors password_required + BDD inchangée', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password_confirmation: NEW_PASSWORD })
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.change_password.errors.password_required')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.isFalse(refreshed.passwordChanged)
  })
})

test.group('Admin change-password | idempotence (AC7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST par admin avec passwordChanged=true → 302 + BDD inchangée', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser({ passwordChanged: true })
    const originalHash = user.passwordHash

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password: NEW_PASSWORD, password_confirmation: NEW_PASSWORD })
      .loginAs(user)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.equal(refreshed.passwordHash, originalHash, 'le hash original doit être préservé')
    assert.isFalse(
      await hash.verify(refreshed.passwordHash, NEW_PASSWORD),
      'le nouveau password ne doit PAS avoir été appliqué'
    )
  })
})

test.group('Admin change-password | CSRF', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST sans token CSRF est rejeté (flash E_BAD_CSRF_TOKEN)', async ({ client, assert }) => {
    const user = await createAdminUser({ passwordChanged: false })

    const response = await client
      .post('/admin/auth/change-password')
      .form({ password: NEW_PASSWORD, password_confirmation: NEW_PASSWORD })
      .loginAs(user)
      .redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'E_BAD_CSRF_TOKEN')

    const refreshed = await AdminUser.findOrFail(user.id)
    assert.isFalse(refreshed.passwordChanged)
  })
})
