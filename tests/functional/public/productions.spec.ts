import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

async function addViews(production: Production, count: number) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now(),
      ipHash: `v${i}`,
    })
  }
}

async function addDownloads(production: Production, count: number) {
  for (let i = 0; i < count; i++) {
    await StatsDownload.create({
      productionId: production.id,
      downloadedAt: DateTime.now(),
      ipHash: `d${i}`,
    })
  }
}

type ProdOverrides = { status?: 'draft' | 'published' | 'unpublished'; title?: string }
async function createProduction(overrides: ProdOverrides = {}): Promise<Production> {
  return Production.create({
    title: overrides.title ?? `Oeuvre ${Math.floor(Math.random() * 1_000_000)}`,
    summary: 'Résumé de test complet.',
    authors: ['Auteur Test'],
    tags: ['tag-test'],
    category: 'Livre',
    domain: 'Informatique',
    subdomain: ['IA'],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: overrides.status ?? 'published',
  })
}

test.group('Public productions | contrat de base', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET /productions → 200 + props results/facets/activeFilters/pagination/q', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/productions')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.properties(props, ['results', 'facets', 'activeFilters', 'pagination', 'q'])
    assert.isNull(props.q)
  })

  test('GET /productions?q=test&category=livre reflète q + activeFilters', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/productions?q=test&category=livre')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.q, 'test')
    assert.deepEqual(props.activeFilters.category, ['livre'])
  })

  test('GET /productions sans paramètre → q null, filtres vides', async ({ client, assert }) => {
    const response = await client.get('/productions')
    const props = extractProps(response.text())
    assert.isNull(props.q)
    assert.deepEqual(props.activeFilters.category, [])
  })
})

test.group('Public production | page détail (slug)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('production publiée → 200 + métadonnées complètes', async ({ client, assert }) => {
    const prod = await createProduction({ status: 'published', title: 'Ma Belle Oeuvre Publiée' })
    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.production.title, 'Ma Belle Oeuvre Publiée')
    assert.equal(props.production.slug, prod.slug)
    assert.properties(props.production, [
      'authors',
      'category',
      'domain',
      'subdomain',
      'language',
      'publicationCountry',
      'licenseStatus',
      'summary',
      'viewsCount',
      'downloadsCount',
      'files',
      'links',
    ])
  })

  test('production en brouillon → 404', async ({ client }) => {
    const prod = await createProduction({ status: 'draft' })
    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(404)
  })

  test('production dépubliée → 404', async ({ client }) => {
    const prod = await createProduction({ status: 'unpublished' })
    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(404)
  })

  test('slug inexistant → 404', async ({ client }) => {
    const response = await client.get('/productions/slug-qui-nexiste-pas-123456')
    response.assertStatus(404)
  })

  test('slug généré automatiquement à la création', async ({ assert }) => {
    const prod = await createProduction({ title: 'Titre Avec Accents Élève' })
    assert.equal(prod.slug, 'titre-avec-accents-eleve')
  })
})

test.group('Public production | lecteurs de médias (URLs signées)', (group) => {
  group.each.setup(async () => {
    drive.fake('r2')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      drive.restore('r2')
    }
  })

  async function attachFile(production: Production, mimeType: string, name: string) {
    return ProductionFile.create({
      productionId: production.id,
      fileKey: `productions/${production.id}/${name}`,
      originalName: name,
      mimeType,
      sizeBytes: 1024,
      storageProvider: 'r2',
    })
  }

  test('fichier PDF → props.files[0].url signée non vide', async ({ client, assert }) => {
    const prod = await createProduction({ status: 'published' })
    await attachFile(prod, 'application/pdf', 'doc.pdf')

    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.production.files, 1)
    assert.equal(props.production.files[0].mimeType, 'application/pdf')
    assert.isString(props.production.files[0].url)
    assert.isNotEmpty(props.production.files[0].url)
  })

  test('plusieurs fichiers → chacun avec son url', async ({ client, assert }) => {
    const prod = await createProduction({ status: 'published' })
    await attachFile(prod, 'application/pdf', 'doc.pdf')
    await attachFile(prod, 'video/mp4', 'video.mp4')

    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.lengthOf(props.production.files, 2)
    for (const file of props.production.files) {
      assert.isString(file.url)
      assert.isNotEmpty(file.url)
    }
  })
})

test.group('Public production | agrégation des compteurs (6.5)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('viewsCount/downloadsCount reflètent le nombre de stats enregistrées', async ({
    client,
    assert,
  }) => {
    const prod = await createProduction({ status: 'published' })
    await addViews(prod, 7)
    await addDownloads(prod, 3)

    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.production.viewsCount, 7)
    assert.equal(props.production.downloadsCount, 3)
  })

  test('production sans stat → compteurs à 0', async ({ client, assert }) => {
    const prod = await createProduction({ status: 'published' })

    const response = await client.get(`/productions/${prod.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.production.viewsCount, 0)
    assert.equal(props.production.downloadsCount, 0)
  })
})
