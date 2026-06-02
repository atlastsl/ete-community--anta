import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '~/components/ui/button'

type Props = {
  /** Tous les champs requis remplis + attachement satisfait (CompletionIndicator vert). */
  isComplete: boolean
  processing: boolean
  /** Présent uniquement en édition (Story 4.7) : active le bouton "Publier". */
  productionId?: string
  /** Libellé du bouton submit : "Enregistrer brouillon" (création) ou "Enregistrer" (édition). */
  saveLabelKey?: string
}

/**
 * Barre d'actions du formulaire de production (UX-DR16).
 *
 * Hiérarchie des boutons : tant que la production n'est pas publiable, "Enregistrer
 * brouillon" est primaire (vert) et "Publier" est désactivé. Dès que c'est publiable
 * (vert + une production existante), "Publier" devient primaire et "Enregistrer
 * brouillon" passe secondaire. Jamais deux primaires simultanés.
 *
 * "Enregistrer brouillon" = bouton submit du formulaire parent.
 */
export default function ProductionFormActions({
  isComplete,
  processing,
  productionId,
  saveLabelKey = 'productions.form.save_draft',
}: Props) {
  const { t } = useTranslation()
  const canPublish = isComplete && !!productionId

  function handlePublish() {
    if (!productionId) return
    router.post(`/admin/productions/${productionId}/publish`, {}, { preserveScroll: true })
  }

  return (
    <div className="mt-8 flex items-center gap-3">
      {canPublish ? (
        <>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={processing}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {t('productions.form.publish')}
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={processing}
            className="border-green-700 text-green-700"
          >
            {t(saveLabelKey)}
          </Button>
        </>
      ) : (
        <>
          <Button
            type="submit"
            disabled={processing}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t(saveLabelKey)}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled
            className="cursor-not-allowed border-green-700 text-green-700 opacity-40"
          >
            {t('productions.form.publish')}
          </Button>
        </>
      )}

      <Link href="/admin/productions">
        <Button type="button" variant="ghost">
          {t('actions.cancel')}
        </Button>
      </Link>
    </div>
  )
}
