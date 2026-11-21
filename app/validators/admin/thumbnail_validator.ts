import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/** Thumbnail limits (Story 11.1), shared with `inertia/lib/thumbnail.ts` and `ImageService`. */
export const THUMBNAIL_MAX_MB = 5
export const THUMBNAIL_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']

/**
 * Production thumbnail upload (Story 11.1, P2.5). Size and extension only: `ImageService`
 * then decodes the file (real format, pixel count).
 */
export const thumbnailValidator = vine.compile(
  vine.object({
    thumbnail: vine.file({ size: `${THUMBNAIL_MAX_MB}mb`, extnames: THUMBNAIL_EXTNAMES }),
  })
)

thumbnailValidator.messagesProvider = new SimpleMessagesProvider({
  'thumbnail.required': 'thumbnail.errors.no_file',
  'thumbnail.file': 'thumbnail.errors.invalid_type',
  'thumbnail.file.extname': 'thumbnail.errors.invalid_type',
  'thumbnail.file.size': 'thumbnail.errors.too_large',
})
