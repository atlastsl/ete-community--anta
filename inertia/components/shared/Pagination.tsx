import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '~/lib/utils'

type PaginationProps = {
  currentPage: number
  lastPage: number
  /** Paramètres de requête à préserver (ex. { status: 'draft' }). Valeurs `undefined` ignorées. */
  queryParams?: Record<string, string | undefined>
  /**
   * Constructeur de lien personnalisé (ex. listing public où les filtres sont
   * multi-valeurs et ne tiennent pas dans `queryParams`). Prioritaire sur `queryParams`.
   */
  buildHref?: (page: number) => string
}

function defaultBuildHref(page: number, queryParams: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value)
    }
  }
  return `?${params.toString()}`
}

export default function Pagination({
  currentPage,
  lastPage,
  queryParams,
  buildHref,
}: PaginationProps) {
  const { t } = useTranslation()

  if (lastPage <= 1) return null

  const hrefFor = buildHref ?? ((page: number) => defaultBuildHref(page, queryParams))

  const pages = Array.from({ length: lastPage }, (_, i) => i + 1)
  const isFirst = currentPage <= 1
  const isLast = currentPage >= lastPage

  const baseLink =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm transition-colors'

  return (
    <nav aria-label={t('pagination.label')} className="mt-6 flex items-center justify-center gap-1">
      <Link
        href={hrefFor(currentPage - 1)}
        className={cn(
          baseLink,
          'border-stone-200 text-stone-600 hover:bg-stone-50',
          isFirst && 'pointer-events-none opacity-40'
        )}
        aria-disabled={isFirst}
        tabIndex={isFirst ? -1 : undefined}
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span className="sr-only">{t('pagination.previous')}</span>
      </Link>

      {pages.map((page) => {
        const active = page === currentPage
        return (
          <Link
            key={page}
            href={hrefFor(page)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              baseLink,
              active
                ? 'border-green-700 bg-green-700 text-white'
                : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            )}
          >
            {page}
          </Link>
        )
      })}

      <Link
        href={hrefFor(currentPage + 1)}
        className={cn(
          baseLink,
          'border-stone-200 text-stone-600 hover:bg-stone-50',
          isLast && 'pointer-events-none opacity-40'
        )}
        aria-disabled={isLast}
        tabIndex={isLast ? -1 : undefined}
      >
        <ChevronRight className="size-4" aria-hidden />
        <span className="sr-only">{t('pagination.next')}</span>
      </Link>
    </nav>
  )
}
