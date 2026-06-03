import { useTranslation } from 'react-i18next'
import { ExternalLink, Download } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import PdfViewer from '~/components/public/PdfViewer'

export type MediaFile = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string | null
  downloadUrl: string
}

/** Libellé court de format à partir du type MIME (whitelist serveur). */
const FORMAT_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/epub+zip': 'EPUB',
  'video/mp4': 'MP4',
  'audio/mpeg': 'MP3',
  'audio/aac': 'AAC',
}

/**
 * Lecteur de média : sélectionne le rendu selon le type MIME.
 * PDF -> iframe natif ; MP4 -> <video> ; MP3/AAC -> <audio> ; EPUB/autre -> bouton "Ouvrir".
 * Un bouton "Télécharger" (endpoint serveur qui enregistre + redirige vers R2) est toujours
 * présent. Le lecteur reste discret (UX-DR8) ; le reste de la page demeure accessible.
 */
export default function MediaViewer({
  file,
  onDownload,
}: {
  file: MediaFile
  onDownload?: () => void
}) {
  const { t } = useTranslation()
  const { originalName, mimeType, url, downloadUrl } = file
  const formatLabel = FORMAT_LABELS[mimeType] ?? mimeType

  const header = (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="truncate text-sm font-medium text-stone-900">{originalName}</span>
      <Badge variant="secondary">{formatLabel}</Badge>
    </div>
  )

  // Téléchargement : <a> vers l'endpoint serveur (302 → R2 attachment). Pas de target=_blank
  // (téléchargement, pas navigation). Incrément optimiste du compteur via onDownload.
  const downloadButton = (
    <a
      href={downloadUrl}
      onClick={() => onDownload?.()}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100"
    >
      <Download className="size-4" aria-hidden />
      {t('media.download')}
    </a>
  )

  // Repli si l'URL signée de lecture n'a pas pu être générée (R2) — le téléchargement reste tenté.
  if (!url) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        {header}
        <p className="text-sm text-stone-500">{t('media.unavailable')}</p>
        <div className="mt-3">{downloadButton}</div>
      </section>
    )
  }

  const openButton = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
    >
      <ExternalLink className="size-4" aria-hidden />
      {t('media.open_document')}
    </a>
  )

  let viewer
  if (mimeType === 'application/pdf') {
    viewer = <PdfViewer url={url} name={originalName} />
  } else if (mimeType === 'video/mp4') {
    viewer = (
      <video controls preload="metadata" src={url} className="w-full rounded-lg">
        {t('media.video_fallback')}
      </video>
    )
  } else if (mimeType === 'audio/mpeg' || mimeType === 'audio/aac') {
    viewer = (
      <audio controls preload="metadata" src={url} className="w-full">
        {t('media.audio_fallback')}
      </audio>
    )
  } else {
    // EPUB et tout autre format : repli "Ouvrir le document" (pas de lecteur inline MVP).
    viewer = openButton
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      {header}
      {viewer}
      <div className="mt-3">{downloadButton}</div>
    </section>
  )
}
