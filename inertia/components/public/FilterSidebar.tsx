import { useState, type KeyboardEvent } from 'react'
import { router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '~/lib/utils'
import {
  FILTER_DIMENSIONS,
  facetOptions,
  matchesFacetQuery,
  toggleFilter,
  clearFilters,
  hasActiveFilters,
  isFilterActive,
  type FacetOption,
  type Facets,
  type FilterDimension,
  type ProductionFilters,
} from '~/lib/search_query'
import { facetValueLabel } from '~/lib/taxonomy'

function CheckboxRow({ label, href, active }: { label: string; href: string; active: boolean }) {
  // Bascule au clavier (flux 5) : Entrée suit le lien natif ; Espace bascule aussi, comme
  // `FilterChip` (un lien ignore Espace par défaut et ferait défiler la page).
  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === ' ') {
      event.preventDefault()
      router.visit(href)
    }
  }

  return (
    <Link
      href={href}
      aria-pressed={active}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-2 py-1.5 text-sm text-stone-700 hover:text-green-700"
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border',
          active ? 'border-green-700 bg-green-700 text-white' : 'border-stone-300'
        )}
      >
        {active && <Check className="size-3" aria-hidden />}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function DimensionGroup({
  dim,
  options,
  activeFilters,
  search,
}: {
  dim: FilterDimension
  options: FacetOption[]
  activeFilters: ProductionFilters
  search: string
}) {
  const { t } = useTranslation()
  const [authorQuery, setAuthorQuery] = useState('')
  const activeCount = activeFilters[dim].length
  const isAuthor = dim === 'author'
  // Auteurs : recherche sur le libellé « Prénom NOM », casse et accents ignorés (10.6).
  const shown = isAuthor
    ? options.filter((option) => matchesFacetQuery(option.label, authorQuery))
    : options

  return (
    <details className="border-b border-stone-200 py-3" open={activeCount > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-stone-900 [&::-webkit-details-marker]:hidden">
        <span>
          {t(`filters.dimensions.${dim}`)}
          {activeCount > 0 && <span className="ml-1 text-green-700">({activeCount})</span>}
        </span>
        <ChevronDown className="size-4 text-stone-400" aria-hidden />
      </summary>

      <div className="mt-2 max-h-60 overflow-y-auto pr-1">
        {isAuthor && (
          <input
            type="search"
            value={authorQuery}
            onChange={(e) => setAuthorQuery(e.target.value)}
            placeholder={t('filters.author_search')}
            aria-label={t('filters.author_search')}
            className="mb-2 h-9 w-full rounded-md border border-stone-300 px-2 text-sm outline-none focus:border-green-700"
          />
        )}
        {shown.map((option) => (
          <CheckboxRow
            key={option.value}
            label={option.label}
            active={isFilterActive(activeFilters, dim, option.value)}
            href={`/productions${toggleFilter(search, dim, option.value)}`}
          />
        ))}
        {shown.length === 0 && <p className="py-1 text-xs text-stone-400">—</p>}
      </div>
    </details>
  )
}

export default function FilterSidebar({
  facets,
  activeFilters,
}: {
  facets: Facets
  activeFilters: ProductionFilters
}) {
  const { t } = useTranslation()
  const { url } = usePage()
  const search = url.includes('?') ? url.slice(url.indexOf('?')) : ''
  const [open, setOpen] = useState(false)

  const dimensions = FILTER_DIMENSIONS.filter((d) => (facets[d]?.length ?? 0) > 0)
  const totalActive = FILTER_DIMENSIONS.reduce((n, d) => n + (activeFilters[d]?.length ?? 0), 0)

  if (dimensions.length === 0) return null

  return (
    <aside className="lg:w-64 lg:shrink-0">
      {/* Bascule mobile */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between rounded-md border border-stone-300 px-4 py-2 text-sm font-medium lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden />
          {t('filters.title')}
          {totalActive > 0 && ` (${totalActive})`}
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'rounded-lg border border-stone-200 bg-white p-4 lg:block',
          open ? 'block' : 'hidden'
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base text-stone-900">{t('filters.title')}</h2>
          {hasActiveFilters(activeFilters) && (
            <Link
              href={`/productions${clearFilters(search)}`}
              className="text-xs text-green-700 hover:underline"
            >
              {t('actions.clear_filters')}
            </Link>
          )}
        </div>
        <div className="mt-1">
          {dimensions.map((dim) => (
            <DimensionGroup
              key={dim}
              dim={dim}
              options={facetOptions(facets, dim, (d, value) => facetValueLabel(t, d, value))}
              activeFilters={activeFilters}
              search={search}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
