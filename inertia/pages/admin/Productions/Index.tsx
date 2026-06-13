import { ReactElement, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Library, Search } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '~/components/ui/dialog'
import StatusBadge from '~/components/admin/StatusBadge'
import Pagination from '~/components/shared/Pagination'
import { languageLabel } from '~/lib/languages'
import { taxonomyLabel } from '~/lib/taxonomy'

type ProductionStatus = 'draft' | 'published' | 'unpublished'

type ProductionRow = {
  id: string
  title: string
  authors: string[]
  category: string | null
  status: ProductionStatus
  updatedAt: string | null
}

type PaginationMeta = {
  currentPage: number
  lastPage: number
  total: number
  perPage: number
}

type Props = {
  productions: ProductionRow[]
  pagination: PaginationMeta
  currentStatus: ProductionStatus | null
  q: string | null
  currentCategory: string | null
  currentDomain: string | null
  currentLanguage: string | null
  filterOptions: { categories: string[]; domains: string[]; languages: string[] }
}

const ALL_VALUE = 'all'

export default function AdminProductionsIndex({
  productions,
  pagination,
  currentStatus,
  q,
  currentCategory,
  currentDomain,
  currentLanguage,
  filterOptions,
}: Props) {
  const { t, i18n } = useTranslation()
  const [searchText, setSearchText] = useState(q ?? '')
  const [unpublishTarget, setUnpublishTarget] = useState<ProductionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductionRow | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Paramètres de filtre actifs (préservés à chaque navigation/pagination).
  const activeQuery: Record<string, string | undefined> = {
    status: currentStatus ?? undefined,
    q: q ?? undefined,
    category: currentCategory ?? undefined,
    domain: currentDomain ?? undefined,
    language: currentLanguage ?? undefined,
  }
  const hasActiveFilters = Object.values(activeQuery).some(Boolean)

  function applyFilters(overrides: Record<string, string | undefined>) {
    const merged = { ...activeQuery, ...overrides }
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(merged)) if (value) params[key] = value
    router.get('/admin/productions', params, { preserveState: true, preserveScroll: true })
  }

  function selectValue(value: string, key: string) {
    applyFilters({ [key]: value === ALL_VALUE ? undefined : value })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    applyFilters({ q: searchText.trim() || undefined })
  }

  const visitOptions = {
    preserveScroll: true,
    onStart: () => setIsProcessing(true),
    onFinish: () => setIsProcessing(false),
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'

  function handleConfirmUnpublish() {
    if (unpublishTarget) {
      router.post(`/admin/productions/${unpublishTarget.id}/unpublish`, {}, visitOptions)
      setUnpublishTarget(null)
    }
  }

  function handleConfirmDelete() {
    if (deleteTarget) {
      router.delete(`/admin/productions/${deleteTarget.id}`, visitOptions)
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">{t('productions.title')}</h1>
        <Link href="/admin/productions/create">
          <Button className="bg-green-700 hover:bg-green-800 text-white">
            {t('productions.create_button')}
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form onSubmit={handleSearchSubmit} role="search" className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('productions.search_placeholder')}
            aria-label={t('productions.search_placeholder')}
            className="pl-9"
          />
        </form>

        <Select value={currentStatus ?? ALL_VALUE} onValueChange={(v) => selectValue(v, 'status')}>
          <SelectTrigger aria-label={t('productions.filter.label')} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t('productions.filter.all')}</SelectItem>
            <SelectItem value="draft">{t('productions.status.draft')}</SelectItem>
            <SelectItem value="published">{t('productions.status.published')}</SelectItem>
            <SelectItem value="unpublished">{t('productions.status.unpublished')}</SelectItem>
          </SelectContent>
        </Select>

        {(
          [
            { key: 'category', value: currentCategory, options: filterOptions.categories },
            { key: 'domain', value: currentDomain, options: filterOptions.domains },
            { key: 'language', value: currentLanguage, options: filterOptions.languages },
          ] as const
        ).map((f) => (
          <Select key={f.key} value={f.value ?? ALL_VALUE} onValueChange={(v) => selectValue(v, f.key)}>
            <SelectTrigger aria-label={t(`productions.form.fields.${f.key}`)} className="w-44">
              <SelectValue placeholder={t(`productions.form.fields.${f.key}`)} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_VALUE}>{t(`productions.form.fields.${f.key}`)}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {f.key === 'language'
                    ? languageLabel(o)
                    : f.key === 'category'
                      ? taxonomyLabel(t, 'categories', o)
                      : f.key === 'domain'
                        ? taxonomyLabel(t, 'domains', o)
                        : o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={() => router.get('/admin/productions', {}, { preserveScroll: true })}
          >
            {t('productions.filter.clear')}
          </Button>
        )}
      </div>

      {productions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Library className="size-12 text-stone-300" aria-hidden />
          <p className="mt-4 text-lg font-medium text-stone-700">{t('productions.empty_title')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('productions.empty_description')}</p>
          <Link href="/admin/productions/create">
            <Button className="mt-6 bg-green-700 hover:bg-green-800 text-white">
              {t('productions.create_button')}
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                  <th className="px-4 py-3 font-medium">{t('productions.table.title')}</th>
                  <th className="px-4 py-3 font-medium">{t('productions.table.authors')}</th>
                  <th className="px-4 py-3 font-medium">{t('productions.table.category')}</th>
                  <th className="px-4 py-3 font-medium">{t('productions.table.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('productions.table.updated_at')}</th>
                  <th className="px-4 py-3 font-medium">{t('productions.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {productions.map((production) => (
                  <tr key={production.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-stone-900">{production.title}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {production.authors.length > 0 ? production.authors.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {production.category
                        ? taxonomyLabel(t, 'categories', production.category)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={production.status} />
                    </td>
                    <td className="px-4 py-3 text-stone-600">{formatDate(production.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/admin/productions/${production.id}/edit`}>
                          <Button variant="outline" size="sm">
                            {t('productions.actions.edit')}
                          </Button>
                        </Link>
                        {production.status === 'published' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => setUnpublishTarget(production)}
                          >
                            {t('productions.actions.unpublish')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isProcessing}
                          onClick={() => setDeleteTarget(production)}
                        >
                          {t('productions.actions.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            lastPage={pagination.lastPage}
            queryParams={activeQuery}
          />
        </>
      )}

      <Dialog
        open={!!unpublishTarget}
        onOpenChange={(open) => !open && setUnpublishTarget(null)}
      >
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('productions.unpublish_modal.title')}</DialogTitle>
            <DialogDescription>{t('productions.unpublish_modal.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('actions.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isProcessing}
              onClick={handleConfirmUnpublish}
            >
              {t('productions.unpublish_modal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>{t('productions.delete_modal.title')}</DialogTitle>
            <DialogDescription>{t('productions.delete_modal.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('actions.cancel')}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={isProcessing} onClick={handleConfirmDelete}>
              {t('productions.delete_modal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

AdminProductionsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
