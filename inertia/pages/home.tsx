import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import SearchBar from '~/components/public/SearchBar'
import ProductionCard, { type ProductionCardData } from '~/components/public/ProductionCard'
import FeaturedBanner, { type FeaturedBannerItem } from '~/components/public/FeaturedBanner'
import HomeBlock from '~/components/public/HomeBlock'
import AuthorCard, { type AuthorCardData } from '~/components/public/AuthorCard'
import { homeSearchHref } from '~/lib/search_query'
import type { SeoMeta } from '~/lib/seo'

type HomeProps = {
  /** Featured banner (Story 11.6): published featured productions, in order; `[]` → no banner. */
  featured: FeaturedBannerItem[]
  /** Blocks (Story 12.2): 3 cards at most each, totals shown; `[]` → block absent (FR46). */
  recent: ProductionCardData[]
  /** Ranked on the views / downloads of the last 365 days (D4, D5). */
  mostViewed: ProductionCardData[]
  mostDownloaded: ProductionCardData[]
  /** Visible authors most viewed over 365 days (Story 12.3, D36), total views on the cards (D3). */
  topAuthors: AuthorCardData[]
  meta?: SeoMeta
}

const productionKey = (production: ProductionCardData) => production.id
const productionCard = (production: ProductionCardData) => (
  <ProductionCard production={production} />
)
const authorKey = (author: AuthorCardData) => author.slug
const authorCard = (author: AuthorCardData) => <AuthorCard author={author} headingLevel="h3" />

/** Soumission → `/productions?q=…` ; barre vide → `/productions` (12.1, D8). */
function handleSearch(query: string) {
  router.visit(homeSearchHref(query))
}

export default function Home({
  featured,
  recent,
  mostViewed,
  mostDownloaded,
  topAuthors,
}: HomeProps) {
  const { t } = useTranslation()

  return (
    <div>
      <section className="rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-100 to-background px-6 py-12 text-center sm:py-16">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-green-700">
          {t('home.hero_eyebrow')}
        </p>
        <h1 className="font-display text-3xl leading-tight text-stone-900 sm:text-4xl">
          {t('home.tagline')}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-stone-600">{t('home.hero_subtitle')}</p>
        {/* SearchBar + « Recherche avancée » (12.1, D8, maquette home.html) : lien accolé à
            droite à partir de sm, sous la barre en pleine largeur en dessous ; même destination
            que le lien du pied de page. Puces de catégories supprimées. */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <SearchBar onSubmit={handleSearch} />
          </div>
          <Link
            href="/productions"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium text-stone-800 shadow-sm hover:border-green-700 hover:text-green-700 sm:w-auto"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t('home.hero.advanced_search')}
          </Link>
        </div>
      </section>

      <FeaturedBanner items={featured} />

      {/* Ordre FR9 sous la bannière (12.2) ; aucun dédoublonnage avec la une (D6). « Voir
          plus » → tris du listing (D28). */}
      <HomeBlock
        title={t('home.blocks.recent')}
        seeMoreHref="/productions?sort=date"
        items={recent}
        itemKey={productionKey}
        renderItem={productionCard}
      />
      <HomeBlock
        title={t('home.blocks.most_viewed')}
        windowed
        seeMoreHref="/productions?sort=views"
        items={mostViewed}
        itemKey={productionKey}
        renderItem={productionCard}
      />
      <HomeBlock
        title={t('home.blocks.most_downloaded')}
        windowed
        seeMoreHref="/productions?sort=downloads"
        items={mostDownloaded}
        itemKey={productionKey}
        renderItem={productionCard}
      />
      {/* 12.3 : « Voir plus » → liste des auteurs, tri par défaut (FR45, D-12.3-6). */}
      <HomeBlock
        title={t('home.blocks.authors')}
        windowed
        seeMoreHref="/authors"
        items={topAuthors}
        itemKey={authorKey}
        renderItem={authorCard}
      />
    </div>
  )
}
