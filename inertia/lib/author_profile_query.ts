/**
 * URLs of an author profile (Story 10.3). Pure helpers: the default sort and page 1 are
 * omitted from the URL. Values duplicated from `PublicAuthorService` (TS boundary, TS6305).
 */
export const PROFILE_SORTS = ['date', 'views', 'downloads', 'title'] as const
export type ProfileSort = (typeof PROFILE_SORTS)[number]
export const DEFAULT_PROFILE_SORT = 'date'

function profileUrl(slug: string, sort: string, page: number): string {
  const params = new URLSearchParams()
  if (sort !== DEFAULT_PROFILE_SORT) params.set('sort', sort)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/authors/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
}

/** A sort change always goes back to page 1. */
export function sortHref(slug: string, sort: string): string {
  return profileUrl(slug, sort, 1)
}

/** Numbered pagination keeps the sort. */
export function pageHref(slug: string, sort: string, page: number): string {
  return profileUrl(slug, sort, page)
}
