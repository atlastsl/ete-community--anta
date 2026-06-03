import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize } from 'lucide-react'

/**
 * Lecteur PDF : iframe natif du navigateur sur l'URL signée R2.
 * URL de confiance (notre bucket) → pas de `sandbox` (il casserait le viewer PDF natif).
 * Bouton « Plein écran » via l'API Fullscreen native (0 dépendance) ; `Échap` pour sortir.
 */
export default function PdfViewer({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function goFullscreen() {
    iframeRef.current?.requestFullscreen?.().catch(() => {
      // Fullscreen refusé/indisponible → on ignore silencieusement (le lecteur inline reste utilisable).
    })
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={goFullscreen}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-green-700"
        >
          <Maximize className="size-4" aria-hidden />
          {t('media.fullscreen')}
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={url}
        title={t('media.pdf_viewer_title', { name })}
        loading="lazy"
        allow="fullscreen"
        className="h-[75vh] w-full rounded-lg border border-stone-200"
      />
    </div>
  )
}
