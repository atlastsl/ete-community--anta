import { test } from '@japa/runner'
import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import ace from '@adonisjs/core/services/ace'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import PosterService from '#services/poster_service'
import VideoFrameService from '#services/video_frame_service'
import ThumbnailsExtractVideoFrames from '../../../commands/thumbnails_extract_video_frames.js'
import { makeCorruptMp4, makeMp4 } from '../../video_fixtures.js'

// Story 11.3 — rattrapage des images extraites. R2 factice : les vidéos sont déposées sous
// leur `file_key`, la commande les relit par `disk.getStream`.

async function createProduction(): Promise<Production> {
  return Production.create({
    title: `Prod ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'published',
    authorNames: [],
    tags: [],
    licenseStatus: 'member',
    createdById: null,
  })
}

async function hostedFile(
  production: Production,
  bytes: Buffer,
  options: { mimeType?: string; posterKey?: string | null } = {}
): Promise<ProductionFile> {
  const fileKey = `productions/${production.id}/${Math.random().toString(36).slice(2)}.mp4`
  await drive.use('r2').put(fileKey, bytes)
  return ProductionFile.create({
    productionId: production.id,
    fileKey,
    originalName: 'video.mp4',
    mimeType: options.mimeType ?? 'video/mp4',
    sizeBytes: bytes.length,
    storageProvider: 'r2',
    posterKey: options.posterKey ?? null,
  })
}

async function posterObjects(): Promise<number> {
  const listing = await drive.use('r2').listAll('posters', { recursive: true })
  return Array.from(listing.objects).length
}

test.group('thumbnails:extract-video-frames (11.3)', (group) => {
  let video: Buffer
  let corrupt: Buffer

  group.setup(() => {
    video = readFileSync(makeMp4('catch-up-2s.mp4', 2))
    corrupt = readFileSync(makeCorruptMp4('catch-up-corrupt.mp4'))
  })

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    ace.ui.switchMode('raw')
    return async () => {
      ace.ui.switchMode('normal')
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('--dry-run : liste les vidéos sans poster, n’écrit rien (ni base ni R2)', async ({
    assert,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    const target = await hostedFile(production, video)
    await hostedFile(production, video, { posterKey: `posters/x/${'a'.repeat(20)}` })
    await hostedFile(production, Buffer.from('%PDF-1.4'), { mimeType: 'application/pdf' })

    const command = await ace.create(ThumbnailsExtractVideoFrames, ['--dry-run'])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/1 vidéo\(s\) sans image extraite/)
    command.assertLogMatches(new RegExp(target.id))
    command.assertLogMatches(/Simulation : aucune écriture/)
    await target.refresh()
    assert.isNull(target.posterKey)
    assert.equal(await posterObjects(), 0)
  }).timeout(30_000)

  test('exécution réelle : poster créé, rapport ; 2e exécution : rien à traiter', async ({
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const production = await createProduction()
    const target = await hostedFile(production, video)

    const command = await ace.create(ThumbnailsExtractVideoFrames, [])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/Traitées : 1 · déjà traitées : 0 · échecs : 0/)
    await target.refresh()
    assert.isString(target.posterKey)
    assert.isTrue(target.posterKey!.startsWith(`posters/${target.id}/`))
    for (const key of PosterService.keys(target.posterKey!)) fakeDisk.assertExists(key)

    const again = await ace.create(ThumbnailsExtractVideoFrames, [])
    await again.exec()
    again.assertSucceeded()
    again.assertLogMatches(/0 vidéo\(s\) sans image extraite/)
    assert.equal(await posterObjects(), 3)
  }).timeout(30_000)

  test('échecs comptés (corrompue, objet absent), les autres traitées, code 1', async ({
    assert,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    const ok = await hostedFile(production, video)
    const broken = await hostedFile(production, corrupt)
    const missing = await hostedFile(production, video)
    await drive.use('r2').delete(missing.fileKey)
    const tempDirs = () => readdirSync(tmpdir()).filter((name) => name.startsWith('anta-video-'))
    const before = tempDirs()

    const command = await ace.create(ThumbnailsExtractVideoFrames, [])
    await command.exec()

    assert.equal(command.exitCode, 1)
    command.assertLogMatches(/Traitées : 1 · déjà traitées : 0 · échecs : 2/)
    await ok.refresh()
    await broken.refresh()
    await missing.refresh()
    assert.isString(ok.posterKey)
    assert.isNull(broken.posterKey)
    assert.isNull(missing.posterKey)
    // Fichiers temporaires toujours supprimés, succès comme échecs.
    assert.deepEqual(tempDirs(), before)
  }).timeout(30_000)

  test('rempli entre-temps (attach refusé, poster_key déjà posé) → « déjà traité », code 0', async ({
    assert,
  }) => {
    drive.fake('r2')
    const production = await createProduction()
    const target = await hostedFile(production, video)
    const concurrent = `posters/${target.id}/${'b'.repeat(20)}`
    const original = VideoFrameService.posterVariants
    // Un téléversement ou une autre exécution écrit le poster pendant l'extraction.
    VideoFrameService.posterVariants = async (path) => {
      const variants = await original.call(VideoFrameService, path)
      await ProductionFile.query().where('id', target.id).update({ poster_key: concurrent })
      return variants
    }
    const tempDirs = () => readdirSync(tmpdir()).filter((name) => name.startsWith('anta-video-'))
    const before = tempDirs()
    try {
      const command = await ace.create(ThumbnailsExtractVideoFrames, [])
      await command.exec()
      command.assertSucceeded()
      command.assertLogMatches(/déjà traité/)
      command.assertLogMatches(/Traitées : 0 · déjà traitées : 1 · échecs : 0/)
    } finally {
      VideoFrameService.posterVariants = original
    }
    await target.refresh()
    assert.equal(target.posterKey, concurrent)
    // Les variantes envoyées par l'exécution perdante sont supprimées.
    assert.equal(await posterObjects(), 0)
    assert.deepEqual(tempDirs(), before)
  }).timeout(30_000)
})
