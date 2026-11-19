/**
 * Public images served by `GET /media/*` (P2.5). Props carry a base URL (`photoUrl`,
 * e.g. `/media/authors/<id>/<token>`); the variants and their widths are added here.
 */

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
 */
export function authorPhotoImage(
  photoUrl: string,
  sizePx: number,
  sizes = `${sizePx}px`
): ResponsiveImage {
  const base = photoUrl.replace(/\/+$/, '')
  return {
    src: `${base}/w128.webp`,
    srcSet: AUTHOR_PHOTO_WIDTHS.map((w) => `${base}/w${w}.webp ${w}w`).join(', '),
    sizes,
    width: sizePx,
    height: sizePx,
  }
}
