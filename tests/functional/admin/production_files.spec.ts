import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import ProductionFile from '#models/production_file'

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
    licenseStatus: 'member',
    createdById: null,
  })
}

const TMP = join(tmpdir(), 'anta-test-uploads')
mkdirSync(TMP, { recursive: true })

/** Écrit un PDF minimal (octets magiques %PDF) et retourne son chemin. */
function makePdf(name: string): string {
  const path = join(TMP, name)
  writeFileSync(path, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1'))
  return path
}

/** Écrit un fichier texte nommé .pdf (MIME falsifié) et retourne son chemin. */
function makeFakePdf(name: string): string {
  const path = join(TMP, name)
  writeFileSync(path, 'ceci est du texte brut, pas un pdf', 'utf-8')
  return path
}

test.group('Admin production files | upload', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('upload PDF valide → 302, production_files créé + fichier sur le disque', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makePdf('valid.pdf'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    const record = await ProductionFile.query().where('productionId', production.id).first()
    assert.isNotNull(record)
    assert.equal(record!.originalName, 'valid.pdf')
    assert.equal(record!.mimeType, 'application/pdf')
    assert.equal(record!.storageProvider, 'r2')
    assert.isTrue(record!.sizeBytes > 0)
    assert.match(record!.fileKey, new RegExp(`^productions/${production.id}/`))

    fakeDisk.assertExists(record!.fileKey)
  })

  test('upload fichier au MIME falsifié (.pdf texte) → rejet, aucun enregistrement', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makeFakePdf('fake.pdf'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    const count = await ProductionFile.query()
      .where('productionId', production.id)
      .count('* as total')
    assert.equal(count[0].$extras.total, 0)
  })

  test('accès non authentifié → redirect /admin/login', async ({ client }) => {
    drive.fake('r2')
    const production = await createProduction()
    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makePdf('unauth.pdf'))
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin production files | delete', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('DELETE fichier → production_files supprimé + absent du disque', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makePdf('todelete.pdf'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    const key = record.fileKey

    const response = await client
      .delete(`/admin/productions/${production.id}/files/${record.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)

    const stillThere = await ProductionFile.find(record.id)
    assert.isNull(stillThere)
    fakeDisk.assertMissing(key)
  })
})
