import { ReactElement, useRef, useState } from 'react'
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
import {
  type PendingProductionLink,
  uploadPendingAttachments,
  publishProduction,
  productionIdFromEditPage,
} from '~/lib/production_submit'

export default function AdminProductionsCreate({
  suggestions,
}: {
  suggestions: ProductionSuggestions
}) {
  const { t } = useTranslation()
  const form = useForm<ProductionFormData>({ ...EMPTY_PRODUCTION_FORM })
  const { data, setData, post, processing, errors } = form
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingLinks, setPendingLinks] = useState<PendingProductionLink[]>([])
  const publishAfterSave = useRef(false)
  const [chaining, setChaining] = useState(false)

  const isComplete =
    getRequiredFieldStatuses(data).every((f) => f.filled) &&
    isAttachmentSatisfied(
      data.licenseStatus,
      pendingFiles.length > 0,
      pendingLinks.length > 0
    )

  async function afterCreate(page: { props: Record<string, unknown> }) {
    const productionId = productionIdFromEditPage(page.props)
    if (!productionId) return

    try {
      await uploadPendingAttachments(productionId, pendingFiles, pendingLinks)
      setPendingFiles([])
      setPendingLinks([])
      if (publishAfterSave.current) {
        await publishProduction(productionId)
      }
    } finally {
      publishAfterSave.current = false
      setChaining(false)
    }
  }

  function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault()
    publishAfterSave.current = false
    setChaining(true)
    post('/admin/productions', {
      onSuccess: (page) => {
        void afterCreate(page)
      },
      onError: () => setChaining(false),
      onFinish: () => {
        if (!publishAfterSave.current) setChaining(false)
      },
    })
  }

  function handlePublishCreate() {
    publishAfterSave.current = true
    setChaining(true)
    post('/admin/productions', {
      onSuccess: (page) => {
        void afterCreate(page)
      },
      onError: () => {
        publishAfterSave.current = false
        setChaining(false)
      },
    })
  }

  const busy = processing || chaining

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-900">{t('productions.create_title')}</h1>

      <form onSubmit={handleSaveDraft} className="mt-6">
        <ProductionForm
          data={data}
          setData={setData}
          errors={errors}
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          pendingLinks={pendingLinks}
          onPendingLinksChange={setPendingLinks}
          suggestions={suggestions}
        />

        <ProductionFormActions
          isComplete={isComplete}
          processing={busy}
          canPublishOnCreate={isComplete}
          onPublishCreate={handlePublishCreate}
        />
      </form>
    </div>
  )
}

AdminProductionsCreate.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
