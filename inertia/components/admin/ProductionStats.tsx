import { useTranslation } from 'react-i18next'
import { Eye, Download } from 'lucide-react'

export type ProductionStatsData = {
  totalViews: number
  totalDownloads: number
  firstPublishedAt: string | null
  lastModifiedAt: string | null
  viewsByDay: { date: string; count: number }[]
}

/**
 * Statistiques d'une production (panel admin — FR27) : totaux, dates clés et évolution des
 * vues sur 30 jours. Graphique en CSS pur (0 dépendance) + table sr-only pour l'accessibilité.
 */
export default function ProductionStats({ stats }: { stats: ProductionStatsData }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US'

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  // État vide factuel quand aucune donnée (AC#3).
  if (stats.totalViews === 0 && stats.totalDownloads === 0) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-900">{t('productions.stats.heading')}</h2>
        <p className="mt-2 text-sm text-stone-500">{t('productions.stats.empty')}</p>
      </section>
    )
  }

  const max = Math.max(1, ...stats.viewsByDay.map((d) => d.count))

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">{t('productions.stats.heading')}</h2>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-stone-500">
            <Eye className="size-4" aria-hidden /> {t('productions.stats.views')}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-stone-900">{stats.totalViews}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-stone-500">
            <Download className="size-4" aria-hidden /> {t('productions.stats.downloads')}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-stone-900">{stats.totalDownloads}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">
            {t('productions.stats.first_published')}
          </dt>
          <dd className="mt-1 text-sm text-stone-900">{fmtDate(stats.firstPublishedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">
            {t('productions.stats.last_modified')}
          </dt>
          <dd className="mt-1 text-sm text-stone-900">{fmtDate(stats.lastModifiedAt)}</dd>
        </div>
      </dl>

      <h3 className="mt-6 text-sm font-medium text-stone-700">
        {t('productions.stats.evolution_30d')}
      </h3>
      <div className="mt-2 flex h-32 items-end gap-0.5" aria-hidden>
        {stats.viewsByDay.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t bg-green-700"
            style={{ height: d.count === 0 ? '0%' : `${Math.max(4, (d.count / max) * 100)}%` }}
            title={t('productions.stats.day_views', { date: d.date, count: d.count })}
          />
        ))}
      </div>

      {/* Représentation accessible (lecteurs d'écran) du graphique ci-dessus. */}
      <table className="sr-only">
        <caption>{t('productions.stats.evolution_30d')}</caption>
        <thead>
          <tr>
            <th>{t('productions.stats.date')}</th>
            <th>{t('productions.stats.views')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.viewsByDay.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
