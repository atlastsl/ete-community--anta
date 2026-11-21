import { type ReactNode, useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { cn } from '~/lib/utils'
import { bannerLayout } from '~/lib/featured'

/** One card of the banner: strict FR49 content (image, title, authors, totals). */
export type FeaturedBannerCard = {
  id: string
  title: string
  /** Thumbnail, else extracted video frame; `null` → empty muted area. */
  imageUrl: string | null
  imageSrcSet?: string
  imageSizes?: string
  /** Display names, already formatted (« Prénom NOM », D13). */
  authors: string[]
  viewsCount: number
  downloadsCount: number
  /** Detail page: the title becomes the stretched link of the card. Absent → not interactive. */
  href?: string
}

type Props = {
  cards: FeaturedBannerCard[]
  /**
   * Texts of the entry point (the component is shared by the admin preview and the public
   * home, which have separate i18n instances): « Par » and the screen reader prefixes.
   */
  labels: { by: string; views: string; downloads: string }
  /** Locale of the totals. */
  locale: string
  /** `<section aria-label>` of the public banner; omitted → plain `div` (admin preview). */
  ariaLabel?: string
  /** Public byline with links (AuthorByline, 11.6); default: plain names. */
  renderAuthors?: (card: FeaturedBannerCard) => ReactNode
}

/**
 * Featured banner (D9, D35, FR48, FR49, mockup `home.html`), the one render shared by the
 * admin preview (`BannerPreview`, Story 11.4, at a reduced scale) and the public home
 * (`FeaturedBanner` wiring of Story 11.6). From `lg`: 1 = full width, 2 = two equal columns,
 * 3 = the first on 2/3 (its image stretched), the next two stacked in the remaining third,
 * same total height; below `lg`, stacked in order. No carousel. Title of the first slot in
 * `featured-title-lg`, the others in `card-title`; image 16:9 `object-cover`, `alt=""`; the
 * first image is eager + `fetchpriority="high"`, the others lazy.
 */
export default function FeaturedBanner({ cards, labels, locale, ariaLabel, renderAuthors }: Props) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const layout = bannerLayout(cards.length)
  if (layout === 'none') return null
  const format = (value: number) => value.toLocaleString(locale)

  const card = (item: FeaturedBannerCard, index: number) => {
    const lead = index === 0
    const stretched = layout === 'lead' && lead
    const src = item.imageUrl && !failed.has(item.imageUrl) ? item.imageUrl : null
    const article = (
      <article
        key={stretched ? undefined : item.id}
        className={cn(
          'group relative flex w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white transition-colors',
          item.href && 'hover:border-green-700 focus-within:border-green-700'
        )}
      >
        <div
          className={cn(
            'aspect-video w-full bg-stone-200',
            stretched && 'lg:aspect-auto lg:min-h-0 lg:flex-1'
          )}
        >
          {src && (
            <img
              src={src}
              srcSet={item.imageSrcSet}
              sizes={item.imageSizes}
              alt=""
              width={1600}
              height={900}
              loading={lead ? 'eager' : 'lazy'}
              fetchPriority={lead ? 'high' : 'auto'}
              className="size-full object-cover"
              onError={() => setFailed((previous) => new Set(previous).add(src))}
            />
          )}
        </div>
        <div className="p-5">
          <h3
            className={cn(
              'font-display font-semibold text-stone-900',
              lead ? 'line-clamp-3 text-2xl leading-[1.3]' : 'line-clamp-2 text-lg leading-[1.375]'
            )}
          >
            {item.href ? (
              <a
                href={item.href}
                className="after:absolute after:inset-0 group-hover:text-green-700"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>
          {item.authors.length > 0 && (
            <p className="relative z-10 mt-1 text-sm text-stone-600">
              {labels.by} {renderAuthors ? renderAuthors(item) : item.authors.join(', ')}
            </p>
          )}
          <div className="mt-3 flex gap-4 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" aria-hidden="true" />
              <span className="sr-only">{labels.views}</span>
              {format(item.viewsCount)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Download className="size-4" aria-hidden="true" />
              <span className="sr-only">{labels.downloads}</span>
              {format(item.downloadsCount)}
            </span>
          </div>
        </div>
      </article>
    )
    return stretched ? (
      <div key={item.id} className="flex lg:col-span-2 lg:row-span-2">
        {article}
      </div>
    ) : (
      article
    )
  }

  const grid = (
    <div
      className={cn(
        'grid grid-cols-1 gap-5',
        layout === 'columns' && 'lg:grid-cols-2',
        layout === 'lead' && 'lg:grid-cols-3 lg:grid-rows-2'
      )}
    >
      {cards.map(card)}
    </div>
  )

  return ariaLabel ? <section aria-label={ariaLabel}>{grid}</section> : grid
}
