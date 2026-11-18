import { formatAuthorName } from '~/lib/author_form'

/**
 * An author of the production form picker (Story 9.7): a result of
 * `GET /admin/authors/search` or a selected author reloaded from the pivot. Mirrors
 * `PickerAuthor` of `app/services/author_service.ts` (the server code is not importable
 * here, TS6305).
 */
export type PickerAuthor = {
  id: string
  name: string
  firstNames: string
  lastNames: string
  primaryInstitution: string | null
  primaryDepartment: string | null
  isIncomplete: boolean
  isPublic: boolean
  photoUrl: string | null
}

/** Shortest search term (the server returns nothing below). */
export const AUTHOR_SEARCH_MIN_LENGTH = 2
/** Debounce of the search requests, in milliseconds (EXPERIENCE.md). */
export const AUTHOR_SEARCH_DEBOUNCE_MS = 250

/** « Prénom NOM » (D13). */
export function pickerAuthorLabel(author: Pick<PickerAuthor, 'firstNames' | 'lastNames'>): string {
  return formatAuthorName(author.firstNames, author.lastNames)
}

/** First affiliation « Institution — Département », or `null` without affiliation. */
export function pickerAffiliationLabel(
  author: Pick<PickerAuthor, 'primaryInstitution' | 'primaryDepartment'>
): string | null {
  if (!author.primaryInstitution) return null
  return author.primaryDepartment
    ? `${author.primaryInstitution} — ${author.primaryDepartment}`
    : author.primaryInstitution
}

/** Moves the item at `index` by `delta` ranks; out of range → same array. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items]
  }
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
