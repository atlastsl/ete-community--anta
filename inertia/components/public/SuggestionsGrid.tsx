import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { urlFor } from '~/client'
import ProductionCard, { type ProductionCardData } from '~/components/public/ProductionCard'
import { Skeleton } from '~/components/ui/skeleton'
import { cachedSuggestions, loadSuggestions, SUGGESTIONS_MAX } from '~/lib/suggestions'

/** 2 columns (compact < sm), 4 from `lg` (D22, D35, DESIGN.md). */
const GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4'

/**
 * « Productions similaires » under the detail page (Story 12.4, FR61, D22; maquette
 * production-detail-suggestions.html). Loaded after the page (NFR18) by `loadSuggestions`
 * (fetch, abort after 2 000 ms, result memoised per slug: no reload on back navigation).
 * While loading: `aria-busy` container, hidden status, 4 `aria-hidden` skeleton cards. With
 * results: up to 4 compact text cards (D37), no reason shown, one polite announcement of the
 * count; focus never moved. 0 result, error or timeout: no section at all, no message.
 * Mounted with `key={slug}` by the page (D-12.4-7).
 */
export default function SuggestionsGrid({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const headingId = useId()
  const [results, setResults] = useState<ProductionCardData[] | null>(
    () => cachedSuggestions<ProductionCardData>(slug) ?? null
  )

  useEffect(() => {
    if (cachedSuggestions(slug)) return
    const controller = new AbortController()
    loadSuggestions<ProductionCardData>(slug, {
      url: urlFor('production.suggestions', { slug }),
      signal: controller.signal,
    }).then((loaded) => {
      // `null` = aborted by the unmount: nothing to render.
      if (loaded) setResults(loaded)
    })
    return () => controller.abort()
  }, [slug])

  const loading = results === null
  // 0 result, error or > 2 s: the section is removed silently (D22).
  if (!loading && results.length === 0) return null

  return (
    <section className="mt-12" aria-labelledby={headingId} aria-busy={loading ? 'true' : undefined}>
      <h2 id={headingId} className="mb-5 text-xl text-stone-900">
        {t('suggestions.title')}
      </h2>
      {/* Present while loading (empty), then filled once: a single announcement. */}
      <p className="sr-only" aria-live="polite">
        {results ? t('suggestions.announce', { count: results.length }) : ''}
      </p>
      {loading ? (
        <>
          <p className="sr-only" role="status">
            {t('suggestions.loading')}
          </p>
          <div className={GRID} aria-hidden="true">
            {Array.from({ length: SUGGESTIONS_MAX }, (_, index) => (
              <div key={index} className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2 bg-stone-100" />
                  <Skeleton className="h-3 w-1/3 bg-stone-100" />
                  <div className="flex gap-3 pt-3">
                    <Skeleton className="h-3 w-10 bg-stone-100" />
                    <Skeleton className="h-3 w-10 bg-stone-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={GRID}>
          {results.map((production) => (
            <ProductionCard key={production.id} production={production} variant="compact" />
          ))}
        </div>
      )}
    </section>
  )
}
