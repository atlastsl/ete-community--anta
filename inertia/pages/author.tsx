import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import AuthorProfileHeader, {
  type AuthorStats,
  type PublicAuthor,
} from '~/components/public/AuthorProfileHeader'
import ProductionCard, { type ProductionCardData } from '~/components/public/ProductionCard'
import Pagination from '~/components/shared/Pagination'
import SortSelect from '~/components/shared/SortSelect'
import { PROFILE_SORTS, pageHref, sortHref } from '~/lib/author_profile_query'
import type { SeoMeta } from '~/lib/seo'

type Props = {
  author: PublicAuthor
  stats: AuthorStats
  productions: ProductionCardData[]
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
  sort: string
  meta?: SeoMeta
}

const SECTION_ID = 'author-productions'

/**
 * Public profile of a visible author (Story 10.3, maquette `author-profile.html`, D35): header
 * + statistics aside, then its published productions, 12 per page, sortable. The title and
 * meta come from the server (`SeoService.forAuthor`), no <Head> on public pages.
 */
export default function AuthorPage({ author, stats, productions, pagination, sort }: Props) {
  const { t } = useTranslation()

  const from = (pagination.currentPage - 1) * pagination.perPage + 1
  const to = from + productions.length - 1

  function changeSort(value: string) {
    // Page back to 1; scroll brought back to the top of the results (EXPERIENCE.md).
    router.visit(sortHref(author.slug, value), {
      preserveScroll: true,
      onSuccess: () => document.getElementById(SECTION_ID)?.scrollIntoView({ block: 'start' }),
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AuthorProfileHeader author={author} stats={stats} />

      <section
        id={SECTION_ID}
        aria-labelledby="author-productions-heading"
        className="mt-12 scroll-mt-24"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="author-productions-heading" className="text-2xl text-stone-900">
              {t('authors.profile.productions_heading')}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {t('authors.profile.productions_count', { count: pagination.total, from, to })}
            </p>
          </div>
          <SortSelect
            id="author-sort"
            value={sort}
            onChange={changeSort}
            options={PROFILE_SORTS.map((value) => ({
              value,
              label: t(`authors.profile.sort.${value}`),
            }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {productions.map((production) => (
            <ProductionCard key={production.id} production={production} variant="grid" />
          ))}
        </div>

        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          buildHref={(p) => pageHref(author.slug, sort, p)}
        />
      </section>
    </div>
  )
}
