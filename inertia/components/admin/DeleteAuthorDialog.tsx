import { useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
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
import { formatAuthorName } from '~/lib/author_form'
import { urlFor } from '~/client'

export type DeleteAuthorTarget = { id: string; firstNames: string; lastNames: string }

type Props = {
  /** Card to delete; `null` = dialog closed. */
  target: DeleteAuthorTarget | null
  onClose: () => void
}

/**
 * Confirmation of an author card deletion (Story 9.2), shared by the list and the edit
 * page. Only opened for a card linked to no production; the server re-checks (FR55).
 */
export default function DeleteAuthorDialog({ target, onClose }: Props) {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  // A second click before the re-render would send a second DELETE (404 modal).
  const submitting = useRef(false)

  function handleConfirm() {
    if (!target || submitting.current) return
    submitting.current = true
    setIsProcessing(true)
    router.delete(urlFor('admin.authors.destroy', { id: target.id }), {
      preserveScroll: true,
      onStart: () => setIsProcessing(true),
      onFinish: () => {
        submitting.current = false
        setIsProcessing(false)
        onClose()
      },
    })
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{t('authors.delete.title')}</DialogTitle>
          <DialogDescription>
            {target
              ? t('authors.delete.description', {
                  name: formatAuthorName(target.firstNames, target.lastNames),
                })
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              {t('actions.cancel')}
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={isProcessing} onClick={handleConfirm}>
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t('authors.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
