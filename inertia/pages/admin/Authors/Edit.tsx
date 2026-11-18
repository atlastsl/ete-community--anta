import { ReactElement } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import AuthorForm from '~/components/admin/AuthorForm'
import { toAuthorPayload, validateAuthorForm, type AuthorFormData } from '~/lib/author_form'
import { urlFor } from '~/client'

type Props = {
  author: AuthorFormData & {
    id: string
    /** Migrated card (FR56): may stay without affiliation until completed (FR52). */
    isMigrated: boolean
  }
}

export default function AdminAuthorsEdit({ author }: Props) {
  const { t } = useTranslation()
  const { id, isMigrated, ...formData } = author
  const form = useForm<AuthorFormData>(formData)
  const { data, setData, put, processing, errors } = form
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
    put(urlFor('admin.authors.update', { id }), { preserveScroll: true })
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
        />

        <div className="mt-6 flex gap-3">
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
        </div>
      </form>
    </div>
  )
}

AdminAuthorsEdit.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
