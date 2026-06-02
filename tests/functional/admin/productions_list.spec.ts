import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Production from '#models/production'

type AdminFixture = {
  role?: 'admin' | 'super_admin'
}

async function createAdminUser(opts: AdminFixture = {}): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: opts.role ?? 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

type ProductionFixture = {
  title?: string
  status?: 'draft' | 'published' | 'unpublished'
  authors?: string[]
  category?: string | null
}

async function createProduction(opts: ProductionFixture = {}): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: opts.status ?? 'draft',
    authors: opts.authors ?? [],
    tags: [],
    category: opts.category ?? null,
    licenseStatus: 'member',
    createdById: null,
  })
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

test.group('Admin productions list | access', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin GET /admin/productions → 200 + page admin/Productions/Index', async ({ client }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/productions').loginAs(admin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Productions/Index')
  })

  test('super_admin GET /admin/productions → 200 (route accessible aux deux rôles)', async ({
    client,
  }) => {
    const superAdmin = await createAdminUser({ role: 'super_admin' })
    const response = await client.get('/admin/productions').loginAs(superAdmin)
    response.assertStatus(200)
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    const response = await client.get('/admin/productions').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin productions list | contenu', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('retourne les productions avec les champs attendus', async ({ client, assert }) => {
    const admin = await createAdminUser({ role: 'admin' })
    await createProduction({ title: 'Topologie algébrique', authors: ['Kofi A.'], status: 'draft' })

    const response = await client.get('/admin/productions').loginAs(admin)
    response.assertStatus(200)

    const props = extractProps(response.text())
    assert.isNotNull(props)
    assert.lengthOf(props.productions, 1)
    const row = props.productions[0]
    assert.properties(row, ['id', 'title', 'authors', 'category', 'status', 'updatedAt'])
    assert.equal(row.title, 'Topologie algébrique')
    assert.deepEqual(row.authors, ['Kofi A.'])
  })

  test('aucune production → 200, liste vide', async ({ client, assert }) => {
    const admin = await createAdminUser({ role: 'admin' })
    const response = await client.get('/admin/productions').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.productions, 0)
  })

  test('?status=published ne retourne que les productions publiées', async ({ client, assert }) => {
    const admin = await createAdminUser({ role: 'admin' })
    await createProduction({ status: 'draft' })
    await createProduction({ status: 'published', title: 'Publiée 1' })
    await createProduction({ status: 'published', title: 'Publiée 2' })
    await createProduction({ status: 'unpublished' })

    const response = await client.get('/admin/productions?status=published').loginAs(admin)
    response.assertStatus(200)

    const props = extractProps(response.text())
    assert.lengthOf(props.productions, 2)
    assert.isTrue(props.productions.every((p: { status: string }) => p.status === 'published'))
    assert.equal(props.currentStatus, 'published')
  })

  test('status invalide est ignoré (toutes les productions retournées)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser({ role: 'admin' })
    await createProduction({ status: 'draft' })
    await createProduction({ status: 'published' })

    const response = await client.get('/admin/productions?status=bogus').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.productions, 2)
    assert.isNull(props.currentStatus)
  })
})

test.group('Admin productions list | pagination', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('21 productions → page 1 contient 20 items, lastPage = 2', async ({ client, assert }) => {
    const admin = await createAdminUser({ role: 'admin' })
    for (let i = 0; i < 21; i++) {
      await createProduction({ title: `Prod ${i}` })
    }

    const response = await client.get('/admin/productions').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.productions, 20)
    assert.equal(props.pagination.lastPage, 2)
    assert.equal(props.pagination.total, 21)
  })

  test('?page=2 contient le 21e item', async ({ client, assert }) => {
    const admin = await createAdminUser({ role: 'admin' })
    for (let i = 0; i < 21; i++) {
      await createProduction({ title: `Prod ${i}` })
    }

    const response = await client.get('/admin/productions?page=2').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.productions, 1)
    assert.equal(props.pagination.currentPage, 2)
  })
})
