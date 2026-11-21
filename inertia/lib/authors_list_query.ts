/**
 * URLs of the authors list (Story 10.5). Pure helpers: the state lives in the URL, the default
 * sort, empty filters and page 1 are omitted, and any filter or sort change goes back to page 1.
 * Mirror of `PublicAuthorService.authorsListPath` (server redirect of an out-of-range page): TS
 * boundary (TS6305), keep both in sync.
 */
export const AUTHORS_LIST_SORTS = ['views', 'name', 'productions'] as const
export type AuthorsListSort = (typeof AUTHORS_LIST_SORTS)[number]
export const DEFAULT_AUTHORS_LIST_SORT = 'views'

export type AuthorsListState = {
  q: string | null
  institution: string | null
  domain: string | null
  sort: string
}

function listUrl(base: string, state: AuthorsListState, page: number): string {
  const params = new URLSearchParams()
  const q = state.q?.trim()
  if (q) params.set('q', q)
  if (state.institution) params.set('institution', state.institution)
  if (state.domain) params.set('domain', state.domain)
  if (state.sort !== DEFAULT_AUTHORS_LIST_SORT) params.set('sort', state.sort)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `${base}${qs ? `?${qs}` : ''}`
}

/** A filter, search or sort change: new state, always page 1. */
export function filtersHref(base: string, state: AuthorsListState): string {
  return listUrl(base, state, 1)
}

/** Numbered pagination keeps the filters and the sort. */
export function pageHref(base: string, state: AuthorsListState, page: number): string {
  return listUrl(base, state, page)
}
