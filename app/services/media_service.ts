import type { DateTime } from 'luxon'
import Author from '#models/author'
import { AUTHOR_PHOTO_VARIANTS } from '#services/image_service'

/** Browser cache of an author photo: one hour, since the consent can be withdrawn (P2.5). */
export const AUTHOR_PHOTO_CACHE_CONTROL = 'public, max-age=3600'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** `string.generateRandom(20)` of `AuthorService.uploadPhoto`: base64url alphabet. */
const TOKEN = /^[A-Za-z0-9_-]{20}$/
const CONTENT_TYPES: ReadonlyMap<string, string> = new Map(
  AUTHOR_PHOTO_VARIANTS.map((variant) => [
    variant.name,
    variant.format === 'jpeg' ? 'image/jpeg' : 'image/webp',
  ])
)

export type ParsedAuthorKey = {
  authorId: string
  /** The `authors.photo_key` this key must belong to. */
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
 * Public images served by `GET /media/*` (P2.5, P2-10). Only `authors/<id>/<token>/<variant>`
 * keys for now (`thumbnails/` and `posters/` come with Epic 11); licensed files
 * (`productions/…`) are never served here, they keep their signed URLs.
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

  /**
   * The key to stream, or `null` when it must not be served: the prefix must be the
   * **current** `photo_key` of an author whose profile is public (consent confirmed).
   * An old key (replaced photo) or a withdrawn consent is refused at once.
   */
  static async resolve(segments: string[]): Promise<ServedMedia | null> {
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
}
