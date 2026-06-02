import { ReactElement } from 'react'
import { useForm } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '~/layouts/AdminLayout'
import StatusBadge from '~/components/admin/StatusBadge'
import ProductionForm, {
  getRequiredFieldStatuses,
  type ProductionFormData,
  type ProductionSuggestions,
} from '~/components/admin/ProductionForm'
import ProductionFormActions from '~/components/admin/ProductionFormActions'
import { type ProductionFileRow } from '~/components/admin/FileUploader'
import { type ProductionLinkRow } from '~/components/admin/LinkManager'
import { isAttachmentSatisfied } from '~/lib/production_completion'

type Props = {
  production: ProductionFormData & {
    id: string
    status: 'draft' | 'published' | 'unpublished'
  }
  files: ProductionFileRow[]
  links: ProductionLinkRow[]
  suggestions: ProductionSuggestions
  publishedBy: { email: string | null; at: string } | null
}

export default function AdminProductionsEdit({
  production,
  files,
  links,
  suggestions,
  publishedBy,
}: Props) {
  const { t, i18n } = useTranslation()
  const { id, status, ...formData } = production
  const { data, setData, put, processing, errors } = useForm<ProductionFormData>(formData)

  const isComplete =
    getRequiredFieldStatuses(data).every((f) => f.filled) &&
    isAttachmentSatisfied(data.licenseStatus, files.length > 0, links.length > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    put(`/admin/productions/${id}`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">{t('productions.edit_title')}</h1>
        <StatusBadge status={status} />
      </div>

      {publishedBy && (
        <p className="mt-2 text-sm text-stone-500">
          {t('productions.last_published_by', {
            email: publishedBy.email ?? t('productions.unknown_admin'),
            date: new Date(publishedBy.at).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US'),
          })}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6">
        <ProductionForm
          data={data}
          setData={setData}
          errors={errors}
          productionId={id}
          files={files}
          links={links}
          suggestions={suggestions}
        />

        <ProductionFormActions
          isComplete={isComplete}
          processing={processing}
          productionId={id}
          saveLabelKey="productions.form.save"
        />
      </form>
    </div>
  )
}

AdminProductionsEdit.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
