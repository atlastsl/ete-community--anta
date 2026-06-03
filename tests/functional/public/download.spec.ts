import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import StatsDownload from '#models/stats_download'

async function createProduction(status: 'draft' | 'published' | 'unpublished' = 'published') {
  return Production.create({
    title: `DL ${Math.floor(Math.random() * 1_000_000)}`,
    status,
    authors: [],
    tags: [],
    subdomain: [],
    licenseStatus: 'member',
  })
}

async function attachFile(production: Production, name = 'doc.pdf') {
  return ProductionFile.create({
    productionId: production.id,
    fileKey: `productions/${production.id}/${name}`,
    originalName: name,
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    storageProvider: 'r2',
  })
}

test.group('Public download | endpoint', (group) => {
  group.each.setup(async () => {
    drive.fake('r2')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      drive.restore('r2')
    }
  })

  test('production publiée + fichier → 302 + 1 téléchargement enregistré', async ({
    client,
    assert,
  }) => {
    const prod = await createProduction('published')
    const file = await attachFile(prod)

    const response = await client
      .get(`/productions/${prod.slug}/files/${file.id}/download`)
      .redirects(0)
    response.assertStatus(302)

    // L'en-tête Location est l'URL signée R2 retournée (AC#3 6.5).
    const location = response.headers().location
    assert.isString(location)
    assert.isNotEmpty(location)

    const count = await StatsDownload.query().where('production_id', prod.id).count('* as total')
    assert.equal(Number(count[0].$extras.total), 1)
  })

  test('ip_hash est anonymisé (sha256 hex, jamais l’IP brute)', async ({ client, assert }) => {
    const prod = await createProduction('published')
    const file = await attachFile(prod)

    await client.get(`/productions/${prod.slug}/files/${file.id}/download`).redirects(0)

    const row = await StatsDownload.query().where('production_id', prod.id).firstOrFail()
    assert.isNotNull(row.ipHash)
    assert.match(row.ipHash!, /^[a-f0-9]{64}$/)
  })

  test('production en brouillon → 404 + aucun enregistrement', async ({ client, assert }) => {
    const prod = await createProduction('draft')
    const file = await attachFile(prod)

    const response = await client
      .get(`/productions/${prod.slug}/files/${file.id}/download`)
      .redirects(0)
    response.assertStatus(404)

    const count = await StatsDownload.query().where('production_id', prod.id).count('* as total')
    assert.equal(Number(count[0].$extras.total), 0)
  })

  test('fichier d’une autre production → 404', async ({ client }) => {
    const prodA = await createProduction('published')
    const prodB = await createProduction('published')
    const fileB = await attachFile(prodB)

    const response = await client
      .get(`/productions/${prodA.slug}/files/${fileB.id}/download`)
      .redirects(0)
    response.assertStatus(404)
  })

  test('fileId inexistant → 404', async ({ client }) => {
    const prod = await createProduction('published')
    const response = await client
      .get(`/productions/${prod.slug}/files/00000000-0000-0000-0000-000000000000/download`)
      .redirects(0)
    response.assertStatus(404)
  })
})
