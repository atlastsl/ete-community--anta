import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, Calendar } from 'lucide-react'

export type ProductionCardData = {
  id: string
  title: string
  authors: string[]
  category?: string | null
  domain?: string | null
  summary?: string | null
  viewsCount: number
  downloadsCount: number
  publishedAt?: string | null
}

export default function ProductionCard({
  production,
  variant = 'grid',
}: {
  production: ProductionCardData
  variant?: 'grid' | 'list'
}) {
  const { t, i18n } = useTranslation()
  const { id, title, authors, category, domain, summary, viewsCount, downloadsCount, publishedAt } =
    production

  const dateLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const titleLink = (
    <Link href={`/productions/${id}`} className="hover:text-green-700">
      {title}
    </Link>
  )

  const meta = (category || domain) && (
    <p className="mt-1 text-xs uppercase tracking-wide text-stone-600">
      {[category, domain].filter(Boolean).join(' · ')}
    </p>
  )

  const byline = authors.length > 0 && (
    <p className="mt-1 text-sm text-stone-600">
      {t('production_card.by')} {authors.join(', ')}
    </p>
  )

  const counters = (
    <div className="mt-4 flex items-center gap-4 text-sm text-stone-500">
      <span
        className="flex items-center gap-1"
        aria-label={t('production_card.views', { count: viewsCount })}
      >
        <Eye className="size-4" aria-hidden />
        {viewsCount}
      </span>
      <span
        className="flex items-center gap-1"
        aria-label={t('production_card.downloads', { count: downloadsCount })}
      >
        <Download className="size-4" aria-hidden />
        {downloadsCount}
      </span>
      {dateLabel && (
        <span className="flex items-center gap-1" aria-label={t('production_card.published_at', { date: dateLabel })}>
          <Calendar className="size-4" aria-hidden />
          {dateLabel}
        </span>
      )}
    </div>
  )

  if (variant === 'list') {
    return (
      <article className="rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-green-700">
        <h3 className="font-display text-lg leading-snug text-stone-900">{titleLink}</h3>
        {byline}
        {meta}
        {summary && <p className="mt-3 line-clamp-2 text-sm text-stone-700">{summary}</p>}
        {counters}
      </article>
    )
  }

  return (
    <article className="flex flex-col rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-green-700">
      <h3 className="font-display text-lg leading-snug text-stone-900">{titleLink}</h3>
      {byline}
      {meta}
      {summary && <p className="mt-3 line-clamp-3 text-sm text-stone-700">{summary}</p>}
      {counters}
    </article>
  )
}
