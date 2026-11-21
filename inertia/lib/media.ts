/**
 * Public images served by `GET /media/*` (P2.5). Props carry a base URL (`photoBase`,
 * e.g. `/media/authors/<id>/<token>`; `imageUrl` of the featured productions, e.g.
 * `/media/thumbnails/<id>/<token>`); the variants and their widths are added here.
 * No import: the module is loaded as is by the unit tests.
 */

const MEDIA_PREFIX = '/media/'

/** Square author photo variants used on the site (`og.jpg` is for social previews only). */
export const AUTHOR_PHOTO_WIDTHS = [128, 384] as const

export type ResponsiveImage = {
  src: string
  srcSet: string
  sizes: string
  width: number
  height: number
}

/**
 * `src` / `srcSet` of an author photo rendered `sizePx` wide; `width` / `height` are always
 * set (square) so the layout never shifts, `sizes` defaults to the fixed rendered width.
 * Only `/media/…` bases are accepted (`null` otherwise): a signed or arbitrary URL passed
 * by mistake never gets variant suffixes appended.
 */
export function authorPhotoImage(
  photoBase: string,
  sizePx: number,
  sizes = `${sizePx}px`
): ResponsiveImage | null {
  if (!photoBase.startsWith(MEDIA_PREFIX)) return null
  const base = photoBase.replace(/\/+$/, '')
  return {
    src: `${base}/w128.webp`,
    srcSet: AUTHOR_PHOTO_WIDTHS.map((w) => `${base}/w${w}.webp ${w}w`).join(', '),
    sizes,
    width: sizePx,
    height: sizePx,
  }
}

/** 16:9 banner image variants (production thumbnail, video poster): `w<width>.webp`. */
export const THUMBNAIL_WIDTHS = [400, 800, 1600] as const

/**
 * Banner slots (DESIGN.md "Layout & Spacing"): `full` = banner of 1 item, `half` = banner of
 * 2, `lead` = item 1 of a banner of 3 (2 columns × 2 rows), `side` = items 2–3 (stacked in
 * the 3rd column).
 */
export type BannerSlot = 'full' | 'half' | 'lead' | 'side'

/**
 * Rendered widths per slot: public container `max-w-7xl` (1280 px) minus `px-6` (content up
 * to 1232 px), `gap-5` (20 px), columns from `lg` (1024 px); below `lg` the items are
 * stacked full width.
 */
export const BANNER_IMAGE_SIZES: Readonly<Record<BannerSlot, string>> = {
  full: '(min-width: 1280px) 1232px, calc(100vw - 48px)',
  half: '(min-width: 1280px) 606px, (min-width: 1024px) calc(50vw - 34px), calc(100vw - 48px)',
  lead: '(min-width: 1280px) 815px, (min-width: 1024px) calc((100vw - 88px) * 2 / 3 + 20px), calc(100vw - 48px)',
  side: '(min-width: 1280px) 398px, (min-width: 1024px) calc((100vw - 88px) / 3), calc(100vw - 48px)',
}

/**
 * `src` / `srcSet` / `sizes` of a 16:9 banner image (Story 11.2). `width` / `height` are the
 * intrinsic size of the largest variant (1600×900, exact 16:9) so the layout never shifts;
 * the rendered size is set by CSS (`w-full`, `aspect-video` / `object-cover`). Only
 * `/media/…` bases are accepted (`null` otherwise).
 */
export function bannerImage(imageUrl: string, slot: BannerSlot): ResponsiveImage | null {
  if (!imageUrl.startsWith(MEDIA_PREFIX)) return null
  const base = imageUrl.replace(/\/+$/, '')
  return {
    src: `${base}/w800.webp`,
    srcSet: THUMBNAIL_WIDTHS.map((w) => `${base}/w${w}.webp ${w}w`).join(', '),
    sizes: BANNER_IMAGE_SIZES[slot],
    width: 1600,
    height: 900,
  }
}
