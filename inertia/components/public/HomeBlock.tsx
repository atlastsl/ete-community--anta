import { Fragment, useId, type ReactNode } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'

/**
 * A titled block of the home page (Story 12.2, FR9, FR45, FR46; maquette home.html) :
 * h2 + optional « sur les 12 derniers mois » (ranked blocks, D4) + « Voir plus » (D28, full
 * accessible name, ≥ 44 px), then a 3-column grid from `md` (D2, D35) — 1–2 items keep the
 * empty cells (D5). No item: no block at all, title included (FR46). Generic over its items
 * (production cards here, author cards in Story 12.3).
 */
export default function HomeBlock<T>({
  title,
  windowed = false,
  seeMoreHref,
  items,
  itemKey,
  renderItem,
}: {
  title: string
  /** Ranked on the last 365 days: shows the « sur les 12 derniers mois » subtitle (D4). */
  windowed?: boolean
  seeMoreHref: string
  items: T[]
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
}) {
  const { t } = useTranslation()
  const headingId = useId()

  if (items.length === 0) return null

  return (
    <section className="mt-12" aria-labelledby={headingId}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-2xl text-stone-900">
            {title}
          </h2>
          {windowed && <p className="mt-1 text-sm text-stone-500">{t('home.blocks.window')}</p>}
        </div>
        <Link
          href={seeMoreHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
        >
          {/* Visible « Voir plus » ; accessible name « Voir plus : {titre} » (i18n, D23). */}
          <span aria-hidden>{t('home.blocks.see_more')}</span>
          <span className="sr-only">{t('home.blocks.see_more_named', { title })}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {items.map((item) => (
          <Fragment key={itemKey(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
    </section>
  )
}
