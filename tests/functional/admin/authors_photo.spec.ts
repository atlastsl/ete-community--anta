import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import AdminActivityLog from '#models/admin_activity_log'
import Production from '#models/production'
import AuthorService from '#services/author_service'
import FileStorageService from '#services/file_storage_service'
import ImageService from '#services/image_service'

// Noms fictifs uniquement (dépôt public). Images générées par sharp, jamais de vraie photo.

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

async function createAuthor(
  lastNames = 'Fictif',
  institutions: string[] = ['Université Exemple'],
  extra: Partial<Author> = {}
): Promise<Author> {
  const author = await Author.create({ firstNames: 'Jean', lastNames, ...extra })
  for (const [index, institution] of institutions.entries()) {
    await AuthorAffiliation.create({
      authorId: author.id,
      position: index + 1,
      institution,
      department: null,
    })
  }
  return author
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).props
}

function flashedErrors(flash: Record<string, any>): Record<string, string> {
  const raw = (flash.errors ?? flash.inputErrorsBag ?? {}) as Record<string, string | string[]>
  return Object.fromEntries(
    Object.entries(raw).map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
  )
}

const TMP = join(tmpdir(), 'anta-test-author-photos')
mkdirSync(TMP, { recursive: true })

/** JPEG généré avec EXIF + GPS, écrit dans tmpdir. */
async function makeJpeg(name: string, color = { r: 180, g: 40, b: 40 }): Promise<string> {
  const path = join(TMP, name)
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: color },
  })
    .jpeg()
    .withExif({
      IFD0: { Copyright: 'Test' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 3/1 0/1' },
    })
    .toBuffer()
  writeFileSync(path, buffer)
  return path
}

function makeTextAsJpg(name: string): string {
  const path = join(TMP, name)
  writeFileSync(path, 'ceci est du texte brut, pas une image', 'utf-8')
  return path
}

/** Clés stockées sur le disque factice sous `authors/`. */
async function storedKeys(): Promise<string[]> {
  const { objects } = await drive.use('r2').listAll('authors', { recursive: true })
  return Array.from(objects)
    .filter((o) => o.isFile)
    .map((o) => (o as { key: string }).key)
    .sort()
}

async function updateLog(authorId: string) {
  return AdminActivityLog.query()
    .where('resourceId', authorId)
    .where('actionType', 'update')
    .first()
}

const ID_PREFIX = (id: string) => new RegExp(`^authors/${id}/[A-Za-z0-9_-]{20}$`)

test.group('Admin authors | photo', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('création multipart avec photo → 3 variantes sans EXIF, photo_key = préfixe', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/authors')
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('affiliations[0][department]', 'Physique')
      .file('photo', await makeJpeg('create.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const author = await Author.query()
      .where('lastNames', 'Fictif')
      .preload('affiliations')
      .firstOrFail()
    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.match(author.photoKey!, ID_PREFIX(author.id))
    assert.deepEqual(
      author.affiliations.map((a) => [a.institution, a.department]),
      [['Université Exemple', 'Physique']]
    )
    const keys = AuthorService.photoKeys(author.photoKey!)
    fakeDisk.assertExists(keys)
    for (const key of keys) {
      const meta = await sharp(Buffer.from(await drive.use('r2').getBytes(key))).metadata()
      assert.isUndefined(meta.exif)
    }
    // La création reste journalisée { name } (inchangé).
    const log = await AdminActivityLog.query()
      .where('resourceId', author.id)
      .where('actionType', 'create')
      .firstOrFail()
    assert.deepEqual(log.metadata, { name: 'Jean Fictif' })
  })

  test('modification avec nouvelle photo → nouveau préfixe, anciennes clés supprimées, journal photo', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor()
    await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', await makeJpeg('first.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await author.refresh()
    const oldPrefix = author.photoKey!
    assert.match(oldPrefix, ID_PREFIX(author.id))
    let log = await updateLog(author.id)
    assert.deepEqual(log!.metadata, { name: 'Jean Fictif', fields: ['photo'] })
    await log!.delete()

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', await makeJpeg('second.jpg', { r: 20, g: 20, b: 160 }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await author.refresh()
    assert.notEqual(author.photoKey, oldPrefix)
    assert.match(author.photoKey!, ID_PREFIX(author.id))
    fakeDisk.assertExists(AuthorService.photoKeys(author.photoKey!))
    fakeDisk.assertMissing(AuthorService.photoKeys(oldPrefix))
    log = await updateLog(author.id)
    assert.deepEqual(log!.metadata, { name: 'Jean Fictif', fields: ['photo'] })
  })

  test('removePhoto=1 → photo_key NULL, variantes supprimées, journal photo', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const created = await AuthorService.create(
      { lastNames: 'Fictif', firstNames: 'Jean', affiliations: [{ institution: 'U' }] },
      null,
      await ImageService.authorPhotoVariants(await makeJpeg('remove.jpg'))
    )
    const prefix = created.photoKey!

    const response = await client
      .put(`/admin/authors/${created.id}`)
      .json({
        lastNames: 'Fictif',
        firstNames: 'Jean',
        affiliations: [{ institution: 'U' }],
        removePhoto: true,
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const saved = await Author.findOrFail(created.id)
    assert.isNull(saved.photoKey)
    fakeDisk.assertMissing(AuthorService.photoKeys(prefix))
    assert.deepEqual((await updateLog(created.id))!.metadata, {
      name: 'Jean Fictif',
      fields: ['photo'],
    })
  })

  test('removePhoto sans photo enregistrée → aucun changement, aucun journal', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor()

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('removePhoto', '1')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.isNull(await updateLog(author.id))
    await author.refresh()
    assert.isNull(author.photoKey)
  })

  test('removePhoto=1 en multipart sur une fiche avec photo → photo retirée', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const created = await AuthorService.create(
      { lastNames: 'Fictif', firstNames: 'Jean', affiliations: [{ institution: 'U' }] },
      null,
      await ImageService.authorPhotoVariants(await makeJpeg('remove-multipart.jpg'))
    )
    const prefix = created.photoKey!

    const response = await client
      .put(`/admin/authors/${created.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'U')
      .field('removePhoto', '1')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const saved = await Author.findOrFail(created.id)
    assert.isNull(saved.photoKey)
    fakeDisk.assertMissing(AuthorService.photoKeys(prefix))
  })

  test('JSON sans affiliations sur une fiche migrée → refus, affiliations conservées', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor()
    author.migrationKey = 'test-migration-key'
    await author.save()

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .json({ lastNames: 'Fictif', firstNames: 'Jean' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(
      flashedErrors(response.flashMessages()).affiliations,
      'authors.form.errors.affiliation_required'
    )
    await author.load('affiliations')
    assert.lengthOf(author.affiliations, 1)
  })

  test('photo + removePhoto ensemble → la nouvelle photo l’emporte', async ({ client, assert }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const author = await AuthorService.create(
      {
        lastNames: 'Fictif',
        firstNames: 'Jean',
        affiliations: [{ institution: 'Université Exemple' }],
      },
      null,
      await ImageService.authorPhotoVariants(await makeJpeg('both-old.jpg'))
    )
    const oldPrefix = author.photoKey!

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('removePhoto', '1')
      .file('photo', await makeJpeg('both.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await author.refresh()
    assert.match(author.photoKey!, ID_PREFIX(author.id))
    assert.notEqual(author.photoKey, oldPrefix)
    fakeDisk.assertExists(AuthorService.photoKeys(author.photoKey!))
    fakeDisk.assertMissing(AuthorService.photoKeys(oldPrefix))
  })

  test('texte renommé .jpg → erreur photo_type, aucune fiche, aucun objet', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/authors')
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', makeTextAsJpg('fake.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(flashedErrors(response.flashMessages()).photo, 'authors.form.errors.photo_type')
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
    assert.deepEqual(await storedKeys(), [])
  })

  test('extension refusée (.gif) → photo_type par la règle de fichier', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const path = join(TMP, 'anim.gif')
    writeFileSync(
      path,
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#0a0' } })
        .gif()
        .toBuffer()
    )

    const response = await client
      .post('/admin/authors')
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', path)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(flashedErrors(response.flashMessages()).photo, 'authors.form.errors.photo_type')
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
  })

  test('fichier > 5 Mo → photo_size, rien écrit', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor()
    const path = join(TMP, 'big.jpg')
    writeFileSync(path, Buffer.alloc(5 * 1024 * 1024 + 10, 1))

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Modifié')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', path)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(flashedErrors(response.flashMessages()).photo, 'authors.form.errors.photo_size')
    await author.refresh()
    assert.equal(author.lastNames, 'Fictif')
    assert.deepEqual(await storedKeys(), [])
  })

  test('fiche migrée sans affiliation modifiée en multipart avec photo → succès', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor('Fictif', [], { migrationKey: 'fictif-migre' })

    // Aucun champ `affiliations` : un tableau vide disparaît du FormData d'Inertia.
    const response = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .file('photo', await makeJpeg('migrated.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    await author.refresh()
    fakeDisk.assertExists(AuthorService.photoKeys(author.photoKey!))
  })

  test('fiche du panel sans affiliation en multipart → affiliation_required', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/authors')
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .file('photo', await makeJpeg('noaff.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(
      flashedErrors(response.flashMessages()).affiliations,
      'authors.form.errors.affiliation_required'
    )
    assert.deepEqual(await storedKeys(), [])
  })

  test('suppression d’une fiche avec photo → variantes supprimées ; refus → variantes gardées', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const upload = (id: string, name: string) =>
      client
        .put(`/admin/authors/${id}`)
        .field('lastNames', 'Fictif')
        .field('firstNames', 'Jean')
        .field('affiliations[0][institution]', 'Université Exemple')
        .file('photo', name)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)

    const gone = await createAuthor('Fictif')
    const kept = await createAuthor('Fictif')
    await upload(gone.id, await makeJpeg('gone.jpg'))
    await upload(kept.id, await makeJpeg('kept.jpg'))
    await gone.refresh()
    await kept.refresh()
    const production = await Production.create({
      title: 'Production fictive',
      status: 'draft',
      authorNames: [],
      tags: [],
      licenseStatus: 'member',
      createdById: null,
    })
    await production.related('authors').attach({ [kept.id]: { position: 1 } })

    const deleted = await client
      .delete(`/admin/authors/${gone.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    deleted.assertStatus(302)
    assert.isNull(await Author.find(gone.id))
    fakeDisk.assertMissing(AuthorService.photoKeys(gone.photoKey!))

    const refused = await client
      .delete(`/admin/authors/${kept.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    refused.assertStatus(302)
    assert.isNotNull(await Author.find(kept.id))
    fakeDisk.assertExists(AuthorService.photoKeys(kept.photoKey!))
  })

  test('GET edit → photoUrl signée (w384) ; GET liste → photoUrl par ligne (w128)', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const withPhoto = await createAuthor('Fictif')
    const without = await createAuthor('Exemple')
    await client
      .put(`/admin/authors/${withPhoto.id}`)
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', await makeJpeg('preview.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await withPhoto.refresh()

    const editResponse = await client.get(`/admin/authors/${withPhoto.id}/edit`).loginAs(admin)
    const edit = extractProps(editResponse.text())
    assert.isString(edit.author.photoUrl)
    assert.include(edit.author.photoUrl, `${withPhoto.photoKey}/w384.webp`)
    assert.isTrue(edit.author.hasPhoto)
    const withoutResponse = await client.get(`/admin/authors/${without.id}/edit`).loginAs(admin)
    const editWithout = extractProps(withoutResponse.text())
    assert.isNull(editWithout.author.photoUrl)

    const listResponse = await client.get('/admin/authors').loginAs(admin)
    const list = extractProps(listResponse.text())
    const rows = Object.fromEntries(
      list.authors.map((a: { id: string; photoUrl: string | null }) => [a.id, a.photoUrl])
    )
    assert.include(rows[withPhoto.id], `${withPhoto.photoKey}/w128.webp`)
    assert.isNull(rows[without.id])
  })

  test('échec R2 à la suppression de l’ancien préfixe → requête réussie quand même', async ({
    client,
    assert,
    cleanup,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const author = await createAuthor()
    const send = (name: string) =>
      client
        .put(`/admin/authors/${author.id}`)
        .field('lastNames', 'Fictif')
        .field('firstNames', 'Jean')
        .field('affiliations[0][institution]', 'Université Exemple')
        .file('photo', name)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
    await send(await makeJpeg('r2-first.jpg'))
    await author.refresh()
    const oldPrefix = author.photoKey!

    const original = FileStorageService.deleteObjects
    FileStorageService.deleteObjects = async (keys) =>
      keys.map((key) => ({ key, error: new Error('R2 unavailable') }))
    cleanup(() => {
      FileStorageService.deleteObjects = original
    })

    const response = await send(await makeJpeg('r2-second.jpg'))
    response.assertStatus(302)
    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.include(JSON.stringify(response.flashMessages()), 'authors.flash.saved')
    await author.refresh()
    assert.notEqual(author.photoKey, oldPrefix)
  })
})
