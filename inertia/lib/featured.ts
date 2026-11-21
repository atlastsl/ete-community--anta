/**
 * Pure logic of the featured page (Story 11.4, FR47, FR50, D20, D26, D30, D35). No import:
 * loaded at runtime by its unit test. `FeaturedItem` mirrors `app/services/featured_service.ts`
 * (the server code is not importable here, TS6305).
 */
export const FEATURED_MAX_SLOTS = 3

export type FeaturedImageState = 'thumbnail' | 'poster' | 'missing'

/** A card of the referential (« Prénom NOM », D13) or an unmatched denormalized name. */
export type FeaturedAuthor = { firstNames: string; lastNames: string } | { name: string }

export type FeaturedItem = {
  id: string
  title: string
  authors: FeaturedAuthor[]
  category: string | null
  domain: string | null
  imageState: FeaturedImageState
  /** `thumbnail_key` is set (true even when its URL could not be signed). */
  hasThumbnail: boolean
  /** FR50: no hosted video with an extracted frame. */
  requiresThumbnail: boolean
  /** Signed `w800` previews (admin only). */
  thumbnailPreviewUrl: string | null
  posterPreviewUrl: string | null
  /** Totals of the banner card (FR49). */
  viewsCount: number
  downloadsCount: number
  /** Not published (any more): blocks the save, never shown by the banner. */
  unavailable: boolean
}

/** The featured page component (Inertia), to recognise the response of its own save. */
export const FEATURED_PAGE_COMPONENT = 'admin/Featured/Index'

/**
 * Display names of the authors: cards through `format` (`formatAuthorName`, « Prénom NOM »,
 * D13/D34; passed in to keep this module import-free), unmatched names as stored.
 */
export function authorLabels(
  authors: readonly FeaturedAuthor[],
  format: (firstNames: string, lastNames: string) => string
): string[] {
  return authors.map((author) =>
    'name' in author ? author.name : format(author.firstNames, author.lastNames)
  )
}

/** Same rule as the server: thumbnail, else extracted frame, else missing. */
export function imageStateOf(
  item: Pick<FeaturedItem, 'hasThumbnail' | 'requiresThumbnail'>
): FeaturedImageState {
  if (item.hasThumbnail) return 'thumbnail'
  return item.requiresThumbnail ? 'missing' : 'poster'
}

/** The slot blocks the save: no thumbnail while one is required (D26). */
export function isMissingThumbnail(item: Pick<FeaturedItem, 'hasThumbnail' | 'requiresThumbnail'>) {
  return imageStateOf(item) === 'missing'
}

/** Image shown for the item: the thumbnail wins (even unsigned), else the extracted frame. */
export function previewImage(item: FeaturedItem): string | null {
  if (item.hasThumbnail) return item.thumbnailPreviewUrl
  return item.requiresThumbnail ? null : item.posterPreviewUrl
}

export type SlotIssue = 'unavailable' | 'missing'

/** Why a slot cannot be saved: not published (first), or missing required thumbnail. */
export function slotIssue(
  item: Pick<FeaturedItem, 'hasThumbnail' | 'requiresThumbnail' | 'unavailable'>
): SlotIssue | null {
  if (item.unavailable) return 'unavailable'
  return isMissingThumbnail(item) ? 'missing' : null
}

/** Slots that block the save, with their position (1..n) and reason. */
export function slotIssues(
  items: readonly FeaturedItem[]
): { position: number; issue: SlotIssue }[] {
  return items.flatMap((item, index) => {
    const issue = slotIssue(item)
    return issue ? [{ position: index + 1, issue }] : []
  })
}

/** Positions (1..n) of the slots that block the save. */
export function blockedSlots(items: readonly FeaturedItem[]): number[] {
  return slotIssues(items).map((entry) => entry.position)
}

/** Positions (1..n) of the slots waiting for their thumbnail (BannerPreview status line). */
export function waitingSlots(items: readonly FeaturedItem[]): number[] {
  return slotIssues(items)
    .filter((entry) => entry.issue === 'missing')
    .map((entry) => entry.position)
}

/** Slots the banner would show (BannerPreview): the valid ones only, in order. */
export function displayedItems(items: readonly FeaturedItem[]): FeaturedItem[] {
  return items.filter((item) => slotIssue(item) === null)
}

/** The slots differ from the saved selection (order or content). */
export function isDirty(baseline: readonly string[], items: readonly FeaturedItem[]): boolean {
  return (
    baseline.length !== items.length || items.some((item, index) => item.id !== baseline[index])
  )
}

/** Swaps the slot at `index` with its neighbour; out of range → same order (new array). */
export function moveSlot<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  const next = [...items]
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Removes the slot at `index`: the following ones move up (D30). */
export function removeSlot<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index)
}

/**
 * Fresh states (`candidates?ids[]=`, any status) replace the slots with the same id, in the
 * slot order; a production absent from the answer was deleted meanwhile: its slot is
 * dropped (the following move up), never kept with a stale state.
 */
export function mergeRefreshed(
  items: readonly FeaturedItem[],
  refreshed: readonly FeaturedItem[]
): FeaturedItem[] {
  const byId = new Map(refreshed.map((item) => [item.id, item]))
  return items.flatMap((item) => {
    const fresh = byId.get(item.id)
    return fresh ? [fresh] : []
  })
}

export type BannerLayout = 'none' | 'single' | 'columns' | 'lead'

/**
 * Banner layout from `lg` (D35): 1 = full width, 2 = two equal columns, 3 = the first on 2/3
 * and the next two stacked in the remaining third. Shared with `FeaturedBanner` (11.6).
 */
export function bannerLayout(count: number): BannerLayout {
  if (count <= 0) return 'none'
  if (count === 1) return 'single'
  if (count === 2) return 'columns'
  return 'lead'
}

/**
 * A visit started by the page itself (D-11.4-8), recognised by method + path, never by a
 * page-wide counter (a sidebar link clicked during an upload must still be confirmed): the
 * save (`PUT /admin/featured`) or a thumbnail visit (`POST` / `DELETE
 * /admin/productions/<id>/thumbnail`) of a production in a slot.
 */
export function isOwnVisit(
  visit: { method: string; pathname: string },
  productionIds: readonly string[]
): boolean {
  const method = visit.method.toLowerCase()
  const path = visit.pathname.replace(/\/+$/, '')
  if (method === 'put') return path === '/admin/featured'
  if (method !== 'post' && method !== 'delete') return false
  const match = /^\/admin\/productions\/([^/]+)\/thumbnail$/.exec(path)
  return match !== null && productionIds.includes(decodeURIComponent(match[1]).toLowerCase())
}

/** Leaving asks for a confirmation with unsaved slots, except for the page's own visits. */
export function shouldConfirmLeave(state: { dirty: boolean; ownVisit: boolean }): boolean {
  return state.dirty && !state.ownVisit
}

/**
 * The save really succeeded: the answer is the featured page and its saved selection is the
 * one sent. Anything else (CSRF expiry redirected back with the old selection, session expiry
 * → login page) is a failure: the local slots are kept.
 */
export function saveSucceeded(answer: {
  component: string
  sentIds: readonly string[]
  selection: readonly { id: string }[] | null | undefined
}): boolean {
  if (answer.component !== FEATURED_PAGE_COMPONENT || !Array.isArray(answer.selection)) {
    return false
  }
  const saved = answer.selection.map((item) => item.id.toLowerCase())
  const sent = answer.sentIds.map((id) => id.toLowerCase())
  return saved.length === sent.length && saved.every((id, index) => id === sent[index])
}

/**
 * Message of a refused save: the key and, when the server named it, the refused slot
 * (`position` entry of the bag → `<key>_slot` with `{{n}}`).
 */
export function saveError(
  errors: Record<string, unknown> | null | undefined,
  fallback: string
): { key: string; position: number | null } {
  const key = firstErrorKey(errors ? { productionIds: errors.productionIds } : null, '')
  const raw = errors?.position
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return {
    key: key || firstErrorKey(errors ? withoutPosition(errors) : null, fallback),
    position: Number.isInteger(value) && value > 0 ? value : null,
  }
}

function withoutPosition(errors: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(errors).filter(([field]) => field !== 'position'))
}

/**
 * i18n key of a failed save: the `productionIds` error, else any error of the bag (an
 * element such as `productionIds.1`), else `fallback`.
 */
export function firstErrorKey(
  errors: Record<string, unknown> | null | undefined,
  fallback: string
): string {
  if (!errors) return fallback
  const values = [errors.productionIds, ...Object.values(errors)]
  for (const value of values) {
    const key = Array.isArray(value) ? value[0] : value
    if (typeof key === 'string' && key.length > 0) return key
  }
  return fallback
}
