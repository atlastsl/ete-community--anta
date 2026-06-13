import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import AdminActivityLog from '#models/admin_activity_log'

async function createAdminUser(role: 'admin' | 'super_admin' = 'admin'): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role,
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

test.group('Admin productions create | page', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin GET /admin/productions/create → 200 + page admin/Productions/Create', async ({
    client,
  }) => {
    const admin = await createAdminUser()
    const response = await client.get('/admin/productions/create').loginAs(admin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Productions/Create')
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    const response = await client.get('/admin/productions/create').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin productions create | store brouillon', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST minimal { title } → 302, brouillon créé avec défauts', async ({ client, assert }) => {
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/productions')
      .form({ title: 'Brouillon minimal' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.match(response.header('location') ?? '', /\/admin\/productions\/[0-9a-f-]+\/edit/)

    const created = await Production.findBy('title', 'Brouillon minimal')
    assert.isNotNull(created)
    assert.equal(created!.status, 'draft')
    assert.equal(created!.licenseStatus, 'member')
    assert.equal(created!.createdById, admin.id)
    assert.deepEqual(created!.authors, [])
    assert.deepEqual(created!.tags, [])
  })

  test('POST avec champs complets → métadonnées et arrays enregistrés', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/productions')
      .json({
        title: 'Topologie algébrique',
        summary: 'Un résumé.',
        authors: ['Kofi A.', 'Amara B.'],
        tags: ['maths', 'topologie'],
        category: 'article',
        domain: 'mathematics',
        subdomain: ['topology'],
        language: 'fr',
        publicationCountry: 'Sénégal',
        licenseStatus: 'free_license',
        workPublishedAt: '2024-03-15',
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    const created = await Production.findBy('title', 'Topologie algébrique')
    assert.isNotNull(created)
    assert.equal(created!.status, 'draft')
    assert.equal(created!.licenseStatus, 'free_license')
    assert.deepEqual(created!.authors, ['Kofi A.', 'Amara B.'])
    assert.deepEqual(created!.tags, ['maths', 'topologie'])
    assert.equal(created!.category, 'article')
    assert.isNotNull(created!.workPublishedAt)
  })

  test('POST sans title → 302 redirect avec erreur, aucune production créée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const countBefore = await Production.query().count('* as total')

    const response = await client
      .post('/admin/productions')
      .form({ summary: 'Sans titre' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const countAfter = await Production.query().count('* as total')
    assert.equal(countBefore[0].$extras.total, countAfter[0].$extras.total)
  })

  test('la création logue une action create/production via ActivityLogService', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()

    await client
      .post('/admin/productions')
      .form({ title: 'Loggable' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    const created = await Production.findBy('title', 'Loggable')
    const log = await AdminActivityLog.query()
      .where('adminUserId', admin.id)
      .where('actionType', 'create')
      .where('resourceType', 'production')
      .where('resourceId', created!.id)
      .first()

    assert.isNotNull(log)
  })
})
