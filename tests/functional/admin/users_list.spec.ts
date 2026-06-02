import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'

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

test.group('Admin users list | super admin access', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('super admin GET /admin/users → 200 + page admin/Users/Index', async ({ client }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const response = await client.get('/admin/users').loginAs(superAdmin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Users/Index')
  })

  test('la liste exclut le super admin connecté et inclut les autres admins', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const admin1 = await createAdminUser({ role: 'admin' })
    const admin2 = await createAdminUser({ role: 'admin' })

    const response = await client.get('/admin/users').loginAs(superAdmin)
    response.assertStatus(200)

    const body = response.text()
    const match = body.match(/data-page="([^"]*)"/)
    assert.isNotNull(match, 'data-page attribute doit exister')
    const pageData = JSON.parse(match![1].replace(/&quot;/g, '"'))
    const userIds = (pageData.props.users as Array<{ id: string }>).map((u) => u.id)

    assert.equal(userIds.length, 2)
    assert.include(userIds, admin1.id)
    assert.include(userIds, admin2.id)
    assert.notInclude(userIds, superAdmin.id)
  })

  test('aucun admin existant → page se charge sans erreur (état vide)', async ({ client }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const response = await client.get('/admin/users').loginAs(superAdmin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Users/Index')
  })

  test('affiche le créateur (createdBy) pour les admins créés par le super admin', async ({
    client,
    assert,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    await createAdminUser({ role: 'admin', createdById: superAdmin.id })

    const response = await client.get('/admin/users').loginAs(superAdmin)
    response.assertStatus(200)

    const body = response.text()
    assert.include(body, superAdmin.email)
  })
})

test.group('Admin users list | admin access denied', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin GET /admin/users → 302 redirect dashboard', async ({ client }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/users').loginAs(admin).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')
  })
})
