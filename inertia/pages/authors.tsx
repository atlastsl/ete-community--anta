import { Link } from '@adonisjs/inertia/react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { urlFor } from '~/client'
import AuthorCard, { type AuthorCardData } from '~/components/public/AuthorCard'
import AuthorFilters from '~/components/public/AuthorFilters'
import Pagination from '~/components/shared/Pagination'
import { filtersHref, pageHref, type AuthorsListState } from '~/lib/authors_list_query'
import type { SeoMeta } from '~/lib/seo'

const RESULTS_ID = 'authors-results'

type Props = {
  authors: AuthorCardData[]
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
  filters: { q: string | null; institution: string | null; domain: string | null }
  sort: string
  institutionOptions: { value: string; label: string }[]
  domainOptions: string[]
  /** At least one visible author, whatever the filters (empty states, D-10.5-5). */
  hasAuthors: boolean
  meta?: SeoMeta
}

/**
 * Public list of the visible authors (Story 10.5, FR57, maquette `authors-list.html`, D31): h1,
 * introduction, AuthorFilters, result counter (`aria-live`), AuthorCard grid 1/2/3/4 columns
 * (sm/lg/xl) inside the layout's max-w-7xl container, 24 per page, numbered pagination keeping
 * the filters. The title and meta come from the server (`SeoService.authorsList`).
 */
export default function AuthorsPage({
  authors,
  pagination,
  filters,
  sort,
  institutionOptions,
  domainOptions,
  hasAuthors,
}: Props) {
  const { t, i18n } = useTranslation()
  const format = (value: number) => value.toLocaleString(i18n.language)
  const base = urlFor('authors.index')
  const state: AuthorsListState = { ...filters, sort }

  const from = (pagination.currentPage - 1) * pagination.perPage + 1
  const to = from + authors.length - 1

  function applyState(next: AuthorsListState) {
    // Any change goes back to page 1 (D14); the scroll is brought back to the top of the results
    // when they start above the viewport (EXPERIENCE.md), otherwise kept.
    // `preserveState` (Story 13.2): no remount, the keyboard focus stays on the control that
    // changed (Select trigger, search field) instead of falling back to <body>.
    router.visit(filtersHref(base, next), {
      preserveState: true,
      preserveScroll: true,
      onSuccess: () => {
        const results = document.getElementById(RESULTS_ID)
        if (results && results.getBoundingClientRect().top < 0) {
          results.scrollIntoView({ block: 'start' })
        }
      },
    })
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight text-stone-900">
        {t('authors.list.title')}
      </h1>
      <p className="mb-6 mt-1 text-stone-600">{t('authors.list.intro')}</p>

      {!hasAuthors ? (
        <p className="py-12 text-center text-stone-600">{t('authors.list.empty')}</p>
      ) : (
        <>
          <AuthorFilters
            state={state}
            institutionOptions={institutionOptions}
            domainOptions={domainOptions}
            onChange={applyState}
          />

          <p
            id={RESULTS_ID}
            className="mb-4 scroll-mt-24 text-sm text-stone-600"
            aria-live="polite"
          >
            {pagination.total > 0
              ? t('authors.list.count', {
                  count: pagination.total,
                  formattedCount: format(pagination.total),
                  from: format(from),
                  to: format(to),
                })
              : t('authors.list.no_results')}
          </p>

          {authors.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {authors.map((author) => (
                <AuthorCard key={author.slug} author={author} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Link
                href={base}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-5 text-sm font-medium text-stone-900 transition-colors hover:border-green-700 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
              >
                {t('authors.list.clear_filters')}
              </Link>
            </div>
          )}

          <Pagination
            currentPage={pagination.currentPage}
            lastPage={pagination.lastPage}
            buildHref={(p) => pageHref(base, state, p)}
            size="touch"
          />
        </>
      )}
    </div>
  )
}
