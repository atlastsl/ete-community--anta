import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import FileStorageService from '#services/file_storage_service'
import PosterService from '#services/poster_service'
import ProductionService from '#services/production_service'
import ThumbnailService from '#services/thumbnail_service'
import VideoFrameService from '#services/video_frame_service'
import { makeAudioOnlyMp4, makeCorruptMp4, makeMp4 } from '../../video_fixtures.js'

// Story 11.3 : image extraite au téléversement d'une vidéo hébergée. Vidéos générées par
// ffmpeg (aucun binaire commité), R2 factice.

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

const POSTER_PREFIX = /^posters\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{20}$/

function makePdf(name: string): string {
  const dir = join(tmpdir(), 'anta-test-uploads')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1'))
  return path
}

test.group('Admin production files | image extraite (11.3)', (group) => {
  let twoSeconds: string
  let short: string

  group.setup(() => {
    twoSeconds = makeMp4('upload-2s.mp4', 2)
    short = makeMp4('upload-short.mp4', 0.4)
  })

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('MP4 de 2 s → 3 variantes sous posters/<fileId>/<token>, poster_key écrit', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', twoSeconds)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertFlashMessage('success', 'productions.files.uploaded')
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.equal(record.mimeType, 'video/mp4')
    assert.match(record.posterKey ?? '', POSTER_PREFIX)
    assert.isTrue(record.posterKey!.startsWith(`posters/${record.id}/`))
    fakeDisk.assertExists(record.fileKey)
    for (const key of PosterService.keys(record.posterKey!)) fakeDisk.assertExists(key)
  }).timeout(30_000)

  test('vidéo < 1 s → poster extrait à t = 0', async ({ client, assert }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', short)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.match(record.posterKey ?? '', POSTER_PREFIX)
    for (const key of PosterService.keys(record.posterKey!)) fakeDisk.assertExists(key)
  }).timeout(30_000)

  test('fichier corrompu → téléversement OK, poster_key NULL, aucun poster', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makeCorruptMp4('upload-corrupt.mp4'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertFlashMessage('success', 'productions.files.uploaded')
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.equal(record.mimeType, 'video/mp4')
    assert.isNull(record.posterKey)
    fakeDisk.assertExists(record.fileKey)
    const posters = await drive.use('r2').listAll('posters', { recursive: true })
    assert.lengthOf(Array.from(posters.objects), 0)
  }).timeout(30_000)

  test('MP4 audio seul → téléversement OK, poster_key NULL, aucun poster', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', makeAudioOnlyMp4('upload-audio-only.mp4'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertFlashMessage('success', 'productions.files.uploaded')
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.isNull(record.posterKey)
    fakeDisk.assertExists(record.fileKey)
    const posters = await drive.use('r2').listAll('posters', { recursive: true })
    assert.lengthOf(Array.from(posters.objects), 0)
  }).timeout(30_000)

  test('course : poster enregistré après la lecture du fichier, avant le DELETE → supprimé quand même', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    const file = await ProductionFile.create({
      productionId: production.id,
      fileKey: `productions/${production.id}/race.mp4`,
      originalName: 'race.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      storageProvider: 'r2',
    })
    const lateKey = `posters/${file.id}/${'c'.repeat(20)}`
    for (const key of PosterService.keys(lateKey)) await drive.use('r2').put(key, Buffer.from(key))
    // La suppression R2 du fichier a lieu entre la lecture de la ligne et le DELETE : le
    // rattrapage écrit le poster pile à ce moment.
    const original = FileStorageService.delete
    FileStorageService.delete = async (key) => {
      await ProductionFile.query().where('id', file.id).update({ poster_key: lateKey })
      return original.call(FileStorageService, key)
    }
    try {
      const response = await client
        .delete(`/admin/productions/${production.id}/files/${file.id}`)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(302)
    } finally {
      FileStorageService.delete = original
    }
    assert.isNull(await ProductionFile.find(file.id))
    for (const key of PosterService.keys(lateKey)) fakeDisk.assertMissing(key)
  })

  test('course à la suppression de la production : poster et vignette tardifs supprimés', async ({
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    const file = await ProductionFile.create({
      productionId: production.id,
      fileKey: `productions/${production.id}/race.mp4`,
      originalName: 'race.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      storageProvider: 'r2',
    })
    const lateKey = `posters/${file.id}/${'d'.repeat(20)}`
    const lateThumbnail = `thumbnails/${production.id}/${'e'.repeat(20)}`
    for (const key of [...PosterService.keys(lateKey), ...ThumbnailService.keys(lateThumbnail)]) {
      await drive.use('r2').put(key, Buffer.from(key))
    }
    const original = FileStorageService.delete
    FileStorageService.delete = async (key) => {
      await ProductionFile.query().where('id', file.id).update({ poster_key: lateKey })
      await Production.query().where('id', production.id).update({ thumbnail_key: lateThumbnail })
      return original.call(FileStorageService, key)
    }
    try {
      await ProductionService.delete(production, admin.id)
    } finally {
      FileStorageService.delete = original
    }
    assert.isNull(await Production.find(production.id))
    for (const key of [...PosterService.keys(lateKey), ...ThumbnailService.keys(lateThumbnail)]) {
      fakeDisk.assertMissing(key)
    }
  })

  test('ffmpeg absent → téléversement OK, poster_key NULL', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    VideoFrameService.binary = 'ffmpeg-absent-anta'
    try {
      const response = await client
        .post(`/admin/productions/${production.id}/files`)
        .file('file', twoSeconds)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(302)
    } finally {
      VideoFrameService.binary = 'ffmpeg'
    }
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.isNull(record.posterKey)
  }).timeout(30_000)

  test('échec R2 du poster → téléversement OK, poster_key NULL, variantes envoyées supprimées', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    const original = FileStorageService.putObject
    let calls = 0
    FileStorageService.putObject = async (key, body, contentType) => {
      calls++
      if (key.endsWith('/w800.webp')) throw new Error('R2 down')
      return original.call(FileStorageService, key, body, contentType)
    }
    try {
      const response = await client
        .post(`/admin/productions/${production.id}/files`)
        .file('file', twoSeconds)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(302)
      response.assertFlashMessage('success', 'productions.files.uploaded')
    } finally {
      FileStorageService.putObject = original
    }
    assert.equal(calls, 3)
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.isNull(record.posterKey)
    fakeDisk.assertExists(record.fileKey)
    const posters = await drive.use('r2').listAll('posters', { recursive: true })
    assert.lengthOf(Array.from(posters.objects), 0)
  }).timeout(30_000)

  test('PDF : ffmpeg jamais lancé, poster_key NULL', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    const original = VideoFrameService.posterVariants
    let called = false
    VideoFrameService.posterVariants = async (path) => {
      called = true
      return original.call(VideoFrameService, path)
    }
    try {
      const response = await client
        .post(`/admin/productions/${production.id}/files`)
        .file('file', makePdf('poster-none.pdf'))
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(302)
    } finally {
      VideoFrameService.posterVariants = original
    }
    assert.isFalse(called)
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.isNull(record.posterKey)
  })

  test('suppression du fichier vidéo → variantes du poster supprimées', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', twoSeconds)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    const posterKey = record.posterKey!
    assert.isString(posterKey)

    const response = await client
      .delete(`/admin/productions/${production.id}/files/${record.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.isNull(await ProductionFile.find(record.id))
    fakeDisk.assertMissing(record.fileKey)
    for (const key of PosterService.keys(posterKey)) fakeDisk.assertMissing(key)
  }).timeout(30_000)

  test('suppression de la production → posters de ses vidéos supprimés', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction()
    await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', twoSeconds)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    const record = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    const posterKey = record.posterKey!
    assert.isString(posterKey)

    await ProductionService.delete(production, admin.id)

    for (const key of PosterService.keys(posterKey)) fakeDisk.assertMissing(key)
  }).timeout(30_000)
})

test.group('PosterService (11.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  async function videoFile(production: Production, posterKey: string | null = null) {
    return ProductionFile.create({
      productionId: production.id,
      fileKey: `productions/${production.id}/video-${Math.random()}.mp4`,
      originalName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      storageProvider: 'r2',
      posterKey,
    })
  }

  const variants = () =>
    ['w400.webp', 'w800.webp', 'w1600.webp'].map((name) => ({
      name,
      body: Buffer.from(name),
      contentType: 'image/webp' as const,
    }))

  test('attach : écrit poster_key seulement s’il est NULL (idempotent, sans orphelin)', async ({
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const production = await createProduction()
    const file = await videoFile(production)

    const first = await PosterService.attach(file.id, variants())
    assert.match(first ?? '', POSTER_PREFIX)
    await file.refresh()
    assert.equal(file.posterKey, first)

    // Déjà pourvu : rien n'est écrasé, les variantes envoyées sont supprimées.
    const second = await PosterService.attach(file.id, variants())
    assert.isNull(second)
    await file.refresh()
    assert.equal(file.posterKey, first)
    const listing = await drive.use('r2').listAll('posters', { recursive: true })
    const objects = Array.from(listing.objects)
    assert.lengthOf(objects, 3)
    for (const key of PosterService.keys(first!)) fakeDisk.assertExists(key)
  })

  test('attach : fichier supprimé entre-temps → null, aucun orphelin', async ({ assert }) => {
    drive.fake('r2')
    const production = await createProduction()
    const file = await videoFile(production)
    await file.delete()

    assert.isNull(await PosterService.attach(file.id, variants()))
    const listing = await drive.use('r2').listAll('posters', { recursive: true })
    const objects = Array.from(listing.objects)
    assert.lengthOf(objects, 0)
  })

  test('displayed : premier MP4 pourvu d’un poster par ordre de création', async ({ assert }) => {
    const { DateTime } = await import('luxon')
    const at = (minutes: number) => DateTime.fromISO('2026-01-01T00:00:00Z').plus({ minutes })
    const files = [
      { id: 'b', mimeType: 'video/mp4', posterKey: 'posters/b/x', createdAt: at(2) },
      { id: 'a', mimeType: 'video/mp4', posterKey: null, createdAt: at(0) },
      { id: 'p', mimeType: 'application/pdf', posterKey: 'posters/p/x', createdAt: at(-1) },
      { id: 'c', mimeType: 'video/mp4', posterKey: 'posters/c/x', createdAt: at(1) },
      { id: 'd', mimeType: 'video/mp4', posterKey: 'posters/d/x', createdAt: at(1) },
    ]
    assert.equal(PosterService.displayed(files)?.id, 'c')
    assert.isNull(PosterService.displayed([files[1], files[2]]))
    assert.isNull(PosterService.displayed([]))
  })
})
