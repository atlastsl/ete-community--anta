import type { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import logger from '@adonisjs/core/services/logger'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import FileStorageService, { FileValidationError } from '#services/file_storage_service'

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
    await FileStorageService.upload(file, key)

    // Compensation : si l'INSERT échoue après l'upload, on supprime l'objet R2 pour
    // ne pas laisser d'orphelin non réclamable (fuite de stockage).
    try {
      await ProductionFile.create({
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

    session.flash('success', 'productions.files.uploaded')
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const file = await ProductionFile.query()
      .where('id', params.fileId)
      .where('productionId', params.productionId)
      .firstOrFail()

    await FileStorageService.delete(file.fileKey)
    await file.delete()

    session.flash('success', 'productions.files.deleted')
    return response.redirect().back()
  }
}
