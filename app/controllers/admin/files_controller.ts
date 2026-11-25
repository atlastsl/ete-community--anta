import type { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import FileStorageService, { FileValidationError } from '#services/file_storage_service'
import PosterService from '#services/poster_service'
import VideoFrameService from '#services/video_frame_service'

const ALLOWED_EXTNAMES = ['pdf', 'epub', 'mp4', 'mp3', 'aac']

// Extension de la clé R2 dérivée du type RÉEL validé (octets magiques), pas du nom
// client — évite une clé malformée (`...rand.`) si le fichier n'a pas d'extension.
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
}

export default class FilesController {
  async store({ request, params, response, session }: HttpContext) {
    const production = await Production.findOrFail(params.productionId)

    const file = request.file('file', {
      size: '100mb',
      extnames: ALLOWED_EXTNAMES,
    })

    if (!file) {
      session.flashErrors({ file: 'productions.files.errors.no_file' })
      return response.redirect().back()
    }

    // Validation serveur (taille + MIME réel via octets magiques) — défense en profondeur.
    try {
      FileStorageService.validate(file)
    } catch (error) {
      if (error instanceof FileValidationError) {
        session.flashErrors({ file: 'productions.files.errors.invalid' })
        return response.redirect().back()
      }
      throw error
    }

    const verifiedMime = `${file.type}/${file.subtype}`
    const ext = MIME_TO_EXT[verifiedMime] ?? file.extname ?? 'bin'
    const key = `productions/${production.id}/${string.generateRandom(20)}.${ext}`

    // Image extraite d'une vidéo hébergée (Story 11.3, P2.5) : AVANT l'envoi, qui déplace le
    // fichier temporaire. Ne lève jamais : un échec est journalisé, la vidéo est envoyée.
    const posterVariants =
      verifiedMime === 'video/mp4' && file.tmpPath
        ? await VideoFrameService.posterVariants(file.tmpPath)
        : null

    await FileStorageService.upload(file, key)

    // Compensation : si l'INSERT échoue après l'upload, on supprime l'objet R2 pour
    // ne pas laisser d'orphelin non réclamable (fuite de stockage).
    let record: ProductionFile
    try {
      record = await ProductionFile.create({
        productionId: production.id,
        fileKey: key,
        originalName: file.clientName,
        mimeType: verifiedMime,
        sizeBytes: file.size,
        storageProvider: 'r2',
      })
    } catch (error) {
      await FileStorageService.delete(key).catch((cleanupError) =>
        logger.error({ err: cleanupError, key }, 'Failed to clean up orphaned R2 object')
      )
      throw error
    }

    // Variantes du poster et `poster_key` APRÈS la création de la ligne (son id n'existe
    // qu'alors) ; jamais d'échec du téléversement (`poster_key` reste NULL).
    if (posterVariants) await PosterService.attach(record.id, posterVariants)

    session.flash('success', 'productions.files.uploaded')
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const file = await ProductionFile.query()
      .where('id', params.fileId)
      .where('productionId', params.productionId)
      .firstOrFail()

    await FileStorageService.delete(file.fileKey)
    // `RETURNING poster_key` : la clé réellement supprimée, pas celle lue avant (un poster
    // enregistré entre-temps par le rattrapage ne reste pas orphelin dans R2 — revue 11.3).
    const deleted = await db.rawQuery(
      'DELETE FROM production_files WHERE id = ? AND production_id = ? RETURNING poster_key',
      [file.id, file.productionId]
    )
    // Image extraite de la vidéo (Story 11.3) : après la suppression, best-effort (journalisé).
    for (const row of deleted.rows as { poster_key: string | null }[]) {
      await PosterService.discard(row.poster_key)
    }

    session.flash('success', 'productions.files.deleted')
    return response.redirect().back()
  }
}
