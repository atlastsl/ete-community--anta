import { ReactElement } from 'react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import Pagination from '~/components/shared/Pagination'

type LogRow = {
  id: string
  adminEmail: string | null
  actionType: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string | null
}

type PaginationMeta = { currentPage: number; lastPage: number; total: number; perPage: number }

type Props = {
  logs: LogRow[]
  pagination: PaginationMeta
  currentAdminId: string | null
  currentActionType: string | null
  admins: { id: string; email: string }[]
  actionTypes: string[]
}

const ALL_VALUE = 'all'

export default function AdminActivityLogsIndex({
  logs,
  pagination,
  currentAdminId,
  currentActionType,
  admins,
  actionTypes,
}: Props) {
  const { t, i18n } = useTranslation()

  const activeQuery: Record<string, string | undefined> = {
    adminId: currentAdminId ?? undefined,
    actionType: currentActionType ?? undefined,
  }
  const hasActiveFilters = Object.values(activeQuery).some(Boolean)

  function applyFilters(overrides: Record<string, string | undefined>) {
    const merged = { ...activeQuery, ...overrides }
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(merged)) if (value) params[key] = value
    router.get('/admin/activity', params, { preserveState: true, preserveScroll: true })
  }

  function selectValue(value: string, key: string) {
    applyFilters({ [key]: value === ALL_VALUE ? undefined : value })
  }

  const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US') : '—'

  const resourceLabel = (log: LogRow) =>
    log.resourceType
      ? `${log.resourceType} #${(log.resourceId ?? '').slice(0, 8)}`
      : '—'

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
        <ScrollText className="size-6 text-green-700" aria-hidden />
        {t('activity.heading')}
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Select value={currentAdminId ?? ALL_VALUE} onValueChange={(v) => selectValue(v, 'adminId')}>
          <SelectTrigger className="w-64" aria-label={t('activity.filter_admin')}>
            <SelectValue placeholder={t('activity.filter_admin')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('activity.all')}</SelectItem>
            {admins.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentActionType ?? ALL_VALUE}
          onValueChange={(v) => selectValue(v, 'actionType')}
        >
          <SelectTrigger className="w-56" aria-label={t('activity.filter_action')}>
            <SelectValue placeholder={t('activity.filter_action')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('activity.all')}</SelectItem>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`activity.action.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={() => router.get('/admin/activity', {}, { preserveScroll: true })}
          >
            {t('activity.clear')}
          </Button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="mt-8 text-stone-500">{t('activity.empty')}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="px-4 py-3">
                  {t('activity.col_admin')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('activity.col_action')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('activity.col_resource')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('activity.col_date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-stone-100">
                  <td className="px-4 py-2.5 text-stone-900">{log.adminEmail ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary">{t(`activity.action.${log.actionType}`)}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{resourceLabel(log)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={pagination.currentPage}
        lastPage={pagination.lastPage}
        queryParams={activeQuery}
      />
    </div>
  )
}

AdminActivityLogsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
