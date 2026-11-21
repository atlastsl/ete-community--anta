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
/** Option d'une facette : valeur d'URL + libellé affiché. */
export type FacetOption = { value: string; label: string }
/**
 * Facettes du listing : valeurs brutes par dimension, sauf `author` (Story 10.6, D12) =
 * `{ value: slug, label: "Prénom NOM" }` des seuls auteurs visibles.
 */
export type Facets = Record<Exclude<FilterDimension, 'author'>, string[]> & {
  author: FacetOption[]
}

/**
 * Options d'une dimension sous une forme unique `{ value, label }` : les auteurs portent leur
 * libellé (serveur) ; les autres valeurs passent par `labelOf` (traduction de taxonomie).
 */
export function facetOptions(
  facets: Facets,
  dimension: FilterDimension,
  labelOf: (dimension: FilterDimension, value: string) => string
): FacetOption[] {
  if (dimension === 'author') return facets.author ?? []
  return (facets[dimension] ?? []).map((value) => ({ value, label: labelOf(dimension, value) }))
}

/**
 * Nombre maximal d'auteurs filtrés à la fois : au-delà de 20 valeurs répétées, `qs`
 * (`arrayLimit: 20`) ne renvoie plus un tableau ; le serveur garde aussi les 20 premières.
 */
export const MAX_AUTHOR_FILTERS = 20

/** Ligatures et lettres barrées sans décomposition NFD (« œ » ne devient pas « oe »). */
const FOLDED_LETTERS: Record<string, string> = {
  œ: 'oe',
  æ: 'ae',
  ø: 'o',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
}

/** Clé de comparaison insensible à la casse, aux accents et aux ligatures (facette). */
function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[œæøßłđ]/g, (letter) => FOLDED_LETTERS[letter] ?? letter)
}

/**
 * Vrai si chaque mot saisi figure dans `label`, dans n'importe quel ordre (« nom prénom »
 * comme « prénom nom ») ; casse, accents et ligatures ignorés ; saisie vide = vrai.
 */
export function matchesFacetQuery(label: string, query: string): boolean {
  const haystack = foldText(label)
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

function parse(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

function toQueryString(params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Remplace les paramètres `author` de l'URL par les slugs retenus par le serveur
 * (`activeFilters.author`) : un slug ignoré (inconnu, non public, ancien nom libre, au-delà
 * de 20) n'est plus recopié par les bascules, la pagination ni le tri (Story 10.6).
 */
export function withActiveAuthors(search: string, authors: string[]): string {
  const params = parse(search)
  params.delete('author')
  for (const slug of authors) params.append('author', slug)
  return toQueryString(params)
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

/**
 * « Effacer les filtres » : retire les dimensions de filtre + `page`, conserve `q` et le
 * filtre auteur (la vue « productions de cet auteur » survit, D-10.6-2 amendée le
 * 2026-11-21). `includeAuthor` retire aussi `author` (sortie de l'état vide).
 */
export function clearFilters(search: string, { includeAuthor = false } = {}): string {
  const params = parse(search)
  for (const dimension of FILTER_DIMENSIONS) {
    if (dimension !== 'author' || includeAuthor) params.delete(dimension)
  }
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

/** Un filtre que `clearFilters` retire est actif (toute dimension sauf `author`). */
export function hasClearableFilters(activeFilters: ProductionFilters): boolean {
  return FILTER_DIMENSIONS.some(
    (dimension) => dimension !== 'author' && (activeFilters[dimension]?.length ?? 0) > 0
  )
}

export function isFilterActive(
  activeFilters: ProductionFilters,
  dimension: FilterDimension,
  value: string
): boolean {
  return (activeFilters[dimension] ?? []).includes(value)
}
