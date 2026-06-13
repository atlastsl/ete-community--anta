import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import { toastOptionsFor } from '~/lib/notify_options'
import { buildShareClipboardText, pickNativeShareData } from '~/lib/share'
import { cn } from '~/lib/utils'

type Props = {
  slug: string
  title: string
  className?: string
}

function shareUrl(slug: string): string {
  return `${window.location.origin}/productions/${slug}`
}

export default function ShareButton({ slug, title, className }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    if (busy) return
    setBusy(true)
    const url = shareUrl(slug)
    const intro = t('production_detail.share_text', { title })
    const clipboardText = buildShareClipboardText(intro, url)

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(pickNativeShareData(title, intro, url))
        return
      }

      await navigator.clipboard.writeText(clipboardText)
      toast.success(t('production_detail.share_copied'), toastOptionsFor('success'))
    } catch (error) {
      // Annulation utilisateur du dialogue natif — pas de feedback d'erreur.
      if (error instanceof DOMException && error.name === 'AbortError') return

      try {
        await navigator.clipboard.writeText(clipboardText)
        toast.success(t('production_detail.share_copied'), toastOptionsFor('success'))
      } catch {
        toast.error(t('production_detail.share_failed'), toastOptionsFor('error'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void handleShare()}
      className={cn(
        'shrink-0 border-green-700 text-green-700 hover:bg-green-50',
        className
      )}
      aria-label={t('production_detail.share_label')}
    >
      <Share2 className="size-4" aria-hidden />
      {t('production_detail.share_label')}
    </Button>
  )
}
