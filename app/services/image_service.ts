import { open, stat } from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'
import sharp, { type OutputInfo } from 'sharp'

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

/**
 * Signatures checked before sharp sees the file: other formats (svg, heif, tiff...) never
 * reach their libvips decoders, even renamed `.jpg`.
 */
function hasAcceptedSignature(head: Buffer): boolean {
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  const png = head
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const webp =
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  return jpeg || png || webp
}

async function readHead(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input.subarray(0, 12)
  const handle = await open(input, 'r')
  try {
    const head = Buffer.alloc(12)
    const { bytesRead } = await handle.read(head, 0, 12, 0)
    return head.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
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

  /**
   * The source is decoded once into the largest variant (raw pixels), then each variant is
   * encoded from it one after the other: a 40 Mpx source is never held in memory several
   * times. The variants of one profile share their aspect ratio.
   */
  private static async render(
    input: string | Buffer,
    variants: readonly VariantSpec[]
  ): Promise<ImageVariant[]> {
    await this.assertValid(input)
    const largest = variants.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
    if (variants.some((v) => v.width * largest.height !== v.height * largest.width)) {
      throw new Error('ImageService: the variants of a profile must share their aspect ratio')
    }

    let base: { data: Buffer; info: OutputInfo }
    try {
      // No `animated: true`: only the first frame of an animated image is used.
      base = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS })
        .rotate()
        .resize(largest.width, largest.height, { fit: 'cover', position: 'centre' })
        .raw()
        .toBuffer({ resolveWithObject: true })
    } catch (error) {
      throw this.toValidationError(error)
    }

    const result: ImageVariant[] = []
    for (const variant of variants) {
      result.push(await this.encodeVariant(base, variant))
    }
    return result
  }

  private static async assertValid(input: string | Buffer): Promise<void> {
    const info = typeof input === 'string' ? await stat(input) : null
    const bytes = info ? info.size : (input as Buffer).length
    if (bytes > IMAGE_MAX_BYTES) throw new ImageValidationError('photo_size')
    if (!hasAcceptedSignature(await readHead(input))) throw new ImageValidationError('photo_type')

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

  private static async encodeVariant(
    base: { data: Buffer; info: OutputInfo },
    variant: VariantSpec
  ): Promise<ImageVariant> {
    const { width, height, channels } = base.info
    const pipeline = sharp(base.data, { raw: { width, height, channels } }).resize(
      variant.width,
      variant.height
    )
    const body =
      variant.format === 'webp'
        ? await pipeline.webp({ quality: 80 }).toBuffer()
        : // JPEG has no alpha: flatten on white, not sharp's default black.
          await pipeline
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer()
    return {
      name: variant.name,
      body,
      contentType: variant.format === 'webp' ? 'image/webp' : 'image/jpeg',
    }
  }

  private static toValidationError(error: unknown): ImageValidationError {
    if (error instanceof ImageValidationError) return error
    const message = error instanceof Error ? error.message : ''
    // Mostly corrupt files, but also server faults (memory, missing binary): keep a trace.
    logger.warn({ err: error }, 'ImageService: image refused by sharp')
    return new ImageValidationError(
      message.includes('pixel limit') ? 'photo_dimensions' : 'photo_type'
    )
  }
}
