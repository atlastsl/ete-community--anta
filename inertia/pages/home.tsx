import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import SearchBar from '~/components/public/SearchBar'
import FilterBar from '~/components/public/FilterBar'
import ProductionCard, { ProductionCardData } from '~/components/public/ProductionCard'
import type { SeoMeta } from '~/lib/seo'

type HomeProps = {
  mostViewed: ProductionCardData[]
  recent: ProductionCardData[]
  categories: string[]
  meta?: SeoMeta
}

function handleSearch(query: string) {
  if (!query) return
  router.visit(`/productions?q=${encodeURIComponent(query)}`)
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

export default function Home({ mostViewed, recent, categories }: HomeProps) {
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
        <div className="mx-auto mt-8 max-w-2xl">
          <SearchBar onSubmit={handleSearch} />
        </div>
        <div className="mt-5 flex justify-center">
          <FilterBar categories={categories} />
        </div>
      </section>

      <Section title={t('home.sections.most_viewed')} productions={mostViewed} />
      <Section title={t('home.sections.recent')} productions={recent} />
    </div>
  )
}
