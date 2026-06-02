import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'

test.group('Production model', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('creates a production with all required fields', async ({ assert }) => {
    const admin = await AdminUser.create({
      email: 'prod-test@anta.test',
      passwordHash: 'hash',
      role: 'admin',
    })

    const production = await Production.create({
      title: 'Test Production',
      summary: 'A test summary',
      authors: ['Author One', 'Author Two'],
      tags: ['tag1', 'tag2'],
      category: 'informatique',
      domain: 'sciences',
      language: 'fr',
      licenseStatus: 'member',
      status: 'draft',
      createdById: admin.id,
    })

    assert.isString(production.id)
    assert.equal(production.title, 'Test Production')
    assert.deepEqual(production.authors, ['Author One', 'Author Two'])
    assert.deepEqual(production.tags, ['tag1', 'tag2'])
    assert.equal(production.status, 'draft')
    assert.equal(production.licenseStatus, 'member')
  })

  test('tsvector trigger populates search_vector on insert', async ({ assert }) => {
    const admin = await AdminUser.create({
      email: 'tsvector-test@anta.test',
      passwordHash: 'hash',
      role: 'admin',
    })

    await Production.create({
      title: 'Artificial Intelligence Research',
      summary: 'Deep learning and neural networks',
      authors: ['Jean Dupont'],
      tags: ['AI', 'deep learning'],
      category: 'informatique',
      domain: 'sciences',
      language: 'fr',
      licenseStatus: 'member',
      createdById: admin.id,
    })

    const result = await db
      .from('productions')
      .select(db.raw('search_vector IS NOT NULL as has_vector'))
      .first()

    assert.isTrue(result.has_vector)
  })

  test('GIN index exists on productions.search_vector', async ({ assert }) => {
    // On vérifie la STRUCTURE (l'index a été créé par la migration), pas le PLANNER —
    // PostgreSQL préfère Seq Scan sur table vide / petite (rollback transactionnel
    // laisse la table à 0 ligne), donc un EXPLAIN ne montrerait pas l'index dans ce contexte.
    const result = await db.rawQuery(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'productions'
         AND indexname = 'idx_productions_search_vector'`
    )

    assert.equal(result.rows.length, 1, 'idx_productions_search_vector doit exister')
    assert.include(
      result.rows[0].indexdef.toLowerCase(),
      'using gin',
      "l'index doit être de type GIN"
    )
    assert.include(
      result.rows[0].indexdef.toLowerCase(),
      'search_vector',
      "l'index doit couvrir la colonne search_vector"
    )
  })

  test('hasMany files relationship works', async ({ assert }) => {
    const admin = await AdminUser.create({
      email: 'rel-test@anta.test',
      passwordHash: 'hash',
      role: 'admin',
    })

    const production = await Production.create({
      title: 'Rel Test',
      authors: [],
      tags: [],
      licenseStatus: 'free_license',
      createdById: admin.id,
    })

    await ProductionFile.create({
      productionId: production.id,
      fileKey: 'test/file.pdf',
      originalName: 'file.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      storageProvider: 'r2',
    })

    await production.load('files')
    assert.lengthOf(production.files, 1)
    assert.equal(production.files[0].fileKey, 'test/file.pdf')
  })

  test('hasMany links relationship works', async ({ assert }) => {
    const admin = await AdminUser.create({
      email: 'link-test@anta.test',
      passwordHash: 'hash',
      role: 'admin',
    })

    const production = await Production.create({
      title: 'Link Test',
      authors: [],
      tags: [],
      licenseStatus: 'external_link',
      createdById: admin.id,
    })

    await ProductionLink.create({
      productionId: production.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: 'Example',
    })

    await production.load('links')
    assert.lengthOf(production.links, 1)
    assert.equal(production.links[0].linkType, 'simple')
  })

  test('belongsTo createdBy relationship works', async ({ assert }) => {
    const admin = await AdminUser.create({
      email: 'belongs-test@anta.test',
      passwordHash: 'hash',
      role: 'super_admin',
    })

    const production = await Production.create({
      title: 'BelongsTo Test',
      authors: [],
      tags: [],
      licenseStatus: 'member',
      createdById: admin.id,
    })

    await production.load('createdBy')
    assert.equal(production.createdBy.email, 'belongs-test@anta.test')
  })
})
