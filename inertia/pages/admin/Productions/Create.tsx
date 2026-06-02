import { ReactElement } from 'react'
import { useForm } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '~/layouts/AdminLayout'
import ProductionForm, {
  EMPTY_PRODUCTION_FORM,
  getRequiredFieldStatuses,
  type ProductionFormData,
  type ProductionSuggestions,
} from '~/components/admin/ProductionForm'
import ProductionFormActions from '~/components/admin/ProductionFormActions'
import { isAttachmentSatisfied } from '~/lib/production_completion'

export default function AdminProductionsCreate({
  suggestions,
}: {
  suggestions: ProductionSuggestions
}) {
  const { t } = useTranslation()
  const form = useForm<ProductionFormData>({ ...EMPTY_PRODUCTION_FORM })
  const { data, setData, post, processing, errors } = form

  // En création, aucun fichier/lien n'est encore associé (la production n'existe pas) :
  // l'attachement n'est jamais satisfait → "Publier" reste désactivé (plein flux en Edit, 4.7).
  const isComplete =
    getRequiredFieldStatuses(data).every((f) => f.filled) &&
    isAttachmentSatisfied(data.licenseStatus, false, false)

  function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault()
    post('/admin/productions')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-900">{t('productions.create_title')}</h1>

      <form onSubmit={handleSaveDraft} className="mt-6">
        <ProductionForm data={data} setData={setData} errors={errors} suggestions={suggestions} />

        {/* Page création : pas de productionId → "Publier" reste désactivé (pas d'attachement
            possible). Le flux de publication complet est réalisé sur l'Edit (Story 4.7). */}
        <ProductionFormActions isComplete={isComplete} processing={processing} />
      </form>
    </div>
  )
}

AdminProductionsCreate.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
