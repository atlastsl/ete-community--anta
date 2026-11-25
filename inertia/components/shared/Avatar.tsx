import { useState } from 'react'
import { cn } from '~/lib/utils'
import { authorInitials } from '~/lib/author_form'

type Size = 'sm' | 'md' | 'lg'

/** 32 / 56 / 96 px (DESIGN.md `components.avatar`); initials ≈ 40 % of the diameter. */
const SIZES: Record<Size, { box: string; text: string }> = {
  sm: { box: 'size-8', text: 'text-xs' },
  md: { box: 'size-14', text: 'text-base' },
  lg: { box: 'size-24', text: 'text-2xl' },
}

type Props = {
  src?: string | null
  firstNames: string
  lastNames: string
  size: Size
  /** Empty by default: the avatar sits next to the name it would repeat (D36). */
  alt?: string
  className?: string
}

/**
 * Author avatar (Story 9.3): the photo when there is one, otherwise - or when the image
 * fails to load - the initials (D13) in green-800 on green-100 (D25), hidden from
 * assistive technologies since the name is always displayed next to it.
 */
export default function Avatar({ src, firstNames, lastNames, size, alt = '', className }: Props) {
  // The source that failed, not a flag: a new source is tried at once (no initials flash).
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src

  const { box, text } = SIZES[size]

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailedSrc(src)}
        className={cn(
          'shrink-0 rounded-full border border-stone-200 object-cover',
          box,
          className
        )}
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
