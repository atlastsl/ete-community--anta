import drive from '@adonisjs/drive/services/main'
import { type MultipartFile } from '@adonisjs/core/bodyparser'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'video/mp4',
  'audio/mpeg',
  'audio/aac',
] as const

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

export default class FileStorageService {
  static validate(file: MultipartFile): void {
    // Rejette les fichiers que le bodyparser a déjà marqués invalides (taille/extension
    // au niveau route). `=== false` strict : les fichiers sans validation route passent.
    if (file.isValid === false) {
      const reason = file.errors?.map((e) => e.message).join(', ') || 'erreur inconnue'
      throw new FileValidationError(`Fichier invalide : ${reason}`)
    }

    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        `Fichier trop volumineux : ${Math.round((file.size ?? 0) / 1024 / 1024)} Mo (max 100 Mo)`
      )
    }

    const mimeType = file.type && file.subtype ? `${file.type}/${file.subtype}` : null

    if (
      !mimeType ||
      !ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])
    ) {
      throw new FileValidationError(
        `Type de fichier non autorisé : ${mimeType ?? 'inconnu'}. Types acceptés : pdf, epub, mp4, mp3, aac`
      )
    }
  }

  static async upload(file: MultipartFile, key: string): Promise<string> {
    FileStorageService.validate(file)

    // Garde explicite : un MultipartFile peut ne pas avoir de fichier temporaire
    // (stream interrompu, upload vide) — éviter un 500 opaque dans le driver S3.
    if (!file.tmpPath) {
      throw new FileValidationError('Fichier temporaire introuvable — upload impossible')
    }

    const disk = drive.use('r2')
    await disk.moveFromFs(file.tmpPath, key, {
      contentType: file.type && file.subtype ? `${file.type}/${file.subtype}` : undefined,
    })

    return key
  }

  static async signedUrl(fileKey: string): Promise<string> {
    const disk = drive.use('r2')
    return disk.getSignedUrl(fileKey, { expiresIn: '1h' })
  }

  /**
   * URL signée (TTL 1h) forçant le téléchargement avec le nom d'origine
   * (`Content-Disposition: attachment`). `filename*` (RFC 5987) gère les accents/UTF-8.
   */
  static async signedDownloadUrl(fileKey: string, originalName: string): Promise<string> {
    // Neutralise guillemet, backslash et CR/LF dans le segment `filename="..."` (anti-injection
    // d'en-tête / échappement de guillemet). Le `filename*` UTF-8 ci-dessous reste la source
    // fiable côté navigateurs modernes.
    const safe = originalName.replace(/[\\"\r\n]/g, '')
    const disk = drive.use('r2')
    return disk.getSignedUrl(fileKey, {
      expiresIn: '1h',
      contentDisposition: `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    })
  }

  static async delete(fileKey: string): Promise<void> {
    const disk = drive.use('r2')
    await disk.delete(fileKey)
  }
}
