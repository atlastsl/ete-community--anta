import { useId, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '~/components/ui/button'
import { urlFor } from '~/client'
import { notify } from '~/lib/notify'
import { cn } from '~/lib/utils'
import {
  THUMBNAIL_ACCEPT,
  emptyVisitTrace,
  thumbnailErrorKey,
  validateThumbnailFile,
  visitOutcome,
  type VisitTrace,
} from '~/lib/thumbnail'

type Props = {
  productionId: string
  /** Signed preview URL of the saved thumbnail (`w800`); `null` without one or if signing failed. */
  previewUrl: string | null
  /** A thumbnail is saved (from `thumbnail_key`: true even when its URL could not be signed). */
  hasThumbnail?: boolean
  /**
   * Signed preview (`w800`) of the frame extracted from the production's hosted video
   * (`PosterService.signedUrl` of `PosterService.displayed`, Story 11.3); shown only without
   * a thumbnail, with the « Image extraite de la vidéo » caption (D10).
   */
  posterPreviewUrl?: string | null
  /** Called after a successful upload or removal (the page props are already refreshed). */
  onChange?: () => void
  disabled?: boolean
}

/**
 * Records the global `invalid` / `exception` events fired while one visit runs (Inertia 2.3
 * has no per-visit hook for them); `stop` removes the listeners.
 */
function traceVisit(): { trace: VisitTrace; stop: () => void } {
  const trace = emptyVisitTrace()
  const offInvalid = router.on('invalid', () => {
    trace.invalidResponse = true
  })
  const offException = router.on('exception', () => {
    trace.exception = true
  })
  return {
    trace,
    stop: () => {
      offInvalid()
      offException()
    },
  }
}

/**
 * Thumbnail of a production (Story 11.1, D36, D37): immediate upload with progress, client
 * type/size check, 16:9 preview cropped like the banner, Replace / Remove. Mounted by the
 * featured slots only (Story 11.4), never by the production form.
 *
 * Visits keep the page state (`preserveState`): the unsaved featured slots survive an upload
 * (D20). Server errors are read from this field's own visit (`onError`), never from the page
 * props, so several fields on one page do not show each other's errors. The success toast
 * comes from the visit too (the server flashes none). Only a request without any HTTP
 * response (`inertia:exception`) is a network failure: persistent error toast.
 *
 * Without a thumbnail, a hosted video's extracted frame is previewed with its caption
 * (Story 11.3, D10); it cannot be removed (it follows the video), only covered by uploading
 * a thumbnail (D-11.3-6).
 */
export default function ThumbnailField({
  productionId,
  previewUrl,
  hasThumbnail = !!previewUrl,
  posterPreviewUrl = null,
  onChange,
  disabled = false,
}: Props) {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const busy = disabled || progress !== null || removing
  const inputId = `${id}-thumbnail`
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = error ? `${helpId} ${errorId}` : helpId
  const showPreview = hasThumbnail && previewUrl !== null && failedSrc !== previewUrl
  // The figure and its caption stay when the poster fails to load (placeholder instead).
  const showPoster = !hasThumbnail && posterPreviewUrl !== null
  const posterLoaded = showPoster && failedSrc !== posterPreviewUrl

  function resetInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function upload(file: File) {
    if (busy) return
    const invalid = validateThumbnailFile(file)
    if (invalid) {
      setError(`thumbnail.errors.${invalid}`)
      resetInput()
      return
    }
    setError(null)
    const { trace, stop } = traceVisit()
    router.post(
      urlFor('admin.productions.thumbnail.store', { productionId }),
      { thumbnail: file },
      {
        forceFormData: true,
        preserveState: true,
        preserveScroll: true,
        onStart: () => setProgress(0),
        onProgress: (event) => setProgress(event?.percentage ?? 0),
        onSuccess: () => {
          trace.succeeded = true
        },
        onError: (errors) => {
          trace.failed = true
          setError(thumbnailErrorKey(errors))
        },
        onCancel: () => {
          trace.cancelled = true
          stop()
          setProgress(null)
          resetInput()
        },
        onFinish: () => {
          stop()
          setProgress(null)
          resetInput()
          settle(trace, 'thumbnail.uploaded')
        },
      }
    )
  }

  /** Toasts and inline error once the visit is over (see `visitOutcome`). */
  function settle(trace: VisitTrace, successKey: string) {
    const outcome = visitOutcome(trace)
    if (outcome === 'success') {
      notify.success(t(successKey))
      onChange?.()
    } else if (outcome === 'network') {
      notify.error(t('thumbnail.errors.network'))
    } else if (outcome === 'http_error') {
      setError('thumbnail.errors.storage')
    }
  }

  function remove() {
    if (busy) return
    setError(null)
    const { trace, stop } = traceVisit()
    router.delete(urlFor('admin.productions.thumbnail.destroy', { productionId }), {
      preserveState: true,
      preserveScroll: true,
      onStart: () => setRemoving(true),
      onSuccess: () => {
        trace.succeeded = true
      },
      onError: (errors) => {
        trace.failed = true
        setError(thumbnailErrorKey(errors))
      },
      onCancel: () => {
        trace.cancelled = true
        stop()
        setRemoving(false)
      },
      onFinish: () => {
        stop()
        setRemoving(false)
        settle(trace, 'thumbnail.removed')
      },
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'rounded-lg border-2 border-dashed p-4 transition-colors',
        isDragOver ? 'border-green-700 bg-green-50' : 'border-stone-300 bg-stone-50'
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {hasThumbnail && (
          <div className="aspect-video w-full shrink-0 overflow-hidden rounded-md bg-stone-100 sm:w-48">
            {showPreview ? (
              <img
                src={previewUrl!}
                alt=""
                width={800}
                height={450}
                className="size-full object-cover"
                onError={() => setFailedSrc(previewUrl)}
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs text-stone-500">
                {t('thumbnail.preview_unavailable')}
              </span>
            )}
          </div>
        )}

        {showPoster && (
          <figure className="w-full shrink-0 sm:w-48">
            <div className="aspect-video overflow-hidden rounded-md bg-stone-100">
              {posterLoaded ? (
                <img
                  src={posterPreviewUrl!}
                  alt=""
                  width={800}
                  height={450}
                  className="size-full object-cover"
                  onError={() => setFailedSrc(posterPreviewUrl)}
                />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-stone-500">
                  {t('thumbnail.preview_unavailable')}
                </span>
              )}
            </div>
            <figcaption className="mt-1 text-xs text-stone-500">
              {t('thumbnail.extracted')}
            </figcaption>
          </figure>
        )}

        <div className="min-w-0 flex-1">
          {/* sr-only but focusable: carries aria-invalid; the label shows its focus ring. */}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={THUMBNAIL_ACCEPT}
            className="peer sr-only"
            disabled={busy}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={inputId}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                busy && 'pointer-events-none opacity-50'
              )}
            >
              <ImageUp className="size-4" aria-hidden />
              {hasThumbnail ? t('thumbnail.replace') : t('thumbnail.upload')}
            </label>
            {hasThumbnail && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={busy}
                onClick={remove}
              >
                {removing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                {t('thumbnail.remove')}
              </Button>
            )}
            {!hasThumbnail && (
              <span className="text-sm text-stone-500">{t('thumbnail.drop_hint')}</span>
            )}
          </div>
          <p id={helpId} className="mt-2 text-xs text-stone-500">
            {t('thumbnail.help')}
          </p>

          {progress !== null && (
            <div className="mt-3 w-full max-w-xs" aria-hidden="true">
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full bg-green-700 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-600">
                {t('thumbnail.uploading', { percent: progress })}
              </p>
            </div>
          )}
          {/* Always mounted (first message read), announced by quarters, not every percent. */}
          <p className="sr-only" aria-live="polite">
            {progress !== null &&
              t('thumbnail.uploading', { percent: Math.floor(progress / 25) * 25 })}
          </p>

          {error && (
            <p id={errorId} className="mt-2 text-sm text-red-600">
              {t(error, { defaultValue: error })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
