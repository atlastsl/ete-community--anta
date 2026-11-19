import { useState } from 'react'
import { cn } from '~/lib/utils'
import { authorInitials } from '~/lib/author_form'
import { authorPhotoImage } from '~/lib/media'

type Size = 'sm' | 'md' | 'lg'

/**
 * 32 / 56 / 96 px, lg 112 px from `sm` (DESIGN.md `components.avatar`); initials ≈ 40 % of
 * the diameter. `px` / `sizes` describe the rendered width for `width`/`height` and `srcSet`.
 */
const SIZES: Record<Size, { box: string; text: string; px: number; sizes: string }> = {
  sm: { box: 'size-8', text: 'text-xs', px: 32, sizes: '32px' },
  md: { box: 'size-14', text: 'text-base', px: 56, sizes: '56px' },
  lg: {
    box: 'size-24 sm:size-28',
    text: 'text-2xl',
    px: 96,
    sizes: '(min-width: 640px) 112px, 96px',
  },
}

type Props = {
  /** Public base URL (`/media/authors/<id>/<token>`, public profiles only, Story 10.2). */
  photoUrl?: string | null
  /** Ready-made image URL (admin signed previews, Story 9.3); `photoUrl` wins. */
  src?: string | null
  firstNames: string
  lastNames: string
  size: Size
  /** Empty by default: the avatar sits next to the name it would repeat (D36). */
  alt?: string
  loading?: 'lazy' | 'eager'
  className?: string
}

/**
 * Author avatar (Stories 9.3, 10.2): the photo when there is one, otherwise - or when the
 * image fails to load - the initials (D13) in green-800 on green-100 (D25), hidden from
 * assistive technologies since the name is always displayed next to it.
 */
export default function Avatar({
  photoUrl,
  src: signedSrc,
  firstNames,
  lastNames,
  size,
  alt = '',
  loading = 'lazy',
  className,
}: Props) {
  const { box, text, px, sizes } = SIZES[size]
  const image: Partial<ReturnType<typeof authorPhotoImage>> | null = photoUrl
    ? authorPhotoImage(photoUrl, px, sizes)
    : signedSrc
      ? { src: signedSrc, width: px, height: px }
      : null
  const src = image?.src ?? null

  // The source that failed, not a flag: a new source is tried at once (no initials flash).
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src

  if (image && src && !failed) {
    return (
      <img
        src={src}
        srcSet={image.srcSet}
        sizes={image.sizes}
        width={image.width}
        height={image.height}
        loading={loading}
        alt={alt}
        onError={() => setFailedSrc(src)}
        className={cn('shrink-0 rounded-full border border-stone-200 object-cover', box, className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-green-100 font-semibold uppercase text-green-800',
        box,
        text,
        className
      )}
    >
      {authorInitials(firstNames, lastNames)}
    </span>
  )
}
