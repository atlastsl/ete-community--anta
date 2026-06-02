/**
 * Contraintes d'upload côté client (UX-DR7 / NFR3).
 *
 * Duplication intentionnelle des limites serveur (`FileStorageService`) pour
 * valider AVANT tout envoi réseau. Le serveur revalide de toute façon (MIME réel).
 */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export const ALLOWED_EXTENSIONS = ['pdf', 'epub', 'mp4', 'mp3', 'aac'] as const

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'video/mp4',
  'audio/mpeg',
  'audio/aac',
] as const

export function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export type FileConstraintError = 'too_large' | 'unsupported_format' | null

/** Valide un fichier côté client. Retourne un code d'erreur i18n ou null si valide. */
export function validateFileConstraints(file: File): FileConstraintError {
  if (file.size > MAX_FILE_SIZE_BYTES) return 'too_large'

  const ext = getExtension(file.name)
  const extOk = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  // Le navigateur peut laisser file.type vide ; on se fie alors à l'extension.
  const mimeOk = file.type === '' || (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)

  if (!extOk || !mimeOk) return 'unsupported_format'
  return null
}
