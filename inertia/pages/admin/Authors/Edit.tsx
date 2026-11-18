import { ReactElement, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import AuthorForm from '~/components/admin/AuthorForm'
import DeleteAuthorDialog, { type DeleteAuthorTarget } from '~/components/admin/DeleteAuthorDialog'
import { toAuthorPayload, validateAuthorForm, type AuthorFormData } from '~/lib/author_form'
import { urlFor } from '~/client'

type Props = {
  author: Omit<AuthorFormData, 'photo' | 'removePhoto'> & {
    id: string
    /** Migrated card (FR56): may stay without affiliation until completed (FR52). */
    isMigrated: boolean
    /** Pivot rows, every production status included: > 0 blocks the deletion (FR55). */
    productionsCount: number
    /** Signed URL of the saved photo (`w384`), never public (Story 9.3). */
    photoUrl: string | null
  }
}

export default function AdminAuthorsEdit({ author }: Props) {
  const { t } = useTranslation()
  const { id, isMigrated, productionsCount, photoUrl, ...formData } = author
  const [deleteTarget, setDeleteTarget] = useState<DeleteAuthorTarget | null>(null)
  const form = useForm<AuthorFormData>({ ...formData, photo: null, removePhoto: false })
  const { data, setData, put, processing, errors, progress } = form
  const requireAffiliation = !isMigrated

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientErrors = validateAuthorForm(data, { requireAffiliation })
    form.clearErrors()
    if (Object.keys(clientErrors).length > 0) {
      form.setError(clientErrors as Partial<Record<keyof AuthorFormData, string>>)
      return
    }
    form.transform(toAuthorPayload)
    // A chosen file switches Inertia to multipart on its own (PUT, no method spoofing).
    put(urlFor('admin.authors.update', { id }), {
      preserveScroll: true,
      onSuccess: () => form.reset('photo', 'removePhoto'),
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-900">{t('authors.edit_title')}</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <AuthorForm
          data={data}
          setData={setData}
          errors={errors as Record<string, string | undefined>}
          requireAffiliation={requireAffiliation}
          photoUrl={photoUrl}
          uploadPercent={processing && data.photo ? (progress?.percentage ?? null) : null}
        />

        <div className="mt-6 flex flex-wrap items-start gap-3">
          <Button
            type="submit"
            disabled={processing}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {processing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t('actions.save')}
          </Button>
          <Link href={urlFor('admin.authors')}>
            <Button type="button" variant="outline">
              {t('actions.cancel')}
            </Button>
          </Link>
          <div className="ml-auto">
            {productionsCount === 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() =>
                  setDeleteTarget({
                    id,
                    firstNames: author.firstNames,
                    lastNames: author.lastNames,
                  })
                }
              >
                {t('authors.actions.delete')}
              </Button>
            ) : (
              <>
                {/* aria-disabled (not disabled): stays focusable; visible explanation (D32). */}
                <Button
                  type="button"
                  variant="ghost"
                  aria-disabled="true"
                  aria-describedby="author-delete-hint"
                  className="cursor-not-allowed text-red-600 opacity-50 hover:bg-transparent hover:text-red-600"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('authors.actions.delete')}
                </Button>
                <p id="author-delete-hint" className="mt-2 text-sm text-stone-600">
                  {t('authors.delete.blocked', { count: productionsCount })}
                </p>
              </>
            )}
          </div>
        </div>
      </form>

      <DeleteAuthorDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  )
}

AdminAuthorsEdit.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
