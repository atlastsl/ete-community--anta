import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'
import AdminActivityLog from '#models/admin_activity_log'

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

async function createProduction(overrides: Partial<Production> = {}): Promise<Production> {
  return Production.create({
    title: `Prod ${Math.floor(Math.random() * 1_000_000)}`,
    summary: 'Résumé',
    authors: ['A'],
    tags: ['t'],
    category: 'article',
    domain: 'Maths',
    subdomain: ['Topo'],
    language: 'fr',
    publicationCountry: 'SN',
    licenseStatus: 'member',
    status: 'draft',
    workPublishedAt: DateTime.fromISO('2024-01-01'),
    createdById: null,
    ...overrides,
  })
}

test.group('Admin productions edit | page + update', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('admin GET /admin/productions/:id/edit → 200 + page Edit', async ({ client }) => {
    const admin = await createAdminUser()
    const production = await createProduction()
    const response = await client.get(`/admin/productions/${production.id}/edit`).loginAs(admin)
    response.assertStatus(200)
    response.assertTextIncludes('admin/Productions/Edit')
  })

  test('PUT met à jour les métadonnées + log update', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createProduction({ title: 'Ancien titre' })

    // .json() pour préserver les arrays (Inertia envoie du JSON ; `.form()` sérialiserait
    // un array à un seul élément en string et le validateur `vine.array()` le rejetterait).
    const response = await client
      .put(`/admin/productions/${production.id}`)
      .json({
        title: 'Nouveau titre',
        summary: 'Nouveau résumé',
        authors: ['B'],
        tags: ['x'],
        category: 'livre',
        domain: 'Physique',
        subdomain: ['Quantique'],
        language: 'en',
        publicationCountry: 'FR',
        licenseStatus: 'free_license',
        workPublishedAt: '2023-05-10',
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    await production.refresh()
    assert.equal(production.title, 'Nouveau titre')
    assert.equal(production.category, 'livre')
    assert.deepEqual(production.authors, ['B'])
    // updated_at maintenu par Lucid (autoUpdate) lors du save (FR35)
    assert.isNotNull(production.updatedAt)

    const log = await AdminActivityLog.query()
      .where('actionType', 'update')
      .where('resourceType', 'production')
      .where('resourceId', production.id)
      .first()
    assert.isNotNull(log)
  })

  test('PUT sur une production publiée → status reste published (FR22)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })
    // Production publiée complète : le formulaire renvoie TOUS les champs (un PUT remplace
    // l'ensemble des métadonnées). L'édition reste complète → status reste published (FR22).
    await ProductionLink.create({
      productionId: production.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: null,
    })

    await client
      .put(`/admin/productions/${production.id}`)
      .json({
        title: 'Titre modifié',
        summary: 'Résumé',
        authors: ['A'],
        tags: ['t'],
        category: 'article',
        domain: 'Maths',
        subdomain: ['Topo'],
        language: 'fr',
        publicationCountry: 'SN',
        licenseStatus: 'member',
        workPublishedAt: '2024-01-01',
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.status, 'published')
    assert.equal(production.title, 'Titre modifié')
  })

  test('édition rendant une production publiée incomplète → auto-dépubliée (D1)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })

    // PUT partiel : les champs non envoyés sont remis à null → production incomplète.
    await client
      .put(`/admin/productions/${production.id}`)
      .json({ title: 'Titre seul', authors: ['A'], tags: ['t'] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.status, 'draft')
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    const production = await createProduction()
    const response = await client.get(`/admin/productions/${production.id}/edit`).redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin productions edit | unpublish', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST unpublish → status draft, antaPublishedAt conservé, log unpublish', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      status: 'published',
      antaPublishedAt: DateTime.fromISO('2024-02-02T10:00:00'),
    })

    const response = await client
      .post(`/admin/productions/${production.id}/unpublish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    await production.refresh()
    assert.equal(production.status, 'draft')
    assert.isNotNull(production.antaPublishedAt)

    const log = await AdminActivityLog.query()
      .where('actionType', 'unpublish')
      .where('resourceId', production.id)
      .first()
    assert.isNotNull(log)
  })
})

test.group('Admin productions edit | delete', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => {
      drive.restore('r2')
      return db.rollbackGlobalTransaction()
    }
  })

  test('DELETE → production + fichiers/liens supprimés, fichier R2 supprimé, log delete', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const fileKey = `productions/${production.id}/doc.pdf`
    await fakeDisk.put(fileKey, 'contenu')
    await ProductionFile.create({
      productionId: production.id,
      fileKey,
      originalName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 7,
      storageProvider: 'r2',
    })
    await ProductionLink.create({
      productionId: production.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: null,
    })

    const response = await client
      .delete(`/admin/productions/${production.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/productions')

    assert.isNull(await Production.find(production.id))
    const fileCount = await ProductionFile.query()
      .where('productionId', production.id)
      .count('* as total')
    const linkCount = await ProductionLink.query()
      .where('productionId', production.id)
      .count('* as total')
    assert.equal(fileCount[0].$extras.total, 0)
    assert.equal(linkCount[0].$extras.total, 0)
    fakeDisk.assertMissing(fileKey)

    const log = await AdminActivityLog.query()
      .where('actionType', 'delete')
      .where('resourceType', 'production')
      .where('resourceId', production.id)
      .first()
    assert.isNotNull(log)
  })
})
