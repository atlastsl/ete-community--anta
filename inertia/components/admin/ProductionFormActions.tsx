import { router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '~/components/ui/button'

type Props = {
  /** Tous les champs requis remplis + attachement satisfait (CompletionIndicator vert). */
  isComplete: boolean
  processing: boolean
  /** Présent uniquement en édition (Story 4.7) : active les actions "Publier" / "Dépublier". */
  productionId?: string
  /** Statut courant (édition uniquement). 'published' → action "Dépublier" au lieu de "Publier". */
  status?: 'draft' | 'published' | 'unpublished'
  /** Libellé du bouton submit : "Enregistrer brouillon" (création) ou "Enregistrer" (édition). */
  saveLabelKey?: string
}

/**
 * Barre d'actions du formulaire de production (UX-DR16).
 *
 * - Production PUBLIÉE → "Enregistrer" (primaire) + "Dépublier" (secondaire).
 * - Production publiable (complète + existante, non publiée) → "Publier" (primaire) + "Enregistrer".
 * - Sinon → "Enregistrer" (primaire) + "Publier" désactivé.
 * Jamais deux primaires simultanés ; jamais "Publier" sur une production déjà publiée.
 *
 * "Enregistrer" = bouton submit du formulaire parent.
 */
export default function ProductionFormActions({
  isComplete,
  processing,
  productionId,
  status,
  saveLabelKey = 'productions.form.save_draft',
}: Props) {
  const { t } = useTranslation()
  const isPublished = status === 'published'
  // On ne propose "Publier" que pour une production existante, complète ET non déjà publiée.
  const canPublish = isComplete && !!productionId && !isPublished

  function handlePublish() {
    if (!productionId) return
    router.post(`/admin/productions/${productionId}/publish`, {}, { preserveScroll: true })
  }

  function handleUnpublish() {
    if (!productionId) return
    router.post(`/admin/productions/${productionId}/unpublish`, {}, { preserveScroll: true })
  }

  return (
    <div className="mt-8 flex items-center gap-3">
      {isPublished ? (
        // Production publiée : enregistrer les modifications (primaire) + dépublier (secondaire).
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
            onClick={handleUnpublish}
            disabled={processing}
            className="border-amber-700 text-amber-700 hover:bg-amber-50"
          >
            {t('productions.actions.unpublish')}
          </Button>
        </>
      ) : canPublish ? (
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
