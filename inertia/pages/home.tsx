import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import SearchBar from '~/components/public/SearchBar'
import ProductionCard, { ProductionCardData } from '~/components/public/ProductionCard'
import FeaturedBanner, { type FeaturedBannerItem } from '~/components/public/FeaturedBanner'
import { homeSearchHref } from '~/lib/search_query'
import type { SeoMeta } from '~/lib/seo'

type HomeProps = {
  /** Featured banner (Story 11.6): published featured productions, in order; `[]` → no banner. */
  featured: FeaturedBannerItem[]
  mostViewed: ProductionCardData[]
  recent: ProductionCardData[]
  meta?: SeoMeta
}

/** Soumission → `/productions?q=…` ; barre vide → `/productions` (12.1, D8). */
function handleSearch(query: string) {
  router.visit(homeSearchHref(query))
}

function Section({ title, productions }: { title: string; productions: ProductionCardData[] }) {
  const { t } = useTranslation()

  return (
    <section className="mt-12">
      <h2 className="text-2xl text-stone-900">{title}</h2>
      {productions.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">{t('home.empty')}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {productions.map((production) => (
            <ProductionCard key={production.id} production={production} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function Home({ featured, mostViewed, recent }: HomeProps) {
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

      <Section title={t('home.sections.most_viewed')} productions={mostViewed} />
      <Section title={t('home.sections.recent')} productions={recent} />
    </div>
  )
}
