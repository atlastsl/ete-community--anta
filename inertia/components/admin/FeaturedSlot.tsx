import { type Ref, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowDown, ArrowUp, ImageOff, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import ThumbnailField from '~/components/admin/ThumbnailField'
import ProductionPicker from '~/components/admin/ProductionPicker'
import { cn } from '~/lib/utils'
import { taxonomyLabel } from '~/lib/taxonomy'
import { formatAuthorName } from '~/lib/author_form'
import {
  type FeaturedItem,
  authorLabels,
  imageStateOf,
  isMissingThumbnail,
  previewImage,
} from '~/lib/featured'

type Props = {
  /** Rank 1..3 (1 = large format in the banner). */
  position: number
  item: FeaturedItem | null
  /** Free slot that carries the picker (the first free one; the following show a placeholder). */
  withPicker?: boolean
  excludeIds?: string[]
  onSelect?: (item: FeaturedItem) => void
  pickerInputRef?: Ref<HTMLInputElement>
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  /** Page-level lock (D-11.4-1): another visit is running. */
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
  /** A thumbnail was uploaded or removed: the page refreshes the slot states (D-11.4-2). */
  onThumbnailChange?: () => void
}

/**
 * One featured slot of the admin page (Story 11.4, D20, D26, D30, mockup `admin-featured.html`).
 * Free: dashed border + `ProductionPicker` (first free slot) or « Free slot ». Filled: rank
 * badge, 16:9 image (thumbnail, else the extracted video frame with its caption, else an
 * icon), title, authors, « Category · Domain », badge « Shown » / « Missing thumbnail », named
 * ↑ ↓ buttons (swap with the neighbour) and « Remove » (local change, no confirmation:
 * D-11.4-3), and an inline `ThumbnailField` (preview hidden, the slot shows the image) — the
 * only entry point of the thumbnail (D37). A missing required thumbnail adds a warning around
 * the field.
 */
export default function FeaturedSlot({
  position,
  item,
  withPicker = false,
  excludeIds = [],
  onSelect,
  pickerInputRef,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled = false,
  onBusyChange,
  onThumbnailChange,
}: Props) {
  const { t } = useTranslation()
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const rank = (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700"
      aria-label={t('featured.position', { n: position })}
    >
      {position}
    </span>
  )

  if (!item) {
    return (
      <li className="rounded-lg border-2 border-dashed border-stone-300 bg-white p-4">
        <div className="flex gap-4">
          {rank}
          <div className="min-w-0 flex-1">
            {withPicker && onSelect ? (
              <>
                <h3 className="mb-2 font-display text-lg font-semibold text-stone-900">
                  {t('featured.add_heading')}
                </h3>
                <ProductionPicker
                  id={`featured-picker-${position}`}
                  excludeIds={excludeIds}
                  onSelect={onSelect}
                  disabled={disabled}
                  inputRef={pickerInputRef}
                />
              </>
            ) : (
              <p className="py-1.5 text-sm text-stone-500">{t('featured.empty_slot')}</p>
            )}
          </div>
        </div>
      </li>
    )
  }

  const missing = isMissingThumbnail(item)
  const unavailable = item.unavailable
  const warning = missing || unavailable
  const state = imageStateOf(item)
  const authors = authorLabels(item.authors, formatAuthorName)
  const src = previewImage(item)
  const meta = [
    taxonomyLabel(t, 'categories', item.category),
    taxonomyLabel(t, 'domains', item.domain),
  ]
    .filter(Boolean)
    .join(' · ')
  const field = (
    <ThumbnailField
      productionId={item.id}
      previewUrl={item.thumbnailPreviewUrl}
      hasThumbnail={item.hasThumbnail}
      posterPreviewUrl={item.posterPreviewUrl}
      showPreview={false}
      disabled={disabled}
      onBusyChange={onBusyChange}
      onChange={onThumbnailChange}
    />
  )

  return (
    <li
      className={cn(
        'rounded-lg border p-4',
        warning ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'
      )}
    >
      <div className="flex gap-4">
        {rank}
        <figure className="w-40 shrink-0">
          {missing ? (
            // Mockup: dashed « Vignette requise » box in place of the image.
            <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-amber-300 bg-white text-center text-xs text-amber-800">
              <ImageOff className="size-5 shrink-0" aria-hidden="true" />
              {t('featured.thumbnail_required')}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-stone-200">
              {src && failedSrc !== src ? (
                <img
                  src={src}
                  alt=""
                  width={160}
                  height={90}
                  className="size-full object-cover"
                  onError={() => setFailedSrc(src)}
                />
              ) : (
                <ImageOff className="size-5 text-stone-400" aria-hidden="true" />
              )}
            </div>
          )}
          {state === 'poster' && (
            <figcaption className="mt-1 text-xs text-stone-500">
              {t('thumbnail.extracted')}
            </figcaption>
          )}
        </figure>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-[1.375] text-stone-900">
                {item.title}
              </p>
              {authors.length > 0 && (
                <p className="mt-1 text-sm text-stone-600">{authors.join(', ')}</p>
              )}
              {meta && (
                <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">{meta}</p>
              )}
            </div>
            {unavailable ? (
              <span className="shrink-0 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
                {t('featured.badges.unavailable')}
              </span>
            ) : missing ? (
              <span className="shrink-0 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
                {t('featured.badges.missing')}
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-green-600 px-2 py-0.5 text-xs font-medium text-green-700">
                {t('featured.badges.shown')}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-featured-id={item.id}
            data-featured-action="up"
            aria-label={t('featured.actions.move_up', { title: item.title })}
            disabled={disabled || !canMoveUp}
            onClick={onMoveUp}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            data-featured-id={item.id}
            data-featured-action="down"
            aria-label={t('featured.actions.move_down', { title: item.title })}
            disabled={disabled || !canMoveDown}
            onClick={onMoveDown}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            data-featured-id={item.id}
            data-featured-action="remove"
            aria-label={t('featured.actions.remove_label', { title: item.title })}
            disabled={disabled}
            onClick={onRemove}
          >
            <X className="size-4" aria-hidden="true" />
            {t('featured.actions.remove')}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {unavailable && (
          <p className="mb-3 flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{t('featured.unavailable_notice')}</span>
          </p>
        )}
        {missing ? (
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <p className="mb-3 flex items-start gap-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span>{t('featured.missing_notice')}</span>
            </p>
            {field}
          </div>
        ) : (
          field
        )}
      </div>
    </li>
  )
}
