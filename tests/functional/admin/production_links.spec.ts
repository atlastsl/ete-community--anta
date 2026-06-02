import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import ProductionLink from '#models/production_link'

async function createAdminUser(): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

async function createProduction(): Promise<Production> {
  return Production.create({
    title: `Prod ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'draft',
    authors: [],
    tags: [],
    licenseStatus: 'external_link',
    createdById: null,
  })
}

test.group('Admin production links | store', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST lien valide → 302, production_links créé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/links`)
      .form({ url: 'https://example.com/article', linkType: 'simple', label: 'Source' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    const link = await ProductionLink.query().where('productionId', production.id).first()
    assert.isNotNull(link)
    assert.equal(link!.url, 'https://example.com/article')
    assert.equal(link!.linkType, 'simple')
    assert.equal(link!.label, 'Source')
  })

  test('POST URL invalide → 302 avec erreur, aucun production_links', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/links`)
      .form({ url: 'pas-une-url', linkType: 'simple' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const count = await ProductionLink.query()
      .where('productionId', production.id)
      .count('* as total')
    assert.equal(count[0].$extras.total, 0)
  })

  test('POST type invalide → rejet, aucun production_links', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/links`)
      .form({ url: 'https://example.com', linkType: 'bogus' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const count = await ProductionLink.query()
      .where('productionId', production.id)
      .count('* as total')
    assert.equal(count[0].$extras.total, 0)
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    const production = await createProduction()
    const response = await client
      .post(`/admin/productions/${production.id}/links`)
      .form({ url: 'https://example.com', linkType: 'simple' })
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin production links | destroy', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('DELETE lien → production_links supprimé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createProduction()
    const link = await ProductionLink.create({
      productionId: production.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: null,
    })

    const response = await client
      .delete(`/admin/productions/${production.id}/links/${link.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const stillThere = await ProductionLink.find(link.id)
    assert.isNull(stillThere)
  })
})
