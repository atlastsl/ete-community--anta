import { stat } from 'node:fs/promises'
import sharp from 'sharp'

/** Largest accepted upload (defence in depth behind the `vine.file` size rule). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Decoding ceiling: larger images are refused before any pixel is processed. */
export const IMAGE_MAX_PIXELS = 40_000_000
/** Input formats accepted after real decoding (gif, heif, svg, tiff... are refused). */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp'])

type VariantSpec = {
  name: string
  width: number
  height: number
  format: 'webp' | 'jpeg'
}

/** Square variants of an author photo (P2.5): list avatar, card avatar, sharing image. */
export const AUTHOR_PHOTO_VARIANTS = [
  { name: 'w128.webp', width: 128, height: 128, format: 'webp' },
  { name: 'w384.webp', width: 384, height: 384, format: 'webp' },
  { name: 'og.jpg', width: 600, height: 600, format: 'jpeg' },
] as const satisfies readonly VariantSpec[]

export type ImageErrorCode = 'photo_type' | 'photo_size' | 'photo_dimensions'

/** Refused image; `code` is the suffix of the `authors.form.errors.*` i18n key. */
export class ImageValidationError extends Error {
  constructor(readonly code: ImageErrorCode) {
    super(`Invalid image: ${code}`)
    this.name = 'ImageValidationError'
  }
}

export type ImageVariant = {
  name: string
  body: Buffer
  contentType: 'image/webp' | 'image/jpeg'
}

/**
 * Image normalization (P2.5): validation by real decoding, EXIF auto-orientation,
 * metadata stripping (sharp's default output: never `withMetadata` / `keepMetadata`),
 * centred cover crop. Profiles are plain variant lists so the 16:9 thumbnail profile
 * (Epic 11) can be added next to the author photo one.
 */
export default class ImageService {
  /** Validates by real decoding, auto-orients, strips metadata, renders the 1:1 variants. */
  static async authorPhotoVariants(input: string | Buffer): Promise<ImageVariant[]> {
    return this.render(input, AUTHOR_PHOTO_VARIANTS)
  }

  private static async render(
    input: string | Buffer,
    variants: readonly VariantSpec[]
  ): Promise<ImageVariant[]> {
    await this.assertValid(input)
    return Promise.all(variants.map((variant) => this.renderVariant(input, variant)))
  }

  private static async assertValid(input: string | Buffer): Promise<void> {
    const info = typeof input === 'string' ? await stat(input) : null
    const bytes = info ? info.size : (input as Buffer).length
    if (bytes > IMAGE_MAX_BYTES) throw new ImageValidationError('photo_size')

    let format: string | undefined
    try {
      const meta = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).metadata()
      format = meta.format
      // `metadata()` reads the header only: enforce the ceiling here too.
      if ((meta.width ?? 0) * (meta.height ?? 0) > IMAGE_MAX_PIXELS) {
        throw new ImageValidationError('photo_dimensions')
      }
    } catch (error) {
      throw this.toValidationError(error)
    }
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new ImageValidationError('photo_type')
  }

  private static async renderVariant(
    input: string | Buffer,
    variant: VariantSpec
  ): Promise<ImageVariant> {
    try {
      // No `animated: true`: only the first frame of an animated image is used.
      const pipeline = sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS })
        .rotate()
        .resize(variant.width, variant.height, { fit: 'cover', position: 'centre' })
      const body =
        variant.format === 'webp'
          ? await pipeline.webp({ quality: 80 }).toBuffer()
          : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
      return {
        name: variant.name,
        body,
        contentType: variant.format === 'webp' ? 'image/webp' : 'image/jpeg',
      }
    } catch (error) {
      throw this.toValidationError(error)
    }
  }

  private static toValidationError(error: unknown): ImageValidationError {
    if (error instanceof ImageValidationError) return error
    const message = error instanceof Error ? error.message : ''
    return new ImageValidationError(
      message.includes('pixel limit') ? 'photo_dimensions' : 'photo_type'
    )
  }
}
