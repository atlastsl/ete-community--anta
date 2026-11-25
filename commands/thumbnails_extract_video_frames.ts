import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `thumbnails:extract-video-frames` (Story 11.3, P2.5): catch-up of the frames of the videos
 * hosted before ffmpeg was available. Processes every `video/mp4` file without `poster_key`
 * (creation order): the R2 object is streamed to a temporary file (ffmpeg never opens the
 * network, D-11.3-1), its frame becomes the poster variants, `poster_key` is written only if
 * still NULL. Idempotent: a second run finds nothing left. `--dry-run` lists the files and
 * writes nothing (neither database nor R2).
 *
 * Manual gate: the real run writes to the shared database and to R2 — once, on the dev VPS,
 * with the product owner's explicit approval, `--dry-run` first.
 *
 * A file filled meanwhile (upload, concurrent run) is reported as already processed, not as a
 * failure. Exit code 1 when at least one file failed (the full report is printed first).
 */
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

export default class ThumbnailsExtractVideoFrames extends BaseCommand {
  static commandName = 'thumbnails:extract-video-frames'
  static description =
    'Extrait l’image des vidéos hébergées sans poster (rattrapage, --dry-run pour simuler)'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Simuler : liste les vidéos à traiter, aucune écriture' })
  declare dryRun: boolean

  async run() {
    // Lazy imports: Ace loads every command module for its metadata before the app boots.
    const { default: ProductionFile } = await import('#models/production_file')
    const { default: drive } = await import('@adonisjs/drive/services/main')
    const { default: VideoFrameService } = await import('#services/video_frame_service')
    const { default: PosterService } = await import('#services/poster_service')

    const files = await ProductionFile.query()
      .where('mime_type', 'video/mp4')
      .whereNull('poster_key')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    this.logger.info(`${files.length} vidéo(s) sans image extraite`)
    if (this.dryRun) {
      for (const file of files) this.logger.info(`à traiter : ${file.id} (${file.fileKey})`)
      this.logger.info('Simulation : aucune écriture (ni base, ni R2).')
      return
    }

    let processed = 0
    let skipped = 0
    let failed = 0
    for (const file of files) {
      let dir: string | null = null
      try {
        dir = await mkdtemp(join(tmpdir(), 'anta-video-'))
        const input = join(dir, 'video.mp4')
        let source: NodeJS.ReadableStream
        try {
          source = await drive.use('r2').getStream(file.fileKey)
        } catch (error) {
          failed++
          this.logger.error(`${file.id} : lecture R2 impossible (${message(error)})`)
          continue
        }
        await pipeline(source, createWriteStream(input))
        const variants = await VideoFrameService.posterVariants(input)
        const prefix = variants ? await PosterService.attach(file.id, variants) : null
        if (prefix) {
          processed++
          this.logger.success(`${file.id} : ${prefix}`)
          continue
        }
        // Rempli entre-temps (téléversement, autre exécution) : pas un échec.
        await file.refresh()
        if (file.posterKey) {
          skipped++
          this.logger.info(`${file.id} : déjà traité (${file.posterKey})`)
        } else {
          failed++
          this.logger.error(`${file.id} : échec de l’extraction ou de l’enregistrement`)
        }
      } catch (error) {
        // Dossier temporaire, copie (flux R2 ou disque), fichier supprimé entre-temps.
        failed++
        this.logger.error(`${file.id} : copie de la vidéo impossible (${message(error)})`)
      } finally {
        if (dir) await rm(dir, { recursive: true, force: true })
      }
    }

    this.logger.info(`Traitées : ${processed} · déjà traitées : ${skipped} · échecs : ${failed}`)
    if (failed > 0) this.exitCode = 1
  }
}
