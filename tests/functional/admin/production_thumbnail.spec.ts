import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import Production from '#models/production'
import FileStorageService from '#services/file_storage_service'
import ImageService from '#services/image_service'
import ThumbnailService from '#services/thumbnail_service'

// Story 11.1 — vignette d'une production (P2.1, P2.5, P2.6). Images générées par sharp,
// jamais de vraie photo (dépôt public).

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
    authorNames: [],
    tags: [],
    licenseStatus: 'member',
    createdById: null,
  })
}

function flashedErrors(flash: Record<string, any>): Record<string, string> {
  const raw = (flash.errors ?? flash.inputErrorsBag ?? {}) as Record<string, string | string[]>
  return Object.fromEntries(
    Object.entries(raw).map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
  )
}

const TMP = join(tmpdir(), 'anta-test-thumbnails')
mkdirSync(TMP, { recursive: true })

/** JPEG 4:3 généré avec EXIF + GPS. */
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

async function storedKeys(): Promise<string[]> {
  const { objects } = await drive.use('r2').listAll('thumbnails', { recursive: true })
  return Array.from(objects)
    .filter((o) => o.isFile)
    .map((o) => (o as { key: string }).key)
    .sort()
}

async function thumbnailLogs(productionId: string) {
  return AdminActivityLog.query()
    .where('resourceId', productionId)
    .where('actionType', 'update')
    .orderBy('createdAt', 'asc')
}

const PREFIX = (id: string) => new RegExp(`^thumbnails/${id}/[A-Za-z0-9_-]{20}$`)
const BACK = '/admin/featured'

test.group('Admin production thumbnail | migration', () => {
  test('thumbnail_key et poster_key : varchar 255, NULL, sans défaut', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default
         FROM information_schema.columns
        WHERE (table_name = 'productions' AND column_name = 'thumbnail_key')
           OR (table_name = 'production_files' AND column_name = 'poster_key')
        ORDER BY table_name`
    )
    assert.deepEqual(
      result.rows.map((r: any) => [
        r.table_name,
        r.column_name,
        r.data_type,
        r.character_maximum_length,
        r.is_nullable,
        r.column_default,
      ]),
      [
        ['production_files', 'poster_key', 'character varying', 255, 'YES', null],
        ['productions', 'thumbnail_key', 'character varying', 255, 'YES', null],
      ]
    )
  })
})

test.group('Admin production thumbnail | pose, remplacement, retrait', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  const upload = (client: any, admin: AdminUser, productionId: string, path: string) =>
    client
      .post(`/admin/productions/${productionId}/thumbnail`)
      .header('referer', BACK)
      .file('thumbnail', path)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

  test('pose → 3 variantes 16:9 sans EXIF, thumbnail_key = préfixe, journal set', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await upload(client, admin, production.id, await makeJpeg('set.jpg'))

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    // Pas de flash de succès : le toast vient du champ (sa propre visite).
    assert.notProperty(response.flashMessages(), 'success')
    await production.refresh()
    assert.match(production.thumbnailKey!, PREFIX(production.id))
    const keys = ThumbnailService.keys(production.thumbnailKey!)
    assert.deepEqual(
      keys.map((key) => key.split('/').pop()),
      ['w400.webp', 'w800.webp', 'w1600.webp']
    )
    fakeDisk.assertExists(keys)
    const expected: Record<string, [number, number]> = {
      'w400.webp': [400, 225],
      'w800.webp': [800, 450],
      'w1600.webp': [1600, 900],
    }
    for (const key of keys) {
      const meta = await sharp(Buffer.from(await drive.use('r2').getBytes(key))).metadata()
      assert.deepEqual([meta.width, meta.height], expected[key.split('/').pop()!])
      assert.equal(meta.format, 'webp')
      assert.isUndefined(meta.exif)
    }
    const logs = await thumbnailLogs(production.id)
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].resourceType, 'production')
    assert.equal(logs[0].adminUserId, admin.id)
    assert.deepEqual(logs[0].metadata, { field: 'thumbnail', op: 'set' })
  })

  test('remplacement → nouveau préfixe, ancien préfixe supprimé', async ({ client, assert }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await upload(client, admin, production.id, await makeJpeg('first.jpg'))
    await production.refresh()
    const oldPrefix = production.thumbnailKey!

    const response = await upload(
      client,
      admin,
      production.id,
      await makeJpeg('second.jpg', { r: 20, g: 20, b: 160 })
    )

    response.assertStatus(302)
    await production.refresh()
    assert.notEqual(production.thumbnailKey, oldPrefix)
    assert.match(production.thumbnailKey!, PREFIX(production.id))
    fakeDisk.assertExists(ThumbnailService.keys(production.thumbnailKey!))
    fakeDisk.assertMissing(ThumbnailService.keys(oldPrefix))
    assert.deepEqual(await storedKeys(), ThumbnailService.keys(production.thumbnailKey!).sort())
    const logs = await thumbnailLogs(production.id)
    assert.deepEqual(
      logs.map((log) => log.metadata),
      [
        { field: 'thumbnail', op: 'set' },
        { field: 'thumbnail', op: 'set' },
      ]
    )
  })

  test('échec de suppression de l’ancien préfixe → remplacement réussi quand même', async ({
    client,
    assert,
    cleanup,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await upload(client, admin, production.id, await makeJpeg('r2-first.jpg'))
    await production.refresh()
    const oldPrefix = production.thumbnailKey!

    const original = FileStorageService.deleteObjects
    FileStorageService.deleteObjects = async (keys) =>
      keys.map((key) => ({ key, error: new Error('R2 unavailable') }))
    cleanup(() => {
      FileStorageService.deleteObjects = original
    })

    const response = await upload(client, admin, production.id, await makeJpeg('r2-second.jpg'))
    response.assertStatus(302)
    // Pas de flash de succès : le toast vient du champ (sa propre visite).
    assert.notProperty(response.flashMessages(), 'success')
    await production.refresh()
    assert.notEqual(production.thumbnailKey, oldPrefix)
  })

  test('retrait → thumbnail_key NULL, variantes supprimées, journal remove', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('remove.jpg'))
    )
    await production.refresh()
    const prefix = production.thumbnailKey!
    fakeDisk.assertExists(ThumbnailService.keys(prefix))

    const response = await client
      .delete(`/admin/productions/${production.id}/thumbnail`)
      .header('referer', BACK)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.notProperty(response.flashMessages(), 'success')
    assert.notProperty(flashedErrors(response.flashMessages()), 'thumbnail')
    await production.refresh()
    assert.isNull(production.thumbnailKey)
    fakeDisk.assertMissing(ThumbnailService.keys(prefix))
    const logs = await thumbnailLogs(production.id)
    assert.deepEqual(
      logs.map((log) => log.metadata),
      [{ field: 'thumbnail', op: 'remove' }]
    )
  })

  test('retrait sans vignette → aucun changement, aucun journal', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .delete(`/admin/productions/${production.id}/thumbnail`)
      .header('referer', BACK)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.notProperty(response.flashMessages(), 'success')
    assert.lengthOf(await thumbnailLogs(production.id), 0)
  })

  test('suppression de la production → préfixe de la vignette supprimé', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('delete.jpg'))
    )
    await production.refresh()
    const prefix = production.thumbnailKey!

    const response = await client
      .delete(`/admin/productions/${production.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.isNull(await Production.find(production.id))
    fakeDisk.assertMissing(ThumbnailService.keys(prefix))
    assert.deepEqual(await storedKeys(), [])
  })

  test('aperçu admin : URL signée de w800, null sans vignette', async ({ assert }) => {
    drive.fake('r2')
    const production = await createProduction()
    assert.isNull(await ThumbnailService.signedUrl(null))
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('preview.jpg'))
    )
    const url = await ThumbnailService.signedUrl(production.thumbnailKey)
    assert.isString(url)
    assert.include(url!, `${production.thumbnailKey}/w800.webp`)
  })
})

test.group('Admin production thumbnail | refus', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  async function expectRefused(
    client: any,
    assert: any,
    attach: (request: any) => any,
    message: string
  ) {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    const response = await attach(
      client
        .post(`/admin/productions/${production.id}/thumbnail`)
        .header('referer', BACK)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
    )
    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.equal(flashedErrors(response.flashMessages()).thumbnail, message)
    await production.refresh()
    assert.isNull(production.thumbnailKey)
    assert.deepEqual(await storedKeys(), [])
    assert.lengthOf(await thumbnailLogs(production.id), 0)
  }

  test('aucun fichier → thumbnail.errors.no_file', async ({ client, assert }) => {
    await expectRefused(client, assert, (r) => r.field('other', '1'), 'thumbnail.errors.no_file')
  })

  test('texte renommé .jpg → thumbnail.errors.invalid_type', async ({ client, assert }) => {
    const path = join(TMP, 'fake.jpg')
    writeFileSync(path, 'ceci est du texte brut, pas une image', 'utf-8')
    await expectRefused(
      client,
      assert,
      (r) => r.file('thumbnail', path),
      'thumbnail.errors.invalid_type'
    )
  })

  test('GIF → thumbnail.errors.invalid_type (règle de fichier)', async ({ client, assert }) => {
    const path = join(TMP, 'anim.gif')
    writeFileSync(
      path,
      await sharp({ create: { width: 10, height: 10, channels: 3, background: '#0a0' } })
        .gif()
        .toBuffer()
    )
    await expectRefused(
      client,
      assert,
      (r) => r.file('thumbnail', path),
      'thumbnail.errors.invalid_type'
    )
  })

  test('> 5 Mo → thumbnail.errors.too_large', async ({ client, assert }) => {
    const path = join(TMP, 'big.jpg')
    writeFileSync(path, Buffer.alloc(5 * 1024 * 1024 + 10, 1))
    await expectRefused(
      client,
      assert,
      (r) => r.file('thumbnail', path),
      'thumbnail.errors.too_large'
    )
  })

  test('> 40 Mpx → thumbnail.errors.dimensions', async ({ client, assert }) => {
    const path = join(TMP, 'huge.png')
    writeFileSync(
      path,
      await sharp({ create: { width: 7000, height: 6000, channels: 3, background: '#a00' } })
        .png()
        .toBuffer()
    )
    await expectRefused(
      client,
      assert,
      (r) => r.file('thumbnail', path),
      'thumbnail.errors.dimensions'
    )
  })

  test('production inconnue ou identifiant mal formé → retour avec not_found (pas de page 404)', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const path = await makeJpeg('unknown.jpg')
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const post = await client
        .post(`/admin/productions/${id}/thumbnail`)
        .header('referer', BACK)
        .file('thumbnail', path)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      post.assertStatus(302)
      post.assertHeader('location', BACK)
      assert.equal(flashedErrors(post.flashMessages()).thumbnail, 'thumbnail.errors.not_found')
      const del = await client
        .delete(`/admin/productions/${id}/thumbnail`)
        .header('referer', BACK)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      del.assertStatus(302)
      del.assertHeader('location', BACK)
      assert.equal(flashedErrors(del.flashMessages()).thumbnail, 'thumbnail.errors.not_found')
    }
    assert.deepEqual(await storedKeys(), [])
  })

  test('non authentifié → redirigé vers la connexion, rien écrit', async ({ client, assert }) => {
    drive.fake('r2')
    const production = await createProduction()
    const response = await client
      .post(`/admin/productions/${production.id}/thumbnail`)
      .file('thumbnail', await makeJpeg('anon.jpg'))
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    assert.include(response.header('location'), '/admin/login')
    await production.refresh()
    assert.isNull(production.thumbnailKey)
  })
})

test.group('Admin production thumbnail | pannes de stockage', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('R2 indisponible à l’envoi → retour avec storage, clé inchangée, aucun objet', async ({
    client,
    assert,
    cleanup,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('kept.jpg'))
    )
    const kept = production.thumbnailKey!

    const original = FileStorageService.putObject
    FileStorageService.putObject = async () => {
      throw new Error('R2 unavailable')
    }
    cleanup(() => {
      FileStorageService.putObject = original
    })

    const response = await client
      .post(`/admin/productions/${production.id}/thumbnail`)
      .header('referer', BACK)
      .file('thumbnail', await makeJpeg('down.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.equal(flashedErrors(response.flashMessages()).thumbnail, 'thumbnail.errors.storage')
    await production.refresh()
    assert.equal(production.thumbnailKey, kept)
    assert.deepEqual(await storedKeys(), ThumbnailService.keys(kept).sort())
    assert.lengthOf(await thumbnailLogs(production.id), 0)
  })

  test('base indisponible au retrait → retour avec storage, vignette conservée', async ({
    client,
    assert,
    cleanup,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('db-remove.jpg'))
    )
    const kept = production.thumbnailKey!

    const original = db.transaction
    db.transaction = (async () => {
      throw new Error('database unavailable')
    }) as unknown as typeof db.transaction
    cleanup(() => {
      db.transaction = original
    })

    const response = await client
      .delete(`/admin/productions/${production.id}/thumbnail`)
      .header('referer', BACK)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    db.transaction = original

    response.assertStatus(302)
    assert.equal(flashedErrors(response.flashMessages()).thumbnail, 'thumbnail.errors.storage')
    await production.refresh()
    assert.equal(production.thumbnailKey, kept)
    fakeDisk.assertExists(ThumbnailService.keys(kept))
  })

  test('écriture en base en échec après l’envoi → variantes neuves supprimées, erreur remontée, clé inchangée', async ({
    assert,
    cleanup,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    await ThumbnailService.set(
      production,
      await ImageService.thumbnailVariants(await makeJpeg('db-kept.jpg'))
    )
    const kept = production.thumbnailKey!
    const variants = await ImageService.thumbnailVariants(await makeJpeg('db-new.jpg'))

    const original = db.transaction
    db.transaction = (async () => {
      throw new Error('database unavailable')
    }) as unknown as typeof db.transaction
    cleanup(() => {
      db.transaction = original
    })

    await assert.rejects(() => ThumbnailService.set(production, variants), 'database unavailable')
    db.transaction = original

    assert.equal(production.thumbnailKey, kept)
    await production.refresh()
    assert.equal(production.thumbnailKey, kept)
    // Seules les variantes de la vignette conservée restent : les neuves ont été supprimées.
    assert.deepEqual(await storedKeys(), ThumbnailService.keys(kept).sort())
  })

  test('échec R2 partiel (2e variante) → variantes déjà envoyées supprimées, clé inchangée', async ({
    assert,
    cleanup,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    const variants = await ImageService.thumbnailVariants(await makeJpeg('partial.jpg'))

    const original = FileStorageService.putObject
    FileStorageService.putObject = async (key, body, contentType) => {
      if (key.endsWith('/w800.webp')) throw new Error('R2 unavailable')
      return original.call(FileStorageService, key, body, contentType)
    }
    cleanup(() => {
      FileStorageService.putObject = original
    })

    await assert.rejects(() => ThumbnailService.set(production, variants), 'R2 unavailable')
    await production.refresh()
    assert.isNull(production.thumbnailKey)
    assert.deepEqual(await storedKeys(), [])
  })
})
