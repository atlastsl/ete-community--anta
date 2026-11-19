import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Building2, Download, ExternalLink, Eye, GraduationCap } from 'lucide-react'
import Avatar from '~/components/shared/Avatar'
import { formatAuthorName } from '~/lib/author_form'

export type PublicAuthor = {
  slug: string
  firstNames: string
  lastNames: string
  /** `/media/authors/<id>/<token>` (public profiles only) or `null` (Story 10.2). */
  photoBase: string | null
  googleScholarUrl: string | null
  affiliations: { institution: string; department: string | null }[]
}

export type AuthorStats = { views: number; downloads: number; productions: number }

/**
 * Header of an author profile (DESIGN.md `AuthorProfileHeader`, maquette `author-profile.html`):
 * breadcrumb, avatar, name (h1), affiliations in their order, Google Scholar link (D15) and
 * the statistics aside (totals of the published productions, FR58). An absent optional field
 * renders nothing (no visual gap).
 */
export default function AuthorProfileHeader({
  author,
  stats,
}: {
  author: PublicAuthor
  stats: AuthorStats
}) {
  const { t, i18n } = useTranslation()
  const name = formatAuthorName(author.firstNames, author.lastNames)
  const items = [
    { key: 'views', Icon: Eye, label: t('authors.profile.stats.views'), value: stats.views },
    {
      key: 'downloads',
      Icon: Download,
      label: t('authors.profile.stats.downloads'),
      value: stats.downloads,
    },
    {
      key: 'productions',
      Icon: BookOpen,
      label: t('authors.profile.stats.productions'),
      value: stats.productions,
    },
  ]

  return (
    <>
      <nav aria-label={t('authors.profile.breadcrumb_label')} className="text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-green-700">
              {t('authors.profile.breadcrumb_home')}
            </Link>
          </li>
          <li aria-hidden className="text-stone-300">
            /
          </li>
          <li aria-current="page" className="max-w-[20rem] truncate text-stone-700">
            {name}
          </li>
        </ol>
      </nav>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start lg:col-span-2">
          <Avatar
            photoBase={author.photoBase}
            firstNames={author.firstNames}
            lastNames={author.lastNames}
            size="lg"
            loading="eager"
            alt={t('authors.profile.photo_alt', { name })}
          />
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight text-stone-900">{name}</h1>

            {author.affiliations.length > 0 && (
              <ul
                aria-label={t('authors.profile.affiliations_label')}
                className="mt-3 space-y-2 text-sm text-stone-700"
              >
                {author.affiliations.map((affiliation, index) => (
                  <li key={index} className="flex gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
                    <span>
                      {affiliation.institution}
                      {affiliation.department ? ` — ${affiliation.department}` : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {author.googleScholarUrl && (
              <a
                href={author.googleScholarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:border-green-700 hover:text-green-700"
              >
                <GraduationCap className="size-4 shrink-0" aria-hidden />
                {t('authors.profile.scholar')}
                <span className="sr-only">{t('authors.profile.new_tab')}</span>
                <ExternalLink className="size-4 shrink-0" aria-hidden />
              </a>
            )}
          </div>
        </div>

        <aside
          aria-label={t('authors.profile.stats_label')}
          className="rounded-lg border border-stone-200 bg-white p-5"
        >
          <dl className="grid grid-cols-3 gap-4 lg:grid-cols-1">
            {items.map(({ key, Icon, label, value }, index) => (
              <div
                key={key}
                className={index > 0 ? 'lg:border-t lg:border-stone-100 lg:pt-4' : undefined}
              >
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-stone-500">
                  <Icon className="size-5 shrink-0 text-green-700" aria-hidden />
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-stone-900">
                  {value.toLocaleString(i18n.language)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-stone-500">{t('authors.profile.stats_note')}</p>
        </aside>
      </section>
    </>
  )
}
