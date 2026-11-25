import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Eye } from 'lucide-react'
import { urlFor } from '~/client'
import Avatar from '~/components/shared/Avatar'
import { formatAuthorName } from '~/lib/author_form'

export type AuthorCardData = {
  slug: string
  firstNames: string
  lastNames: string
  /** `/media/authors/<id>/<token>` (public profiles only) or `null` → initials (Story 10.2). */
  photoBase: string | null
  /** Affiliation in position 1, `null` when none (not rendered). */
  primaryInstitution: string | null
  /** Published productions. */
  productionsCount: number
  /** Total views of the published productions (D3). */
  viewsCount: number
}

/**
 * Author card (DESIGN.md `AuthorCard`, D3, maquette `authors-list.html`): avatar, « Prénom NOM »,
 * primary institution, published productions and total views. A single link (the name) stretched
 * over the card (`after:absolute after:inset-0` on a `relative` card): never a card `onClick`,
 * never nested links (EXPERIENCE.md, stretched link).
 */
export default function AuthorCard({ author }: { author: AuthorCardData }) {
  const { t, i18n } = useTranslation()
  const name = formatAuthorName(author.firstNames, author.lastNames)
  const format = (value: number) => value.toLocaleString(i18n.language)

  return (
    <article className="relative flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-5 transition-colors focus-within:border-green-700 hover:border-green-700">
      <Avatar
        photoBase={author.photoBase}
        firstNames={author.firstNames}
        lastNames={author.lastNames}
        size="md"
        alt=""
      />
      <div className="min-w-0">
        <h2 className="font-display text-lg leading-snug text-stone-900">
          <Link
            href={urlFor('authors.show', { slug: author.slug })}
            className="after:absolute after:inset-0 after:rounded-lg hover:text-green-700 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-green-700 focus-visible:after:ring-offset-2"
          >
            {name}
          </Link>
        </h2>
        {author.primaryInstitution && (
          <p className="mt-0.5 truncate text-sm text-stone-600">{author.primaryInstitution}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-4 shrink-0" aria-hidden />
            {t('authors.list.card.productions', {
              count: author.productionsCount,
              formattedCount: format(author.productionsCount),
            })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="size-4 shrink-0" aria-hidden />
            {t('authors.list.card.views', {
              count: author.viewsCount,
              formattedCount: format(author.viewsCount),
            })}
          </span>
        </div>
      </div>
    </article>
  )
}
