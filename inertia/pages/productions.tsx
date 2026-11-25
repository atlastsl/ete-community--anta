import { useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import SearchBar from '~/components/public/SearchBar'
import FilterSidebar from '~/components/public/FilterSidebar'
import ProductionCard, { ProductionCardData } from '~/components/public/ProductionCard'
import ListingToggle, { ListingView } from '~/components/public/ListingToggle'
import Pagination from '~/components/shared/Pagination'
import SortSelect from '~/components/shared/SortSelect'
import {
  LISTING_SORTS,
  setQuery,
  setSort,
  setPage,
  clearFilters,
  hasActiveFilters,
  hasClearableFilters,
  withActiveAuthors,
  type Facets,
  type ProductionFilters,
} from '~/lib/search_query'
import type { SeoMeta } from '~/lib/seo'

const VIEW_KEY = 'anta:productions-view'
/** Ancre du haut des résultats (retour après un changement de tri, 12.1). */
const RESULTS_ID = 'listing-results'

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
    // Page 1, valeur par défaut omise (`setSort`). `preserveState` : pas de remontage, le focus
    // clavier reste sur #listing-sort (le Select le rend au déclencheur) ; vue, recherche et
    // groupes de filtres dépliés gardent leur état (comme les bascules de FilterSidebar).
    // Défilement ramené en haut des résultats s'ils commencent sous l'en-tête collant
    // (décalage = `scroll-mt-24` de l'ancre), sinon gardé (12.1, D-12.1-7).
    router.visit(`/productions${setSort(search, value)}`, {
      preserveState: true,
      preserveScroll: true,
      onSuccess: () => {
        const results = document.getElementById(RESULTS_ID)
        if (!results) return
        const offset = Number.parseFloat(getComputedStyle(results).scrollMarginTop) || 0
        if (results.getBoundingClientRect().top < offset) {
          results.scrollIntoView({ block: 'start' })
        }
      },
    })
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
              {/* Le filtre auteur reste, sauf s'il est le seul : il faut alors une sortie. */}
              {hasActiveFilters(activeFilters) && (
                <Link
                  href={`/productions${clearFilters(search, {
                    includeAuthor: !hasClearableFilters(activeFilters),
                  })}`}
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
              <div
                id={RESULTS_ID}
                className="flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
              >
                <p className="text-sm text-stone-600" aria-hidden="true">
                  {t('productions.results_count', { count: pagination.total })}
                </p>
                <div className="flex items-end gap-3">
                  {/* Tris D34 ; « Pertinence » masquée sans recherche (D-12.1-4, PO 2026-11-25). */}
                  <SortSelect
                    id="listing-sort"
                    value={sort}
                    onChange={handleSort}
                    className="flex-1 sm:w-56 sm:flex-none"
                    options={LISTING_SORTS.filter((value) => value !== 'relevance' || q).map(
                      (value) => ({ value, label: t(`listing.sort.${value}`) })
                    )}
                  />
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
