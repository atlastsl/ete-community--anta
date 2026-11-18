import { ReactElement } from 'react'
import { useForm } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import AuthorForm from '~/components/admin/AuthorForm'
import {
  EMPTY_AUTHOR_FORM,
  toAuthorPayload,
  validateAuthorForm,
  type AuthorFormData,
} from '~/lib/author_form'
import { urlFor } from '~/client'

export default function AdminAuthorsCreate() {
  const { t } = useTranslation()
  const form = useForm<AuthorFormData>({
    ...EMPTY_AUTHOR_FORM,
    affiliations: EMPTY_AUTHOR_FORM.affiliations.map((a) => ({ ...a })),
  })
  const { data, setData, post, processing, errors } = form

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientErrors = validateAuthorForm(data, { requireAffiliation: true })
    form.clearErrors()
    if (Object.keys(clientErrors).length > 0) {
      form.setError(clientErrors as Partial<Record<keyof AuthorFormData, string>>)
      return
    }
    form.transform(toAuthorPayload)
    post(urlFor('admin.authors.store'))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-900">{t('authors.create_title')}</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <AuthorForm
          data={data}
          setData={setData}
          errors={errors as Record<string, string | undefined>}
          requireAffiliation
        />

        <div className="mt-6 flex gap-3">
          <Button
            type="submit"
            disabled={processing}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {processing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t('authors.form.submit_create')}
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

AdminAuthorsCreate.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
