import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, FileText } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import type { LibraryStatsData, StatsTopRow } from '~/lib/stats'

type Props = { stats: LibraryStatsData }

function MetricCard({ icon, label, value }: { icon: ReactElement; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-3xl font-semibold text-stone-900">{value}</p>
    </div>
  )
}

function TopTable({ title, rows }: { title: string; rows: StatsTopRow[] }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
            <th scope="col" className="pb-2">
              {t('stats.col_title')}
            </th>
            <th scope="col" className="pb-2 text-right">
              {t('stats.col_views')}
            </th>
            <th scope="col" className="pb-2 text-right">
              {t('stats.col_downloads')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-2 text-stone-500">
                —
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-stone-100">
                <td className="py-2 pr-2">
                  <a href={`/productions/${row.slug}`} className="text-green-700 hover:underline">
                    {row.title}
                  </a>
                </td>
                <td className="py-2 text-right tabular-nums">{row.views}</td>
                <td className="py-2 text-right tabular-nums">{row.downloads}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}

export default function AdminStatsIndex({ stats }: Props) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-stone-900">{t('stats.heading')}</h1>

      {stats.totalPublished === 0 ? (
        <p className="mt-4 text-stone-500">{t('stats.empty')}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<FileText className="size-4" aria-hidden />}
              label={t('stats.total_published')}
              value={stats.totalPublished}
            />
            <MetricCard
              icon={<Eye className="size-4" aria-hidden />}
              label={t('stats.total_views')}
              value={stats.totalViews}
            />
            <MetricCard
              icon={<Download className="size-4" aria-hidden />}
              label={t('stats.total_downloads')}
              value={stats.totalDownloads}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopTable title={t('stats.top_viewed')} rows={stats.topViewed} />
            <TopTable title={t('stats.top_downloaded')} rows={stats.topDownloaded} />
          </div>

          <section className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-stone-900">{t('stats.evolution_30d')}</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th scope="col" className="pb-2">
                    {t('stats.col_date')}
                  </th>
                  <th scope="col" className="pb-2 text-right">
                    {t('stats.col_views')}
                  </th>
                  <th scope="col" className="pb-2 text-right">
                    {t('stats.col_downloads')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.evolution.map((d) => (
                  <tr key={d.date} className="border-t border-stone-100">
                    <td className="py-1.5">{d.date}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.views}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.downloads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

AdminStatsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
