import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, Calendar } from 'lucide-react'
import { taxonomyLabel } from '~/lib/taxonomy'
import AuthorByline from '~/components/public/AuthorByline'
import { contentLang } from '~/lib/content_lang'

/** One author of a byline: `slug` only for a profile visible on the site (Story 10.4, D12). */
export type AuthorCredit = { name: string; slug: string | null }

/** Cards show 3 authors, then « et {n} autres » (D36). */
const CARD_MAX_AUTHORS = 3

export type ProductionCardData = {
  id: string
  slug: string
  title: string
  authors: AuthorCredit[]
  category?: string | null
  domain?: string | null
  summary?: string | null
  /** Stored language of the production: `lang` of title / summary when ≠ UI (13.2, WCAG 3.1.2). */
  language?: string | null
  viewsCount: number
  downloadsCount: number
  publishedAt?: string | null
  /** Date of the work (`YYYY-MM-DD`), sent by the author profile only (review 10.3). */
  workPublishedAt?: string | null
}

export default function ProductionCard({
  production,
  variant = 'grid',
  dateField = 'published',
  currentAuthorSlug,
}: {
  production: ProductionCardData
  /**
   * `compact` (suggestions, Story 12.4, D22, D35): grid card without date, tighter padding,
   * summary hidden < sm then `line-clamp-2`.
   */
  variant?: 'grid' | 'list' | 'compact'
  /** `work`: the work date (author profile, sorted by it) instead of the Anta date. */
  dateField?: 'published' | 'work'
  /** Author profile: that author's own name is not linked (Story 10.4). */
  currentAuthorSlug?: string
}) {
  const { t, i18n } = useTranslation()
  const {
    slug,
    title,
    authors,
    category,
    domain,
    summary,
    viewsCount,
    downloadsCount,
    publishedAt,
  } = production

  const compact = variant === 'compact'
  const showWork = dateField === 'work'
  // Suggestion cards show no date (DESIGN.md, SuggestionsGrid).
  const dateValue = compact ? null : showWork ? production.workPublishedAt : publishedAt
  const dateLabel = dateValue
    ? new Date(dateValue).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        // A work date has no time: read it in UTC so it never shifts by one day.
        ...(showWork ? { timeZone: 'UTC' } : {}),
      })
    : null

  // Title and summary in the production's language when it differs from the UI (13.2).
  const lang = contentLang(production.language, i18n.resolvedLanguage ?? i18n.language)

  const titleLink = (
    <Link href={`/productions/${slug}`} lang={lang} className="hover:text-green-700">
      {title}
    </Link>
  )

  const meta = (category || domain) && (
    <p className="mt-1 text-xs uppercase tracking-wide text-stone-600">
      {[
        category ? taxonomyLabel(t, 'categories', category) : null,
        domain ? taxonomyLabel(t, 'domains', domain) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </p>
  )

  // Outside the title link (no nested <a>), after it: tab order title → authors.
  const byline = authors.length > 0 && (
    <p className="mt-1 text-sm text-stone-600">
      {t('production_card.by')}{' '}
      <AuthorByline authors={authors} max={CARD_MAX_AUTHORS} currentSlug={currentAuthorSlug} />
    </p>
  )

  // Counters (Story 13.1): `aria-label` is prohibited on a plain `span` (axe
  // `aria-prohibited-attr`, ignored by screen readers) → the full label is sr-only text and the
  // visible short value is hidden from assistive technologies.
  const counters = (
    <div
      className={`mt-4 flex items-center text-sm text-stone-500 ${compact ? 'flex-wrap gap-x-4 gap-y-1' : 'gap-4'}`}
    >
      <span className="flex items-center gap-1">
        <Eye className="size-4" aria-hidden />
        <span aria-hidden="true">{viewsCount}</span>
        <span className="sr-only">{t('production_card.views', { count: viewsCount })}</span>
      </span>
      <span className="flex items-center gap-1">
        <Download className="size-4" aria-hidden />
        <span aria-hidden="true">{downloadsCount}</span>
        <span className="sr-only">{t('production_card.downloads', { count: downloadsCount })}</span>
      </span>
      {dateLabel && (
        <span className="flex items-center gap-1">
          <Calendar className="size-4" aria-hidden />
          <span aria-hidden="true">{dateLabel}</span>
          <span className="sr-only">
            {t(showWork ? 'production_card.work_published_at' : 'production_card.published_at', {
              date: dateLabel,
            })}
          </span>
        </span>
      )}
    </div>
  )

  if (variant === 'compact') {
    return (
      <article className="flex flex-col rounded-lg border border-stone-200 bg-white p-4 transition-colors hover:border-green-700 sm:p-5">
        <h3 className="font-display text-base leading-snug text-stone-900 sm:text-lg">
          {titleLink}
        </h3>
        {byline}
        {meta}
        {summary && (
          <p lang={lang} className="mt-3 line-clamp-2 max-sm:hidden text-sm text-stone-700">
            {summary}
          </p>
        )}
        <div className="mt-auto">{counters}</div>
      </article>
    )
  }

  if (variant === 'list') {
    return (
      <article className="rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-green-700">
        <h3 className="font-display text-lg leading-snug text-stone-900">{titleLink}</h3>
        {byline}
        {meta}
        {summary && (
          <p lang={lang} className="mt-3 line-clamp-2 text-sm text-stone-700">
            {summary}
          </p>
        )}
        {counters}
      </article>
    )
  }

  return (
    <article className="flex flex-col rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-green-700">
      <h3 className="font-display text-lg leading-snug text-stone-900">{titleLink}</h3>
      {byline}
      {meta}
      {summary && (
        <p lang={lang} className="mt-3 line-clamp-3 text-sm text-stone-700">
          {summary}
        </p>
      )}
      {counters}
    </article>
  )
}
