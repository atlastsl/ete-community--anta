import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
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

async function createCompleteProduction(
  license: 'member' | 'free_license' | 'external_link' = 'member'
): Promise<Production> {
  return Production.create({
    title: 'Topologie',
    summary: 'Résumé complet.',
    authors: ['Kofi A.'],
    tags: ['maths'],
    category: 'article',
    domain: 'Mathématiques',
    subdomain: ['Topologie'],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: license,
    status: 'draft',
    workPublishedAt: DateTime.fromISO('2024-03-15'),
    createdById: null,
  })
}

async function attachLink(production: Production) {
  await ProductionLink.create({
    productionId: production.id,
    url: 'https://example.com',
    linkType: 'simple',
    label: null,
  })
}

async function attachFile(production: Production) {
  await ProductionFile.create({
    productionId: production.id,
    fileKey: `productions/${production.id}/x.pdf`,
    originalName: 'x.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1234,
    storageProvider: 'r2',
  })
}

test.group('Admin productions publish', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('production complète + lien → publiée, antaPublishedAt défini, log publish', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createCompleteProduction()
    await attachLink(production)

    const response = await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    await production.refresh()
    assert.equal(production.status, 'published')
    assert.isNotNull(production.antaPublishedAt)

    const log = await AdminActivityLog.query()
      .where('actionType', 'publish')
      .where('resourceType', 'production')
      .where('resourceId', production.id)
      .first()
    assert.isNotNull(log)
  })

  test('antaPublishedAt inchangé lors d’une republication', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createCompleteProduction()
    await attachFile(production)

    await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    const firstPublishedAt = production.antaPublishedAt!.toMillis()

    // Simule une dépublication (retour brouillon) en conservant antaPublishedAt
    production.status = 'draft'
    await production.save()

    await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.status, 'published')
    assert.equal(production.antaPublishedAt!.toMillis(), firstPublishedAt)
  })

  test('production incomplète → reste brouillon, pas de log publish', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await Production.create({
      title: 'Incomplète',
      status: 'draft',
      authors: [],
      tags: [],
      licenseStatus: 'member',
      createdById: null,
    })

    const response = await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    await production.refresh()
    assert.equal(production.status, 'draft')

    const log = await AdminActivityLog.query()
      .where('actionType', 'publish')
      .where('resourceId', production.id)
      .first()
    assert.isNull(log)
  })

  test('external_link + fichier seul → rejet ; + lien → publiée', async ({ client, assert }) => {
    const admin = await createAdminUser()

    // Fichier seul : insuffisant pour external_link
    const withFile = await createCompleteProduction('external_link')
    await attachFile(withFile)
    await client
      .post(`/admin/productions/${withFile.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await withFile.refresh()
    assert.equal(withFile.status, 'draft')

    // Lien : suffisant
    const withLink = await createCompleteProduction('external_link')
    await attachLink(withLink)
    await client
      .post(`/admin/productions/${withLink.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await withLink.refresh()
    assert.equal(withLink.status, 'published')
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    const production = await createCompleteProduction()
    const response = await client
      .post(`/admin/productions/${production.id}/publish`)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})
