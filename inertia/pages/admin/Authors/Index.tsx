import { ReactElement } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { BookUser, Plus } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import Pagination from '~/components/shared/Pagination'
import { formatAuthorName } from '~/lib/author_form'
import { urlFor } from '~/client'

type AuthorRow = {
  id: string
  firstNames: string
  lastNames: string
  primaryAffiliation: { institution: string; department: string | null } | null
  updatedAt: string | null
}

type Props = {
  authors: AuthorRow[]
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
}

export default function AdminAuthorsIndex({ authors, pagination }: Props) {
  const { t, i18n } = useTranslation()

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US') : '—'

  const createButton = (
    <Link href={urlFor('admin.authors.create')}>
      <Button className="bg-green-700 hover:bg-green-800 text-white">
        <Plus className="mr-1 size-4" aria-hidden />
        {t('authors.create_button')}
      </Button>
    </Link>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-stone-900">{t('authors.heading')}</h1>
        {pagination.total > 0 && createButton}
      </div>

      {pagination.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookUser className="size-12 text-stone-300" aria-hidden />
          <p className="mt-4 text-lg font-medium text-stone-700">{t('authors.empty_title')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('authors.empty_description')}</p>
          <div className="mt-6">{createButton}</div>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-600">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('authors.table.author')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('authors.table.primary_affiliation')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('authors.table.updated_at')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('authors.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {authors.map((author) => {
                  const editHref = urlFor('admin.authors.edit', { id: author.id })
                  const primary = author.primaryAffiliation
                  return (
                    <tr key={author.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-900">
                        <Link href={editHref} className="hover:text-green-700 hover:underline">
                          {formatAuthorName(author.firstNames, author.lastNames)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {primary ? (
                          [primary.institution, primary.department].filter(Boolean).join(' — ')
                        ) : (
                          <span className="text-stone-500">{t('authors.no_affiliation')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(author.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <Link href={editHref}>
                          <Button variant="outline" size="sm">
                            {t('authors.actions.edit')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={pagination.currentPage} lastPage={pagination.lastPage} />
        </>
      )}
    </div>
  )
}

AdminAuthorsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
