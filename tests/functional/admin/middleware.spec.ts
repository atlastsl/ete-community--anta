import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
  passwordChanged?: boolean
  isActive?: boolean
}

async function createAdminUser(opts: AdminFixture = {}): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: opts.role ?? 'admin',
    passwordChanged: opts.passwordChanged ?? true,
    isActive: opts.isActive ?? true,
  })
}

test.group('Admin middleware | auth', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('un utilisateur anonyme est redirigé vers /admin/login', async ({ client }) => {
    const response = await client.get('/admin/productions').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })

  test('un admin complet (passwordChanged=true, isActive=true) accède au dashboard', async ({
    client,
  }) => {
    const user = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/productions').loginAs(user)
    response.assertStatus(200)
  })

  test('un admin avec passwordChanged=false est redirigé vers change-password', async ({
    client,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })
    const response = await client.get('/admin/productions').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/auth/change-password')
  })

  test("un admin sur /admin/auth/change-password n'est pas redirigé en boucle", async ({
    client,
  }) => {
    const user = await createAdminUser({ passwordChanged: false })
    const response = await client.get('/admin/auth/change-password').loginAs(user)
    response.assertStatus(200)
  })

  test('un compte désactivé est déconnecté et redirigé vers /admin/login', async ({ client }) => {
    const user = await createAdminUser({ isActive: false })
    const response = await client.get('/admin/productions').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin middleware | super admin', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('un super_admin accède à /admin/users', async ({ client }) => {
    const user = await createAdminUser({ role: 'super_admin' })
    const response = await client.get('/admin/users').loginAs(user)
    response.assertStatus(200)
  })

  test('un admin (rôle admin) est redirigé vers /admin/productions sur /admin/users', async ({
    client,
  }) => {
    const user = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/users').loginAs(user).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })
})
