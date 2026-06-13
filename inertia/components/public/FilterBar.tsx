import { useTranslation } from 'react-i18next'
import { usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import FilterChip from './FilterChip'
import {
  FILTER_DIMENSIONS,
  toggleFilter,
  clearFilters,
  hasActiveFilters,
  isFilterActive,
  type Facets,
  type ProductionFilters,
} from '~/lib/search_query'
import { facetValueLabel, taxonomyLabel } from '~/lib/taxonomy'

type FilterBarProps = {
  /** Mode homepage : simple liste de catégories liant vers /productions?category=X. */
  categories?: string[]
  activeCategory?: string | null
  /** Mode listing : facettes multi-dimensions + filtres actifs (toggle piloté par l'URL). */
  facets?: Facets
  activeFilters?: ProductionFilters
}

export default function FilterBar({
  categories,
  activeCategory = null,
  facets,
  activeFilters,
}: FilterBarProps) {
  const { t } = useTranslation()
  const { url } = usePage()
  const search = url.includes('?') ? url.slice(url.indexOf('?')) : ''

  // --- Mode listing (/productions) : multi-dimensions + toggle + effacer ---
  if (facets && activeFilters) {
    const dimensions = FILTER_DIMENSIONS.filter((dim) => (facets[dim]?.length ?? 0) > 0)
    if (dimensions.length === 0) return null

    return (
      <div className="space-y-3">
        {dimensions.map((dim) => (
          <div
            key={dim}
            role="group"
            aria-label={t(`filters.dimensions.${dim}`)}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-stone-600">
              {t(`filters.dimensions.${dim}`)}
            </span>
            {facets[dim].map((value) => (
              <FilterChip
                key={value}
                label={facetValueLabel(t, dim, value)}
                href={`/productions${toggleFilter(search, dim, value)}`}
                active={isFilterActive(activeFilters, dim, value)}
              />
            ))}
          </div>
        ))}

        {hasActiveFilters(activeFilters) && (
          <Link
            href={`/productions${clearFilters(search)}`}
            className="text-sm text-green-700 hover:underline"
          >
            {t('actions.clear_filters')}
          </Link>
        )}
      </div>
    )
  }

  // --- Mode homepage : chips de catégories ---
  if (!categories || categories.length === 0) return null

  return (
    <div
      role="group"
      aria-label={t('filters.label')}
      className="flex snap-x gap-2 overflow-x-auto pb-1"
    >
      {categories.map((category) => (
        <FilterChip
          key={category}
          label={taxonomyLabel(t, 'categories', category)}
          href={`/productions?category=${encodeURIComponent(category)}`}
          active={category === activeCategory}
        />
      ))}
    </div>
  )
}
