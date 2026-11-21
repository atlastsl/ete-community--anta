import { open, stat } from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'
import sharp, { type Metadata, type OutputInfo, type Sharp } from 'sharp'

/** Largest accepted upload (defence in depth behind the `vine.file` size rule). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Decoding ceiling: larger images are refused before any pixel is processed. */
export const IMAGE_MAX_PIXELS = 40_000_000
/**
 * Widest gap allowed between the source ratio and a target crop ratio: beyond it, the source
 * is first centre-cropped (same scale). `attention` scores the whole cover-resized image (a
 * 2×20000 PNG would be scored at 1200×12 000 000 px), and libvips refuses the affine transform
 * of an extreme cover resize ("output coordinates out of range", e.g. 4×10 000 000). For a
 * centre crop, centre-cropping first gives the same result.
 */
const MAX_RATIO_GAP = 3
/** Input formats accepted after real decoding (gif, heif, svg, tiff... are refused). */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp'])

type VariantSpec = {
  name: string
  width: number
  height: number
  format: 'webp' | 'jpeg'
  /** Cover crop anchor: `centre` by default, `attention` (salient region, faces) for wide crops. */
  position?: 'centre' | 'attention'
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

/**
 * Variants of an author photo (P2.5): square list and card avatars, plus the sharing image
 * at the 1.91:1 ratio of large preview cards, so the photo fills the whole card instead of
 * being cropped by X or letterboxed (D-10.7-2, amended 2026-11-21).
 */
export const AUTHOR_PHOTO_VARIANTS = [
  { name: 'w128.webp', width: 128, height: 128, format: 'webp' },
  { name: 'w384.webp', width: 384, height: 384, format: 'webp' },
  { name: 'og.jpg', width: 1200, height: 630, format: 'jpeg', position: 'attention' },
] as const satisfies readonly VariantSpec[]

/**
 * Variants of a production thumbnail (Story 11.1) and, from Story 11.3, of the frame extracted
 * from a hosted video (P2.5): 16:9, centre crop like the banner's `object-cover`. One group
 * (same ratio and anchor): the source is decoded once.
 */
export const THUMBNAIL_VARIANTS = [
  { name: 'w400.webp', width: 400, height: 225, format: 'webp' },
  { name: 'w800.webp', width: 800, height: 450, format: 'webp' },
  { name: 'w1600.webp', width: 1600, height: 900, format: 'webp' },
] as const satisfies readonly VariantSpec[]

/**
 * Refusal reason. Suffix of the `authors.form.errors.*` keys; the thumbnail controller maps
 * it to its own `thumbnail.errors.*` keys.
 */
export type ImageErrorCode = 'photo_type' | 'photo_size' | 'photo_dimensions'

/** Refused image (see `ImageErrorCode`). */
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
 * cover crop (centred; on the salient region for the wide sharing image). Profiles are plain
 * variant lists: author photo (1:1 + 1.91:1) and production thumbnail (16:9).
 */
export default class ImageService {
  /** Validates by real decoding, auto-orients, strips metadata, renders the variants. */
  static async authorPhotoVariants(input: string | Buffer): Promise<ImageVariant[]> {
    return this.render(input, AUTHOR_PHOTO_VARIANTS)
  }

  /** Same validation and normalization, 16:9 variants (production thumbnail, video poster). */
  static async thumbnailVariants(input: string | Buffer): Promise<ImageVariant[]> {
    return this.render(input, THUMBNAIL_VARIANTS)
  }

  /**
   * Variants sharing an aspect ratio and crop anchor form a group: the source is decoded once
   * per group into its largest variant (raw pixels), then each variant of the group is
   * encoded from it one after the other. Groups are processed one after the other, so a
   * 40 Mpx source is never held in memory several times. Output keeps the input order.
   */
  private static async render(
    input: string | Buffer,
    variants: readonly VariantSpec[]
  ): Promise<ImageVariant[]> {
    const oriented = await this.assertValid(input)

    const groups: VariantSpec[][] = []
    for (const variant of variants) {
      const group = groups.find(
        ([first]) =>
          first.width * variant.height === first.height * variant.width &&
          (first.position ?? 'centre') === (variant.position ?? 'centre')
      )
      if (group) group.push(variant)
      else groups.push([variant])
    }

    const encoded = new Map<string, ImageVariant>()
    for (const group of groups) {
      const largest = group.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
      const position =
        largest.position === 'attention' ? sharp.strategy.attention : ('centre' as const)

      let base: { data: Buffer; info: OutputInfo }
      try {
        // No `animated: true`: only the first frame of an animated image is used.
        const source = await this.boundAspect(input, oriented, largest)
        base = await source
          .resize(largest.width, largest.height, { fit: 'cover', position })
          .raw()
          .toBuffer({ resolveWithObject: true })
      } catch (error) {
        throw this.toValidationError(error)
      }

      for (const variant of group) {
        encoded.set(variant.name, await this.encodeVariant(base, variant))
      }
    }
    return variants.map((variant) => encoded.get(variant.name)!)
  }

  /**
   * Auto-oriented source, centre-cropped first when its ratio is more than
   * `MAX_RATIO_GAP` times off the target ratio (cost of `attention`, affine range).
   */
  private static async boundAspect(
    input: string | Buffer,
    oriented: { width: number; height: number },
    target: VariantSpec
  ): Promise<Sharp> {
    const source = sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).rotate()
    const { width, height } = oriented
    const ratio = target.width / target.height
    let crop: { width: number; height: number } | null = null
    if (width / height < ratio / MAX_RATIO_GAP) {
      crop = { width, height: Math.max(1, Math.round((width * MAX_RATIO_GAP) / ratio)) }
    } else if (width / height > ratio * MAX_RATIO_GAP) {
      crop = { width: Math.max(1, Math.round(height * ratio * MAX_RATIO_GAP)), height }
    }
    if (!crop) return source

    // Same scale, so `cover` is a pure centre crop; raw pixels feed the cover pass.
    const { data, info } = await source
      .resize(crop.width, crop.height, { fit: 'cover', position: 'centre' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  }

  /** Validates size, signature, format and pixel count; returns the auto-oriented size. */
  private static async assertValid(
    input: string | Buffer
  ): Promise<{ width: number; height: number }> {
    const info = typeof input === 'string' ? await stat(input) : null
    const bytes = info ? info.size : (input as Buffer).length
    if (bytes > IMAGE_MAX_BYTES) throw new ImageValidationError('photo_size')
    if (!hasAcceptedSignature(await readHead(input))) throw new ImageValidationError('photo_type')

    let meta: Metadata
    try {
      meta = await sharp(input, { limitInputPixels: IMAGE_MAX_PIXELS }).metadata()
      // `metadata()` reads the header only: enforce the ceiling here too.
      if ((meta.width ?? 0) * (meta.height ?? 0) > IMAGE_MAX_PIXELS) {
        throw new ImageValidationError('photo_dimensions')
      }
    } catch (error) {
      throw this.toValidationError(error)
    }
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
      throw new ImageValidationError('photo_type')
    }
    // EXIF orientations 5–8 swap the axes once `.rotate()` applies them.
    const swapped = (meta.orientation ?? 1) >= 5
    const width = meta.width ?? 1
    const height = meta.height ?? 1
    return swapped ? { width: height, height: width } : { width, height }
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
