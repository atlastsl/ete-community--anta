import { ReactElement, useEffect, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { BookUser, Plus, Search } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import AuthorStatusBadges from '~/components/admin/AuthorStatusBadges'
import DeleteAuthorDialog, { type DeleteAuthorTarget } from '~/components/admin/DeleteAuthorDialog'
import Pagination from '~/components/shared/Pagination'
import { formatAuthorName } from '~/lib/author_form'
import { cn } from '~/lib/utils'
import { urlFor } from '~/client'

type AuthorRow = {
  id: string
  firstNames: string
  lastNames: string
  primaryAffiliation: { institution: string; department: string | null } | null
  updatedAt: string | null
  /** Pivot rows, every production status included (FR55). */
  productionsCount: number
  isPublic: boolean
  isIncomplete: boolean
}

type Props = {
  authors: AuthorRow[]
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
  /** Normalized filters echoed by the server (`institution` = key). */
  filters: {
    q: string | null
    institution: string | null
    consent: 'pending' | null
    incomplete: boolean
  }
  /** Global counters of the quick filters. */
  counts: { consentPending: number; incomplete: number }
  institutionOptions: { value: string; label: string }[]
}

/** Radix `Select` refuses `value=""`: sentinel for "all institutions". */
// Not a plausible `institution_key` (`all` is: an institution named « All »).
const ALL_VALUE = '__all__'

export default function AdminAuthorsIndex({
  authors,
  pagination,
  filters,
  counts,
  institutionOptions,
}: Props) {
  const { t, i18n } = useTranslation()
  const [searchText, setSearchText] = useState(filters.q ?? '')
  // preserveState keeps the input across visits: follow the server value (back/forward, clear).
  useEffect(() => setSearchText(filters.q ?? ''), [filters.q])
  const [deleteTarget, setDeleteTarget] = useState<DeleteAuthorTarget | null>(null)

  // Active filters, kept by the pagination links.
  const activeQuery: Record<string, string | undefined> = {
    q: filters.q ?? undefined,
    institution: filters.institution ?? undefined,
    consent: filters.consent ?? undefined,
    incomplete: filters.incomplete ? '1' : undefined,
  }
  const hasActiveFilters = Object.values(activeQuery).some(Boolean)

  /** Merges the overrides, drops empty values and goes back to page 1 (no `page`). */
  function applyFilters(overrides: Record<string, string | undefined>) {
    const merged = { ...activeQuery, ...overrides }
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(merged)) if (value) params[key] = value
    router.get(urlFor('admin.authors'), params, { preserveState: true, preserveScroll: true })
  }

  function clearFilters() {
    setSearchText('')
    router.get(urlFor('admin.authors'), {}, { preserveScroll: true })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    applyFilters({ q: searchText.trim() || undefined })
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US') : '—'

  const createButton = (
    <Link href={urlFor('admin.authors.create')}>
      <Button className="bg-green-700 hover:bg-green-800 text-white">
        <Plus className="mr-1 size-4" aria-hidden />
        {t('authors.create_button')}
      </Button>
    </Link>
  )

  const quickFilters = [
    {
      key: 'consent',
      active: filters.consent === 'pending',
      value: 'pending',
      label: t('authors.list.consent_pending'),
      count: counts.consentPending,
      countClass: 'bg-stone-100 text-stone-700',
    },
    {
      key: 'incomplete',
      active: filters.incomplete,
      value: '1',
      label: t('authors.list.incomplete'),
      count: counts.incomplete,
      countClass: 'bg-amber-100 text-amber-800',
    },
  ]

  // Empty referential (no author at all, no filter): the 9.1 empty state.
  const isEmptyReferential = pagination.total === 0 && !hasActiveFilters

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-stone-900">{t('authors.heading')}</h1>
          {!isEmptyReferential && createButton}
        </div>

        {isEmptyReferential ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookUser className="size-12 text-stone-300" aria-hidden />
            <p className="mt-4 text-lg font-medium text-stone-700">{t('authors.empty_title')}</p>
            <p className="mt-1 text-sm text-stone-500">{t('authors.empty_description')}</p>
            <div className="mt-6">{createButton}</div>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="relative min-w-[16rem] flex-1"
              >
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                  aria-hidden
                />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('authors.list.search_label')}
                  aria-label={t('authors.list.search_label')}
                  className="pl-9"
                />
              </form>

              <Select
                value={
                  institutionOptions.some((o) => o.value === filters.institution)
                    ? filters.institution!
                    : ALL_VALUE
                }
                onValueChange={(v) => applyFilters({ institution: v === ALL_VALUE ? undefined : v })}
              >
                <SelectTrigger aria-label={t('authors.list.institution_label')} className="w-56">
                  <SelectValue placeholder={t('authors.list.institution_label')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL_VALUE}>{t('authors.list.institution_all')}</SelectItem>
                  {institutionOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div
                role="group"
                aria-label={t('authors.list.quick_filters')}
                className="flex flex-wrap gap-2"
              >
                {quickFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={f.active}
                    onClick={() => applyFilters({ [f.key]: f.active ? undefined : f.value })}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2',
                      f.active
                        ? 'border-green-700 bg-green-700 text-white'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs tabular-nums',
                        f.active ? 'bg-white/20 text-white' : f.countClass
                      )}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  {t('authors.list.clear_filters')}
                </Button>
              )}
            </div>

            {authors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-lg font-medium text-stone-700">{t('authors.list.no_results')}</p>
                <Button variant="outline" className="mt-6" onClick={clearFilters}>
                  {t('authors.list.clear_filters')}
                </Button>
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('authors.table.author')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('authors.table.primary_affiliation')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('authors.table.productions')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('authors.table.status')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('authors.table.updated_at')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('authors.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {authors.map((author) => {
                        const editHref = urlFor('admin.authors.edit', { id: author.id })
                        const primary = author.primaryAffiliation
                        const hintId = `author-delete-hint-${author.id}`
                        const blockedText = t('authors.delete.blocked', {
                          count: author.productionsCount,
                        })
                        return (
                          <tr key={author.id} className="border-b border-stone-100 last:border-0">
                            <td className="px-4 py-3 font-medium text-stone-900">
                              <Link
                                href={editHref}
                                className="hover:text-green-700 hover:underline"
                              >
                                {formatAuthorName(author.firstNames, author.lastNames)}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-stone-600">
                              {primary ? (
                                [primary.institution, primary.department]
                                  .filter(Boolean)
                                  .join(' — ')
                              ) : (
                                <span className="text-stone-500">{t('authors.no_affiliation')}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                              {author.productionsCount}
                            </td>
                            <td className="px-4 py-3">
                              <AuthorStatusBadges
                                isPublic={author.isPublic}
                                isIncomplete={author.isIncomplete}
                              />
                            </td>
                            <td className="px-4 py-3 text-stone-600">
                              {formatDate(author.updatedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Link href={editHref}>
                                  <Button variant="outline" size="sm">
                                    {t('authors.actions.edit')}
                                  </Button>
                                </Link>
                                {author.productionsCount === 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => setDeleteTarget(author)}
                                  >
                                    {t('authors.actions.delete')}
                                  </Button>
                                ) : (
                                  <>
                                    {/* aria-disabled (not disabled): stays focusable, so the
                                        tooltip also opens on keyboard focus. */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          aria-disabled="true"
                                          aria-describedby={`author-delete-hint-${author.id}`}
                                          className="cursor-not-allowed text-red-600 opacity-50 hover:bg-transparent hover:text-red-600"
                                          onClick={(e) => e.preventDefault()}
                                        >
                                          {t('authors.actions.delete')}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{blockedText}</TooltipContent>
                                    </Tooltip>
                                    <span id={hintId} className="sr-only">
                                      {blockedText}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
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
          </>
        )}

        <DeleteAuthorDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      </div>
    </TooltipProvider>
  )
}

AdminAuthorsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
