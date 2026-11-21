import { type ReactNode, useId, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
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

type Labels = { by: string; views: string; downloads: string }

type Props = {
  cards: FeaturedBannerCard[]
  /**
   * Texts of the entry point (the component is shared by the admin preview and the public
   * home, which have separate i18n instances): « Par » and the screen reader prefixes.
   */
  labels: Labels
  /** Locale of the totals. */
  locale: string
  /**
   * Name of the public banner region: `<section aria-labelledby>` pointing to a visually
   * hidden `<h2>` (heading order h1 → h2 → h3 on the home page; card titles stay `h3`).
   * Omitted → plain `div` (admin preview, already under its own `h2`).
   */
  heading?: string
  /** Public byline with links (AuthorByline, 11.6); default: plain names. */
  renderAuthors?: (card: FeaturedBannerCard) => ReactNode
}

type CardProps = {
  item: FeaturedBannerCard
  /** First card: larger title, eager image with `fetchpriority="high"` (probable LCP). */
  lead: boolean
  /** First card of a banner of 3 from `lg`: its image fills the height of the two stacked. */
  stretched: boolean
  labels: Labels
  format: (value: number) => string
  renderAuthors?: (card: FeaturedBannerCard) => ReactNode
}

/**
 * One card of the banner (FeaturedCard, D9, FR49): image on top, text below on white. The
 * title is the only main link, its pseudo-element covers the card (stretched link); the
 * authors sit above it (`relative z-10`), never nested in it; keyboard focus of the title
 * outlines the whole card (DESIGN.md:360); the title's own outline is removed only where
 * `:has()` is supported (`app.css`), so a browser without it keeps the link outline. A stretched image is absolutely positioned from
 * `lg` so it never adds to the intrinsic height of the grid rows (D-11.6-3).
 */
function FeaturedCard({ item, lead, stretched, labels, format, renderAuthors }: CardProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = item.imageUrl && item.imageUrl !== failedSrc ? item.imageUrl : null

  return (
    <article
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-white transition-colors',
        item.href &&
          'hover:border-green-700 focus-within:border-green-700 has-[[data-featured-link]:focus-visible]:outline-2 has-[[data-featured-link]:focus-visible]:outline-offset-2 has-[[data-featured-link]:focus-visible]:outline-ring'
      )}
    >
      <div
        className={cn(
          'aspect-video w-full bg-stone-200',
          stretched && 'lg:relative lg:aspect-auto lg:min-h-0 lg:flex-1'
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
            className={cn('size-full object-cover', stretched && 'lg:absolute lg:inset-0')}
            onError={() => setFailedSrc(src)}
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
            <Link
              href={item.href}
              data-featured-link=""
              className="after:absolute after:inset-0 group-hover:text-green-700"
            >
              {item.title}
            </Link>
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
}

/**
 * Featured banner (D9, D35, FR48, FR49, mockup `home.html`), the one render shared by the
 * admin preview (`BannerPreview`, Story 11.4, at a reduced scale) and the public home
 * (`components/public/FeaturedBanner`, Story 11.6). From `lg`: 1 = full width, 2 = two equal
 * columns, 3 = the first on 2/3 (its image stretched), the next two stacked in the remaining
 * third, same total height; below `lg`, stacked in order. No carousel. Title of the first
 * slot in `featured-title-lg`, the others in `card-title`; image 16:9 `object-cover`,
 * `alt=""`; the first image is eager + `fetchpriority="high"`, the others lazy.
 */
export default function FeaturedBanner({ cards, labels, locale, heading, renderAuthors }: Props) {
  const headingId = useId()
  const layout = bannerLayout(cards.length)
  if (layout === 'none') return null
  const format = (value: number) => value.toLocaleString(locale)

  const grid = (
    <div
      className={cn(
        'grid grid-cols-1 gap-5',
        layout === 'columns' && 'lg:grid-cols-2',
        layout === 'lead' && 'lg:grid-cols-3 lg:grid-rows-2'
      )}
    >
      {cards.map((item, index) => {
        const stretched = layout === 'lead' && index === 0
        const card = (
          <FeaturedCard
            key={item.id}
            item={item}
            lead={index === 0}
            stretched={stretched}
            labels={labels}
            format={format}
            renderAuthors={renderAuthors}
          />
        )
        return stretched ? (
          <div key={item.id} className="flex lg:col-span-2 lg:row-span-2">
            {card}
          </div>
        ) : (
          card
        )
      })}
    </div>
  )

  return heading ? (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {heading}
      </h2>
      {grid}
    </section>
  ) : (
    grid
  )
}
