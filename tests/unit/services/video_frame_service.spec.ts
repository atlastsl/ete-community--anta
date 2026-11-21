import { test } from '@japa/runner'
import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import VideoFrameService, { VideoFrameError } from '#services/video_frame_service'
import {
  makeColorSwitchMp4,
  makeCorruptMp4,
  makeMp4,
  makeSleepingBinary,
} from '../../video_fixtures.js'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Temporary folders of the service left in the system temp dir. */
/** Dominant channel of a frame: the red → blue video tells t = 0 from t = 1 s. */
async function dominant(frame: Buffer): Promise<'red' | 'blue' | 'other'> {
  const { channels } = await sharp(frame).stats()
  const [r, , b] = channels.map((channel) => channel.mean)
  if (r > 150 && b < 100) return 'red'
  if (b > 150 && r < 100) return 'blue'
  return 'other'
}

const frameDirs = () => readdirSync(tmpdir()).filter((name) => name.startsWith('anta-frame-'))

test.group('VideoFrameService (11.3)', (group) => {
  let twoSeconds: string
  let short: string
  let corrupt: string
  let colorSwitch: string
  let colorShort: string
  let before: string[]

  group.setup(() => {
    twoSeconds = makeMp4('frame-2s.mp4', 2)
    short = makeMp4('frame-short.mp4', 0.4)
    corrupt = makeCorruptMp4('frame-corrupt.mp4')
    colorSwitch = makeColorSwitchMp4('frame-color-2s.mp4')
    colorShort = makeColorSwitchMp4('frame-color-short.mp4', 0.5)
  })

  group.each.setup(() => {
    before = frameDirs()
    return () => {
      VideoFrameService.binary = 'ffmpeg'
      VideoFrameService.timeoutMs = 20_000
    }
  })

  test('image à t = 1 s en PNG, dossier temporaire supprimé', async ({ assert }) => {
    const frame = await VideoFrameService.extract(twoSeconds)
    assert.isTrue(frame.subarray(0, 8).equals(PNG))
    const meta = await sharp(frame).metadata()
    assert.equal(meta.width, 320)
    assert.equal(meta.height, 180)
    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)

  test('l’image est bien celle de t = 1 s (bleue), pas celle de t = 0 (rouge)', async ({
    assert,
  }) => {
    assert.equal(await dominant(await VideoFrameService.extract(colorSwitch)), 'blue')
    // Repli < 1 s : l'image de t = 0, rouge.
    assert.equal(await dominant(await VideoFrameService.extract(colorShort)), 'red')
  }).timeout(30_000)

  test('délai dépassé : processus réellement tué (SIGKILL), sans attendre sa fin', async ({
    assert,
  }) => {
    VideoFrameService.binary = makeSleepingBinary('ffmpeg-sleeping.sh')
    VideoFrameService.timeoutMs = 500
    const started = Date.now()
    const error = await VideoFrameService.extract(twoSeconds).catch((err: unknown) => err)
    assert.instanceOf(error, VideoFrameError)
    assert.equal(((error as VideoFrameError).cause as { signal?: string }).signal, 'SIGKILL')
    assert.isBelow(Date.now() - started, 5_000)
    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)

  test('vidéo < 1 s : repli sur t = 0', async ({ assert }) => {
    const frame = await VideoFrameService.extract(short)
    assert.isTrue(frame.subarray(0, 8).equals(PNG))
    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)

  test('fichier corrompu : VideoFrameError, dossier supprimé', async ({ assert }) => {
    await assert.rejects(() => VideoFrameService.extract(corrupt), VideoFrameError)
    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)

  test('un chemin qui ressemble à une option ou un protocole reste un fichier local', async ({
    assert,
  }) => {
    await assert.rejects(() => VideoFrameService.extract('-version'), VideoFrameError)
    await assert.rejects(
      () => VideoFrameService.extract('http://127.0.0.1:1/video.mp4'),
      VideoFrameError
    )
    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)

  test('posterVariants : 3 variantes 16:9 WebP', async ({ assert }) => {
    const variants = await VideoFrameService.posterVariants(twoSeconds)
    assert.isNotNull(variants)
    assert.deepEqual(
      variants!.map((variant) => variant.name),
      ['w400.webp', 'w800.webp', 'w1600.webp']
    )
    const meta = await sharp(variants![0].body).metadata()
    assert.equal(meta.format, 'webp')
    assert.equal(meta.width, 400)
    assert.equal(meta.height, 225)
  }).timeout(30_000)

  test('posterVariants ne lève jamais : corrompu, binaire absent, délai dépassé → null', async ({
    assert,
  }) => {
    assert.isNull(await VideoFrameService.posterVariants(corrupt))

    VideoFrameService.binary = 'ffmpeg-absent-anta'
    assert.isNull(await VideoFrameService.posterVariants(twoSeconds))

    VideoFrameService.binary = 'ffmpeg'
    VideoFrameService.timeoutMs = 1
    assert.isNull(await VideoFrameService.posterVariants(twoSeconds))

    assert.deepEqual(frameDirs(), before)
  }).timeout(30_000)
})
