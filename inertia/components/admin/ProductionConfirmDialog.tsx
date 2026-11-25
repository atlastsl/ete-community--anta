import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '~/components/ui/dialog'

type Props = {
  kind: 'unpublish' | 'delete'
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** Production à la une : avertissement D21 dans le corps du dialog (Story 11.5, FR51). */
  isFeatured: boolean
  processing?: boolean
}

/**
 * Dialog de confirmation de la dépublication ou de la suppression d'une production (liste
 * admin et formulaire). À la une, l'avertissement « elle sera retirée de la bannière » est
 * affiché dans un encadré `warning-notice` à l'intérieur de la description (identifiant Radix
 * par défaut) : les lecteurs d’écran le lisent avec elle.
 */
export default function ProductionConfirmDialog({
  kind,
  open,
  onOpenChange,
  onConfirm,
  isFeatured,
  processing = false,
}: Props) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{t(`productions.${kind}_modal.title`)}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>{t(`productions.${kind}_modal.description`)}</p>
              {isFeatured && (
                <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />
                  <span>{t('productions.confirm.featured_warning')}</span>
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('actions.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={processing} onClick={onConfirm}>
            {t(`productions.${kind}_modal.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
