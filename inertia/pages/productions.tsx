import { useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import SearchBar from '~/components/public/SearchBar'
import FilterSidebar from '~/components/public/FilterSidebar'
import ProductionCard, { ProductionCardData } from '~/components/public/ProductionCard'
import ListingToggle, { ListingView } from '~/components/public/ListingToggle'
import Pagination from '~/components/shared/Pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  setQuery,
  setSort,
  setPage,
  clearFilters,
  hasActiveFilters,
  withActiveAuthors,
  type Facets,
  type ProductionFilters,
} from '~/lib/search_query'
import type { SeoMeta } from '~/lib/seo'

const VIEW_KEY = 'anta:productions-view'
const SORT_VALUES = ['relevance', 'date', 'views', 'downloads'] as const

type ProductionsProps = {
  results: ProductionCardData[]
  approximate: boolean
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
  facets: Facets
  activeFilters: ProductionFilters
  q: string | null
  sort: string
  meta?: SeoMeta
}

function readStoredView(): ListingView {
  try {
    if (typeof window === 'undefined') return 'list'
    return window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

export default function Productions({
  results,
  approximate,
  pagination,
  facets,
  activeFilters,
  q,
  sort,
}: ProductionsProps) {
  const { t } = useTranslation()
  const { url } = usePage()
  // Auteurs de l'URL remplacés par ceux retenus par le serveur : un slug ignoré n'est
  // recopié ni par la pagination, ni par le tri, ni par la recherche (Story 10.6).
  const search = withActiveAuthors(
    url.includes('?') ? url.slice(url.indexOf('?')) : '',
    activeFilters.author
  )
  const [view, setView] = useState<ListingView>(readStoredView)

  function changeView(next: ListingView) {
    setView(next)
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // stockage indisponible — la préférence ne sera juste pas persistée
    }
  }

  function handleSearch(query: string) {
    router.visit(`/productions${setQuery(search, query)}`)
  }

  function handleSort(value: string) {
    router.visit(`/productions${setSort(search, value)}`)
  }

  const grid = (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((production) => (
        <ProductionCard key={production.id} production={production} variant="grid" />
      ))}
    </div>
  )
  const list = (
    <div className="flex flex-col gap-4">
      {results.map((production) => (
        <ProductionCard key={production.id} production={production} variant="list" />
      ))}
    </div>
  )

  // Annonce du nombre de résultats (flux 5) : région toujours montée, hors des branches
  // résultats / aucun résultat / approchants, mise à jour par les bascules (preserveState).
  const announcement =
    results.length === 0
      ? q
        ? t('productions.no_results_for', { term: q })
        : t('productions.no_results')
      : approximate
        ? t('productions.approximate_notice', { term: q })
        : t('productions.results_count', { count: pagination.total })

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="sr-only">{t('productions.heading')}</h1>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <SearchBar defaultValue={q ?? ''} onSubmit={handleSearch} />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <FilterSidebar facets={facets} activeFilters={activeFilters} />

        <div className="min-w-0 flex-1">
          {results.length === 0 ? (
            <div className="mt-8 text-center">
              <p className="text-stone-500">
                {q ? t('productions.no_results_for', { term: q }) : t('productions.no_results')}
              </p>
              {hasActiveFilters(activeFilters) && (
                <Link
                  href={`/productions${clearFilters(search)}`}
                  className="mt-3 inline-block text-sm text-green-700 hover:underline"
                >
                  {t('productions.reset_filters')}
                </Link>
              )}
            </div>
          ) : approximate ? (
            <>
              <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t('productions.approximate_notice', { term: q })}
              </p>
              <div className="mb-4 flex justify-end">
                <ListingToggle value={view} onChange={changeView} />
              </div>
              {view === 'grid' ? grid : list}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-stone-600" aria-hidden="true">
                  {t('productions.results_count', { count: pagination.total })}
                </p>
                <div className="flex items-center gap-3">
                  <Select value={sort} onValueChange={handleSort}>
                    <SelectTrigger aria-label={t('sort.label')} className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_VALUES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`sort.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ListingToggle value={view} onChange={changeView} />
                </div>
              </div>

              <div className="mt-6">{view === 'grid' ? grid : list}</div>

              <Pagination
                currentPage={pagination.currentPage}
                lastPage={pagination.lastPage}
                buildHref={(p) => `/productions${setPage(search, p)}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
