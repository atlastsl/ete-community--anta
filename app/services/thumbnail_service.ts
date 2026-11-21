import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import string from '@adonisjs/core/helpers/string'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Production from '#models/production'
import FileStorageService from '#services/file_storage_service'
import { THUMBNAIL_VARIANTS, type ImageVariant } from '#services/image_service'

/** Variant shown by the admin preview (`ThumbnailField`, signed URL). */
export const THUMBNAIL_PREVIEW_VARIANT = 'w800.webp'

/**
 * Production thumbnail (Story 11.1, P2.5, D37): fixed 16:9 variants under an immutable prefix
 * `thumbnails/<productionId>/<token 20>`, the only banner image besides the extracted video
 * frame. Same storage pattern as the author photo (`AuthorService`): a fresh prefix per
 * upload, the key written after the variants are sent, the replaced prefix deleted after the
 * commit (best-effort, logged), the new one deleted again if the write fails.
 */
export default class ThumbnailService {
  /** R2 keys of the variants stored under a `thumbnail_key` prefix. */
  static keys(prefix: string): string[] {
    return THUMBNAIL_VARIANTS.map((variant) => `${prefix}/${variant.name}`)
  }

  /**
   * Sets or replaces the thumbnail; returns the replaced prefix (`null` if there was none).
   * `production.thumbnailKey` is updated on success.
   */
  static async set(
    production: Production,
    variants: ImageVariant[]
  ): Promise<{ previous: string | null }> {
    const prefix = await this.upload(production.id, variants)
    let previous: string | null = null
    try {
      await db.transaction(async (trx) => {
        const locked = await this.lock(production.id, trx)
        previous = locked.thumbnailKey
        locked.thumbnailKey = prefix
        await locked.save()
      })
    } catch (error) {
      await this.discard(prefix)
      throw error
    }
    production.thumbnailKey = prefix
    if (previous && previous !== prefix) await this.discard(previous)
    return { previous }
  }

  /**
   * Removes the thumbnail: `thumbnail_key` set to NULL, then the variants deleted after the
   * commit (best-effort). Returns `false` (nothing written) when there was no thumbnail.
   */
  static async remove(production: Production): Promise<boolean> {
    const previous = await db.transaction(async (trx) => {
      const locked = await this.lock(production.id, trx)
      const key = locked.thumbnailKey
      if (key === null) return null
      locked.thumbnailKey = null
      await locked.save()
      return key
    })
    production.thumbnailKey = null
    if (previous === null) return false
    await this.discard(previous)
    return true
  }

  /** Signed admin preview URL (never public); `null` without thumbnail or on failure. */
  static async signedUrl(
    prefix: string | null,
    variant: string = THUMBNAIL_PREVIEW_VARIANT
  ): Promise<string | null> {
    if (!prefix) return null
    const key = `${prefix}/${variant}`
    try {
      return await FileStorageService.signedUrl(key)
    } catch (error) {
      logger.error({ err: error, key }, 'Failed to sign thumbnail URL')
      return null
    }
  }

  /** Best-effort removal of the variants of a prefix: failures are logged, never thrown. */
  static async discard(prefix: string | null): Promise<void> {
    if (!prefix) return
    await this.deleteKeys(this.keys(prefix))
  }

  /**
   * Locks the production row while its key is swapped: concurrent uploads each delete the
   * prefix they actually replaced. FOR NO KEY UPDATE (not FOR UPDATE): the key columns never
   * change, and child inserts (files, views, downloads, pivot) only take FOR KEY SHARE on it.
   */
  private static async lock(id: string, trx: TransactionClientContract): Promise<Production> {
    const query = Production.query({ client: trx }).where('id', id)
    query.knexQuery.forNoKeyUpdate()
    return query.firstOrFail()
  }

  /** Uploads the variants under a fresh prefix; on a failed upload, removes the sent ones. */
  private static async upload(productionId: string, variants: ImageVariant[]): Promise<string> {
    const prefix = `thumbnails/${productionId}/${string.generateRandom(20)}`
    const results = await Promise.allSettled(
      variants.map((variant) =>
        FileStorageService.putObject(`${prefix}/${variant.name}`, variant.body, variant.contentType)
      )
    )
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) {
      const sent = variants
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((variant) => `${prefix}/${variant.name}`)
      await this.deleteKeys(sent)
      throw (failure as PromiseRejectedResult).reason
    }
    return prefix
  }

  private static async deleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      const failures = await FileStorageService.deleteObjects(keys)
      for (const { key, error } of failures) {
        logger.error({ err: error, keys: [key] }, 'Failed to delete thumbnail variants')
      }
    } catch (error) {
      logger.error({ err: error, keys }, 'Failed to delete thumbnail variants')
    }
  }
}
