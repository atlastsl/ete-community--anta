/**
 * Client rules of `ThumbnailField` (Story 11.1), aligned with `thumbnail_validator.ts` and
 * `ImageService` (JPEG, PNG or WebP, 5 MB). Pure module (no import): loaded at runtime by
 * its unit test. The server decodes the file anyway (real format, pixel count).
 */
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024
export const THUMBNAIL_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const THUMBNAIL_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export type ThumbnailClientError = 'invalid_type' | 'too_large'

/** Suffix of the `thumbnail.errors.*` key, or `null` when the file may be sent. */
export function validateThumbnailFile(file: {
  name: string
  type: string
  size: number
}): ThumbnailClientError | null {
  // Some systems report no MIME type: fall back on the extension.
  const typeOk = file.type
    ? THUMBNAIL_MIME_TYPES.includes(file.type)
    : /\.(jpe?g|png|webp)$/i.test(file.name)
  if (!typeOk) return 'invalid_type'
  if (file.size > THUMBNAIL_MAX_BYTES) return 'too_large'
  return null
}

/**
 * What happened to one `ThumbnailField` visit, as observed through its callbacks and the
 * global `inertia:invalid` / `inertia:exception` events fired while it ran. Inertia 2.3 has no
 * per-visit network hook: `exception` (no HTTP response at all) is the only network failure.
 */
export type VisitTrace = {
  /** `onSuccess` ran (Inertia response without errors). */
  succeeded: boolean
  /** `onError` ran (Inertia response with an errors bag). */
  failed: boolean
  cancelled: boolean
  /** A non-Inertia HTTP response was received (`inertia:invalid`). */
  invalidResponse: boolean
  /** The request failed without any HTTP response (`inertia:exception`). */
  exception: boolean
}

export type VisitOutcome = 'success' | 'error' | 'cancelled' | 'network' | 'http_error'

export function emptyVisitTrace(): VisitTrace {
  return {
    succeeded: false,
    failed: false,
    cancelled: false,
    invalidResponse: false,
    exception: false,
  }
}

/**
 * Outcome of a finished visit. A visit that ends with neither callback is a network failure
 * only if `exception` fired; any HTTP response (non-Inertia page, unknown end) is `http_error`,
 * shown inline as a storage error, never as the network toast.
 */
export function visitOutcome(trace: VisitTrace): VisitOutcome {
  if (trace.cancelled) return 'cancelled'
  if (trace.failed) return 'error'
  if (trace.succeeded) return 'success'
  if (trace.exception && !trace.invalidResponse) return 'network'
  return 'http_error'
}

/** i18n key of a server error bag: the `thumbnail` field, else the generic storage error. */
export function thumbnailErrorKey(errors: Record<string, string> | null | undefined): string {
  const key = errors?.thumbnail
  return typeof key === 'string' && key.length > 0 ? key : 'thumbnail.errors.storage'
}
