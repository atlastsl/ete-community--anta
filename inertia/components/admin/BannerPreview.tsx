import { useTranslation } from 'react-i18next'
import FeaturedBanner, { type FeaturedBannerCard } from '~/components/shared/FeaturedBanner'
import { formatAuthorName } from '~/lib/author_form'
import {
  type FeaturedItem,
  authorLabels,
  displayedItems,
  previewImage,
  waitingSlots,
} from '~/lib/featured'

type Props = {
  /** Slots of the page, unsaved state included, in order. */
  items: FeaturedItem[]
}

/**
 * Content width of the public home (`max-w-7xl` 1280 px minus `px-6`: 1232 px, the width the
 * banner `sizes` are computed on) and preview scale (1232 × 0.62 ≈ 764 px, fits the admin
 * container `max-w-5xl`). Corrected in the review of 11.6 (was 1152 px).
 */
const PUBLIC_WIDTH = 1232
const SCALE = 0.62

/**
 * Banner preview of the featured page (Story 11.4, DESIGN.md:379, D-11.4-9): the **real**
 * banner render (`components/shared/FeaturedBanner`, shared with the public home of 11.6) in
 * the public container width, scaled down (CSS `zoom`), built from the **valid** slots only
 * (published, with a thumbnail or an extracted frame), with a status line naming the slots
 * waiting for their thumbnail. Not interactive: no link (no `href`), the render is hidden
 * from assistive technologies, the status line carries the information.
 */
export default function BannerPreview({ items }: Props) {
  const { t, i18n } = useTranslation()
  const shown = displayedItems(items)
  const waiting = waitingSlots(items)

  const status =
    shown.length === 0 && waiting.length === 0
      ? t('featured.preview.none')
      : [
          t('featured.preview.shown', { count: shown.length }),
          waiting.length > 0
            ? t('featured.preview.waiting', { count: waiting.length, slots: waiting.join(', ') })
            : null,
        ]
          .filter(Boolean)
          .join(' — ')

  const cards: FeaturedBannerCard[] = shown.map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: previewImage(item),
    authors: authorLabels(item.authors, formatAuthorName),
    viewsCount: item.viewsCount,
    downloadsCount: item.downloadsCount,
  }))

  return (
    <section className="mt-10" aria-labelledby="featured-preview-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="featured-preview-heading" className="font-display text-lg text-stone-900">
          {t('featured.preview.heading')}
        </h2>
        <span className="text-xs text-stone-600">{status}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-background p-5">
        {cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-500">{t('featured.preview.none')}</p>
        ) : (
          <div aria-hidden="true" className="pointer-events-none select-none">
            <div style={{ width: PUBLIC_WIDTH, zoom: SCALE }}>
              <FeaturedBanner
                cards={cards}
                locale={i18n.language}
                labels={{
                  by: t('featured.preview.by'),
                  views: t('featured.preview.views'),
                  downloads: t('featured.preview.downloads'),
                }}
              />
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-stone-500">{t('featured.preview.layouts')}</p>
    </section>
  )
}
