import type { DateTime } from 'luxon'
import Author from '#models/author'
import Production from '#models/production'
import ProductionStatus, {
  type ProductionStatus as ProductionStatusValue,
} from '#enums/production_status'
import { AUTHOR_PHOTO_VARIANTS, THUMBNAIL_VARIANTS } from '#services/image_service'

/** Browser cache of an author photo: one hour, since the consent can be withdrawn (P2.5). */
export const AUTHOR_PHOTO_CACHE_CONTROL = 'public, max-age=3600'

/**
 * Browser cache of a banner image (Story 11.2, P2-10): one year, `immutable`, since every
 * upload gets a fresh prefix (P2.5). The server refuses a replaced, removed or unpublished
 * image from then on, but a browser that already cached it never re-requests it: it keeps
 * showing it from its cache (accepted, review of 11.2; a shorter `max-age` without
 * `immutable` would be needed to change that).
 */
export const THUMBNAIL_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** `string.generateRandom(20)` of `AuthorService.uploadPhoto`: base64url alphabet. */
const TOKEN = /^[A-Za-z0-9_-]{20}$/
const contentTypes = (
  variants: readonly { name: string; format: 'webp' | 'jpeg' }[]
): ReadonlyMap<string, string> =>
  new Map(
    variants.map((variant) => [
      variant.name,
      variant.format === 'jpeg' ? 'image/jpeg' : 'image/webp',
    ])
  )
const CONTENT_TYPES = contentTypes(AUTHOR_PHOTO_VARIANTS)
const THUMBNAIL_CONTENT_TYPES = contentTypes(THUMBNAIL_VARIANTS)

export type ParsedAuthorKey = {
  authorId: string
  /** The `authors.photo_key` this key must belong to. */
  prefix: string
  key: string
  contentType: string
}

export type ParsedThumbnailKey = {
  productionId: string
  /** The `productions.thumbnail_key` this key must belong to. */
  prefix: string
  key: string
  contentType: string
}

export type ServedMedia = {
  key: string
  contentType: string
  cacheControl: string
}

/**
 * Public images served by `GET /media/*` (P2.5, P2-10): author photos
 * (`authors/<id>/<token>/<variant>`) and banner thumbnails
 * (`thumbnails/<productionId>/<token>/<variant>`, Story 11.2); `posters/` comes with
 * Story 11.3. Licensed files (`productions/…`) are never served here, they keep their
 * signed URLs.
 */
export default class MediaService {
  /**
   * Strict allow-list of the key shape: anything else (other prefix, `..`, empty or extra
   * segment, unknown variant) is refused before any database or R2 access.
   */
  static parseAuthorKey(segments: string[]): ParsedAuthorKey | null {
    if (segments.length !== 4) return null
    const [root, authorId, token, variant] = segments
    if (root !== 'authors' || !UUID.test(authorId) || !TOKEN.test(token)) return null
    const contentType = CONTENT_TYPES.get(variant)
    if (!contentType) return null
    const prefix = `authors/${authorId}/${token}`
    return { authorId, prefix, key: `${prefix}/${variant}`, contentType }
  }

  /** Same allow-list for a banner thumbnail: `thumbnails` / UUID / token / 16:9 variant. */
  static parseThumbnailKey(segments: string[]): ParsedThumbnailKey | null {
    if (segments.length !== 4) return null
    const [root, productionId, token, variant] = segments
    if (root !== 'thumbnails' || !UUID.test(productionId) || !TOKEN.test(token)) return null
    const contentType = THUMBNAIL_CONTENT_TYPES.get(variant)
    if (!contentType) return null
    const prefix = `thumbnails/${productionId}/${token}`
    return { productionId, prefix, key: `${prefix}/${variant}`, contentType }
  }

  /**
   * The key to stream, or `null` when it must not be served. Dispatched on the first
   * segment (Story 11.3 adds `posters`); any other prefix is refused without a query.
   */
  static async resolve(segments: string[]): Promise<ServedMedia | null> {
    switch (segments[0]) {
      case 'authors':
        return this.resolveAuthorPhoto(segments)
      case 'thumbnails':
        return this.resolveThumbnail(segments)
      default:
        return null
    }
  }

  /**
   * Author photo: the prefix must be the **current** `photo_key` of an author whose profile
   * is public (consent confirmed). An old key (replaced photo) or a withdrawn consent is
   * refused at once.
   */
  private static async resolveAuthorPhoto(segments: string[]): Promise<ServedMedia | null> {
    const parsed = this.parseAuthorKey(segments)
    if (!parsed) return null
    const author = await Author.query()
      .select('id')
      .where('id', parsed.authorId)
      .where('photo_key', parsed.prefix)
      .whereNotNull('consent_confirmed_at')
      .first()
    if (!author) return null
    return {
      key: parsed.key,
      contentType: parsed.contentType,
      cacheControl: AUTHOR_PHOTO_CACHE_CONTROL,
    }
  }

  /**
   * Banner thumbnail: the prefix must be the **current** `thumbnail_key` of a **published**
   * production (same id). A draft, an unpublished production or an old key (replaced or
   * removed thumbnail) is refused at once.
   */
  private static async resolveThumbnail(segments: string[]): Promise<ServedMedia | null> {
    const parsed = this.parseThumbnailKey(segments)
    if (!parsed) return null
    const production = await Production.query()
      .select('id')
      .where('id', parsed.productionId)
      .where('thumbnail_key', parsed.prefix)
      .where('status', ProductionStatus.PUBLISHED)
      .first()
    if (!production) return null
    return {
      key: parsed.key,
      contentType: parsed.contentType,
      cacheControl: THUMBNAIL_CACHE_CONTROL,
    }
  }

  /**
   * Base of the public photo URLs (`inertia/lib/media.ts` appends the variants), only for a
   * public profile with a photo: a non-public author's key never reaches a public prop.
   */
  static authorPhotoUrl(author: {
    photoKey: string | null
    consentConfirmedAt: DateTime | null
  }): string | null {
    if (!author.photoKey || !author.consentConfirmedAt) return null
    return `/media/${author.photoKey}`
  }

  /**
   * Base of the public banner image URLs (`inertia/lib/media.ts` appends the variants), only
   * for a published production with a thumbnail: an unpublished production's key never
   * reaches a public prop. The extracted video frame fallback comes with Story 11.3.
   */
  static productionImageUrl(production: {
    status: ProductionStatusValue
    thumbnailKey: string | null
  }): string | null {
    if (!production.thumbnailKey || production.status !== ProductionStatus.PUBLISHED) return null
    return `/media/${production.thumbnailKey}`
  }
}
