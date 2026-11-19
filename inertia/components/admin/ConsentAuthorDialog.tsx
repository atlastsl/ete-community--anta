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

export type ConsentAuthorTarget = { id: string; firstNames: string; lastNames: string }
export type ConsentMode = 'confirm' | 'withdraw'

type Props = {
  /** Card concerned; `null` = dialog closed. */
  target: ConsentAuthorTarget | null
  mode: ConsentMode
  onClose: () => void
}

/**
 * Confirmation of a consent decision (Story 9.4, FR53), shared by the list and the edit
 * page: « Confirm consent » (D27) or « Withdraw consent » (D17). The server decides on the
 * locked row (idempotent, refused without affiliation).
 */
export default function ConsentAuthorDialog({ target, mode, onClose }: Props) {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  // A second click before the re-render would send a second POST.
  const submitting = useRef(false)
  // The mode of the last opening: on close the parent resets it while Radix still animates
  // the exit, which would flash the green « Confirm » variant.
  const [shownMode, setShownMode] = useState(mode)
  if (target && mode !== shownMode) setShownMode(mode)
  const isConfirm = shownMode === 'confirm'

  function handleConfirm() {
    if (!target || submitting.current) return
    submitting.current = true
    setIsProcessing(true)
    const url = isConfirm
      ? urlFor('admin.authors.confirm-consent', { id: target.id })
      : urlFor('admin.authors.withdraw-consent', { id: target.id })
    router.post(
      url,
      {},
      {
        preserveScroll: true,
        onFinish: () => {
          submitting.current = false
          setIsProcessing(false)
          onClose()
        },
      }
    )
  }

  const name = target ? formatAuthorName(target.firstNames, target.lastNames) : ''

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>
            {isConfirm ? t('authors.consent.confirm_title') : t('authors.consent.withdraw_title')}
          </DialogTitle>
          <DialogDescription>
            {target
              ? isConfirm
                ? t('authors.consent.confirm_description', { name })
                : t('authors.consent.withdraw_description', { name })
              : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              {t('actions.cancel')}
            </Button>
          </DialogClose>
          {isConfirm ? (
            <Button
              disabled={isProcessing}
              onClick={handleConfirm}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t('authors.consent.confirm_submit')}
            </Button>
          ) : (
            <Button variant="destructive" disabled={isProcessing} onClick={handleConfirm}>
              {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t('authors.consent.withdraw_submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
