import { useTranslation } from 'react-i18next'
import { urlFor } from '~/client'
import SharedFeaturedBanner, { type FeaturedBannerCard } from '~/components/shared/FeaturedBanner'
import AuthorByline from '~/components/public/AuthorByline'
import type { AuthorCredit } from '~/components/public/ProductionCard'
import { bannerImage, bannerSlot } from '~/lib/media'

/** Banner cards show 3 authors, then « et {n} autres », like the other cards (D36, D-11.6-6). */
const BANNER_MAX_AUTHORS = 3

/** Prop `featured` of the home page (`FeaturedBannerItem` of `app/services/featured_service.ts`). */
export type FeaturedBannerItem = {
  id: string
  slug: string
  title: string
  authors: AuthorCredit[]
  /** Public base `/media/thumbnails/…` or `/media/posters/…`; variants added by `bannerImage`. */
  imageUrl: string
  viewsCount: number
  downloadsCount: number
}

/**
 * Public wiring of the featured banner (Story 11.6, FR48, FR49, FR59, D-11.6-1): the shared
 * render (`components/shared/FeaturedBanner`, also used by the admin preview) with the public
 * texts, the region named by a visually hidden `<h2>`, the linked byline (`AuthorByline`), the
 * responsive image of each slot (`bannerImage`) and the detail link of each title. Renders
 * nothing without items (no reserved space).
 */
export default function FeaturedBanner({ items }: { items: FeaturedBannerItem[] }) {
  const { t, i18n } = useTranslation()
  if (items.length === 0) return null

  const credits = new Map(items.map((item) => [item.id, item.authors]))
  const cards: FeaturedBannerCard[] = items.map((item, index) => {
    const image = bannerImage(item.imageUrl, bannerSlot(index, items.length))
    return {
      id: item.id,
      title: item.title,
      imageUrl: image?.src ?? null,
      imageSrcSet: image?.srcSet,
      imageSizes: image?.sizes,
      authors: item.authors.map((author) => author.name),
      viewsCount: item.viewsCount,
      downloadsCount: item.downloadsCount,
      href: urlFor('production.show', { slug: item.slug }),
    }
  })

  return (
    <div className="mt-8">
      <SharedFeaturedBanner
        cards={cards}
        locale={i18n.language}
        heading={t('featured.region')}
        labels={{
          by: t('featured.by'),
          views: t('featured.views'),
          downloads: t('featured.downloads'),
        }}
        renderAuthors={(card) => (
          <AuthorByline authors={credits.get(card.id) ?? []} max={BANNER_MAX_AUTHORS} />
        )}
      />
    </div>
  )
}
