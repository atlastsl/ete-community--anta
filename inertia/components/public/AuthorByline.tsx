import { Fragment } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { urlFor } from '~/client'
import type { AuthorCredit } from '~/components/public/ProductionCard'

/** `{components.author-link}` (D24): underline carries the link, not the colour (WCAG 1.4.1). */
const AUTHOR_LINK =
  'underline decoration-stone-300 underline-offset-2 hover:text-green-700 hover:decoration-green-700'

/**
 * Authors of a production (Story 10.4, FR59, D12, D24): a visible profile (`slug`) is a link
 * to `/authors/:slug`, any other name plain text with no distinctive style. Order = the
 * server's (pivot position). `max` truncates (cards: 3, then « et {n} autres ») ; the detail
 * page shows every author (D36). `currentSlug`: on a profile, the author's own name is not
 * linked. `stacked`: one name per line (aside « Auteurs »). Renders inline content only: the
 * caller owns the wrapper (« Par … ») and keeps it outside any other link (no nested `<a>`).
 */
/**
 * Names shown under `max`: the first `max`; on a profile whose author lies beyond `max`, the
 * first `max - 1` then that author, so a profile card always names its author (review 10.4,
 * D-10.4-7). The hidden count stays `authors.length - max`.
 */
function visibleAuthors(
  authors: AuthorCredit[],
  max: number | undefined,
  currentSlug: string | null | undefined
): AuthorCredit[] {
  if (max === undefined || authors.length <= max) return authors
  const current = currentSlug ? authors.findIndex((a) => a.slug === currentSlug) : -1
  if (current < max || max < 1) return authors.slice(0, Math.max(max, 0))
  return [...authors.slice(0, max - 1), authors[current]]
}

export default function AuthorByline({
  authors,
  max,
  currentSlug,
  variant = 'inline',
}: {
  authors: AuthorCredit[]
  max?: number
  currentSlug?: string | null
  variant?: 'inline' | 'stacked'
}) {
  const { t } = useTranslation()
  const shown = visibleAuthors(authors, max, currentSlug)
  const hidden = authors.length - shown.length

  const names = shown.map((author, index) =>
    author.slug && author.slug !== currentSlug ? (
      <Link
        key={`${index}-${author.slug}`}
        href={urlFor('authors.show', { slug: author.slug })}
        className={AUTHOR_LINK}
      >
        {author.name}
      </Link>
    ) : (
      <span key={`${index}-${author.name}`}>{author.name}</span>
    )
  )

  if (variant === 'stacked') {
    return (
      <ul>
        {names.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
    )
  }

  return (
    <>
      {names.map((name, index) => (
        <Fragment key={index}>
          {index > 0 && ', '}
          {name}
        </Fragment>
      ))}
      {hidden > 0 && <> {t('authors.byline.others', { count: hidden })}</>}
    </>
  )
}
