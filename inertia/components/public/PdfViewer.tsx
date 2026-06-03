import { useTranslation } from 'react-i18next'

/**
 * Lecteur PDF : iframe natif du navigateur sur l'URL signée R2.
 * URL de confiance (notre bucket) → pas de `sandbox` (il casserait le viewer PDF natif).
 */
export default function PdfViewer({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation()
  return (
    <iframe
      src={url}
      title={t('media.pdf_viewer_title', { name })}
      loading="lazy"
      className="h-[75vh] w-full rounded-lg border border-stone-200"
    />
  )
}
