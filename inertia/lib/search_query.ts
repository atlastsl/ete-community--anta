/**
 * Helpers purs de gestion de l'état d'URL des filtres du listing public.
 *
 * L'URL est la source de vérité : les filtres et la recherche vivent dans les query
 * params (`?q=...&category=A&category=B&language=fr`). Ces fonctions mutent la query
 * string courante en préservant les autres paramètres.
 *
 * NB : `FILTER_DIMENSIONS` est dupliqué côté serveur (`SearchService.ProductionFilters`)
 * — la frontière TS interdit d'importer le code serveur ici (cf. production_completion.ts).
 */
export const FILTER_DIMENSIONS = [
  'category',
  'domain',
  'subdomain',
  'author',
  'language',
  'country',
  'license',
] as const

export type FilterDimension = (typeof FILTER_DIMENSIONS)[number]
export type ProductionFilters = Record<FilterDimension, string[]>
export type Facets = Record<FilterDimension, string[]>

export const EMPTY_FILTERS_CLIENT: ProductionFilters = {
  category: [],
  domain: [],
  subdomain: [],
  author: [],
  language: [],
  country: [],
  license: [],
}

function parse(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

function toQueryString(params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Ajoute ou retire `value` pour `dimension`. Préserve `q` + les autres dimensions,
 * retire `page` (retour à la page 1). Retourne la query string (avec `?`) ou ''.
 */
export function toggleFilter(search: string, dimension: FilterDimension, value: string): string {
  const params = parse(search)
  const current = params.getAll(dimension)
  params.delete(dimension)
  params.delete('page')

  if (current.includes(value)) {
    for (const v of current) if (v !== value) params.append(dimension, v)
  } else {
    for (const v of current) params.append(dimension, v)
    params.append(dimension, value)
  }

  return toQueryString(params)
}

/** Retire toutes les dimensions de filtre + `page`. Conserve `q`. */
export function clearFilters(search: string): string {
  const params = parse(search)
  for (const dimension of FILTER_DIMENSIONS) params.delete(dimension)
  params.delete('page')
  return toQueryString(params)
}

/** Définit (ou retire si vide) le terme de recherche `q`. Préserve les filtres, retire `page`. */
export function setQuery(search: string, value: string): string {
  const params = parse(search)
  params.delete('page')
  if (value) params.set('q', value)
  else params.delete('q')
  return toQueryString(params)
}

/** Définit le critère de tri. Préserve `q` + filtres, retire `page` (retour page 1). */
export function setSort(search: string, value: string): string {
  const params = parse(search)
  params.delete('page')
  params.set('sort', value)
  return toQueryString(params)
}

/** Change uniquement la page, en préservant tout le reste (q + filtres + sort). */
export function setPage(search: string, page: number): string {
  const params = parse(search)
  params.set('page', String(page))
  return toQueryString(params)
}

export function hasActiveFilters(activeFilters: ProductionFilters): boolean {
  return FILTER_DIMENSIONS.some((dimension) => (activeFilters[dimension]?.length ?? 0) > 0)
}

export function isFilterActive(
  activeFilters: ProductionFilters,
  dimension: FilterDimension,
  value: string
): boolean {
  return (activeFilters[dimension] ?? []).includes(value)
}
