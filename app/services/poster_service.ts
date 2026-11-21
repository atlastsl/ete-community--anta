import logger from '@adonisjs/core/services/logger'
import string from '@adonisjs/core/helpers/string'
import type { DateTime } from 'luxon'
import ProductionFile from '#models/production_file'
import FileStorageService from '#services/file_storage_service'
import { THUMBNAIL_VARIANTS, type ImageVariant } from '#services/image_service'
import { THUMBNAIL_PREVIEW_VARIANT } from '#services/thumbnail_service'

/** Files of a production as needed to pick the displayed poster (preloaded rows). */
export type PosterCandidate = {
  id: string
  mimeType: string
  posterKey: string | null
  createdAt: DateTime
}

/**
 * Frame extracted from a hosted video (Story 11.3, P2.1, P2.5): 16:9 variants stored per
 * video file under an immutable prefix `posters/<fileId>/<token 20>` (`production_files.
 * poster_key`). Same storage pattern as the thumbnail (`ThumbnailService`), but never
 * blocking: the video upload succeeds whatever happens to its poster.
 */
export default class PosterService {
  /** R2 keys of the variants stored under a `poster_key` prefix. */
  static keys(prefix: string): string[] {
    return THUMBNAIL_VARIANTS.map((variant) => `${prefix}/${variant.name}`)
  }

  /**
   * Uploads the variants under a fresh prefix, then writes `poster_key` **only if it is still
   * NULL** (idempotent catch-up, concurrent runs, file deleted meanwhile): otherwise the sent
   * variants are deleted again. Returns the written prefix, or `null`; never throws.
   */
  static async attach(fileId: string, variants: ImageVariant[]): Promise<string | null> {
    const prefix = `posters/${fileId}/${string.generateRandom(20)}`
    const results = await Promise.allSettled(
      variants.map((variant) =>
        FileStorageService.putObject(`${prefix}/${variant.name}`, variant.body, variant.contentType)
      )
    )
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) {
      logger.error(
        { err: (failure as PromiseRejectedResult).reason, fileId },
        'Failed to upload the video poster'
      )
      await this.deleteKeys(
        variants
          .filter((_, index) => results[index].status === 'fulfilled')
          .map((variant) => `${prefix}/${variant.name}`)
      )
      return null
    }

    let updated = 0
    try {
      const rows = await ProductionFile.query()
        .where('id', fileId)
        .whereNull('poster_key')
        .update({ poster_key: prefix })
      updated = Number(Array.isArray(rows) ? rows[0] : rows)
    } catch (error) {
      logger.error({ err: error, fileId }, 'Failed to save the video poster key')
    }
    if (updated !== 1) {
      await this.discard(prefix)
      return null
    }
    return prefix
  }

  /** Best-effort removal of the variants of a prefix: failures are logged, never thrown. */
  static async discard(prefix: string | null): Promise<void> {
    if (!prefix) return
    await this.deleteKeys(this.keys(prefix))
  }

  /** Signed admin preview URL (`ThumbnailField`, never public); `null` without poster or on failure. */
  static async signedUrl(
    prefix: string | null,
    variant: string = THUMBNAIL_PREVIEW_VARIANT
  ): Promise<string | null> {
    if (!prefix) return null
    const key = `${prefix}/${variant}`
    try {
      return await FileStorageService.signedUrl(key)
    } catch (error) {
      logger.error({ err: error, key }, 'Failed to sign video poster URL')
      return null
    }
  }

  /**
   * The poster shown for a production without thumbnail (P2.1, D-11.3-2): the first
   * `video/mp4` file **with a poster**, by creation order (then id, for a stable tie-break).
   */
  static displayed<T extends PosterCandidate>(files: readonly T[]): T | null {
    let best: T | null = null
    for (const file of files) {
      if (file.mimeType !== 'video/mp4' || !file.posterKey) continue
      if (
        !best ||
        file.createdAt.toMillis() < best.createdAt.toMillis() ||
        (file.createdAt.toMillis() === best.createdAt.toMillis() && file.id < best.id)
      ) {
        best = file
      }
    }
    return best
  }

  private static async deleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      const failures = await FileStorageService.deleteObjects(keys)
      for (const { key, error } of failures) {
        logger.error({ err: error, keys: [key] }, 'Failed to delete video poster variants')
      }
    } catch (error) {
      logger.error({ err: error, keys }, 'Failed to delete video poster variants')
    }
  }
}
