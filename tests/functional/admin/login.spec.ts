import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
  passwordChanged?: boolean
  isActive?: boolean
  password?: string
}

const DEFAULT_PASSWORD = 'CorrectPassword123!'

async function createAdminUser(
  opts: AdminFixture = {}
): Promise<{ user: AdminUser; password: string; email: string }> {
  const email = `${Math.floor(Math.random() * 1_000_000)}@anta.test`
  const password = opts.password ?? DEFAULT_PASSWORD
  // Le mixin AuthFinder hash le password en clair via beforeSave
  const user = await AdminUser.create({
    email,
    passwordHash: password,
    role: opts.role ?? 'admin',
    passwordChanged: opts.passwordChanged ?? true,
    isActive: opts.isActive ?? true,
  })
  return { user, password, email }
}

test.group('Admin login | page', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET /admin/login (anonyme) → 200 + page Inertia rendue', async ({ client }) => {
    const response = await client.get('/admin/login')
    response.assertStatus(200)
    response.assertTextIncludes('admin/Auth/Login')
  })

  test('GET /admin/login (déjà connecté + passwordChanged=true) → 302 vers /admin/productions', async ({
    client,
  }) => {
    const { user } = await createAdminUser({ passwordChanged: true })
    const response = await client.get('/admin/login').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })

  test('GET /admin/login (déjà connecté + passwordChanged=false) → 302 vers /admin/auth/change-password', async ({
    client,
  }) => {
    const { user } = await createAdminUser({ passwordChanged: false })
    const response = await client.get('/admin/login').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/auth/change-password')
  })
})

test.group('Admin login | POST credentials valides', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('credentials valides + passwordChanged=true → 302 vers /admin/productions', async ({
    client,
    assert,
  }) => {
    const { user, email, password } = await createAdminUser({ passwordChanged: true })
    const response = await client
      .post('/admin/login')
      .form({ email, password })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')

    const log = await AdminActivityLog.query()
      .where('adminUserId', user.id)
      .where('actionType', 'login')
      .first()
    assert.isNotNull(log, 'un log de connexion doit être créé après login réussi')
    assert.equal(log!.resourceType, 'session')
  })

  test('credentials valides + passwordChanged=false → 302 vers /admin/auth/change-password + log créé', async ({
    client,
    assert,
  }) => {
    const { user, email, password } = await createAdminUser({ passwordChanged: false })
    const response = await client
      .post('/admin/login')
      .form({ email, password })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/auth/change-password')

    const log = await AdminActivityLog.query()
      .where('adminUserId', user.id)
      .where('actionType', 'login')
      .first()
    assert.isNotNull(log, 'un log de connexion doit être créé même si passwordChanged=false')
  })
})

test.group('Admin login | POST credentials invalides', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('mauvais password → 302 redirect /admin/login + flashErrors.email générique', async ({
    client,
    assert,
  }) => {
    const { email } = await createAdminUser({ passwordChanged: true })
    const response = await client
      .post('/admin/login')
      .form({ email, password: 'WrongPassword!' })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.login.errors.invalid_credentials')
  })

  test('email inexistant → 302 redirect /admin/login + MÊME message générique', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/admin/login')
      .form({ email: 'ghost@anta.test', password: DEFAULT_PASSWORD })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.login.errors.invalid_credentials')
  })

  test('compte désactivé (isActive=false) → 302 + flashErrors.email account_inactive', async ({
    client,
    assert,
  }) => {
    const { email, password } = await createAdminUser({ isActive: false })
    const response = await client
      .post('/admin/login')
      .form({ email, password })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.login.errors.account_inactive')
  })

  test('email manquant → 422 (validation VineJS)', async ({ client }) => {
    const response = await client
      .post('/admin/login')
      .form({ password: 'x' })
      .withCsrfToken()
      .redirects(0)
    // Le ValidationException d'AdonisJS redirige (302) avec flashErrors
    response.assertStatus(302)
  })

  test('email malformé → 422 (validation VineJS)', async ({ client }) => {
    const response = await client
      .post('/admin/login')
      .form({ email: 'not-an-email', password: 'x' })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
  })
})

test.group('Admin login | CSRF', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST sans token CSRF est rejeté (flash E_BAD_CSRF_TOKEN + redirect)', async ({
    client,
    assert,
  }) => {
    const { email, password } = await createAdminUser()
    // PAS de .withCsrfToken() — Shield doit rejeter via flash + redirect back
    const response = await client.post('/admin/login').form({ email, password }).redirects(0)
    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'E_BAD_CSRF_TOKEN')
  })
})
