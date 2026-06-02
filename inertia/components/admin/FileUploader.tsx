import { useRef, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Upload, File as FileIcon, Trash2, Loader2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import {
  validateFileConstraints,
  formatBytes,
  ALLOWED_EXTENSIONS,
} from '~/lib/file_constraints'

export type ProductionFileRow = {
  id: string
  originalName: string
  sizeBytes: number
  mimeType: string
}

type Props = {
  productionId: string
  files: ProductionFileRow[]
}

export default function FileUploader({ productionId, files }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  // Erreur serveur (ex. MIME falsifié rejeté par FilesController) — AC5.
  const serverFileError = (usePage().props.errors as Record<string, string> | undefined)?.file

  function upload(file: File) {
    setClientError(null)
    if (progress !== null) return // upload déjà en cours

    // Validation client AVANT tout envoi réseau (NFR3)
    const error = validateFileConstraints(file)
    if (error) {
      setClientError(t(`productions.files.errors.${error}`))
      return
    }

    router.post(
      `/admin/productions/${productionId}/files`,
      { file },
      {
        forceFormData: true,
        preserveScroll: true,
        onProgress: (event) => setProgress(event?.percentage ?? 0),
        onFinish: () => {
          setProgress(null)
          if (inputRef.current) inputRef.current.value = ''
        },
      }
    )
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (progress !== null) return
    const dropped = e.dataTransfer.files
    if (dropped.length > 1) {
      setClientError(t('productions.files.errors.one_at_a_time'))
      return
    }
    if (dropped[0]) upload(dropped[0])
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  function handleDelete(fileId: string) {
    router.delete(`/admin/productions/${productionId}/files/${fileId}`, {
      preserveScroll: true,
    })
  }

  const isUploading = progress !== null
  const acceptAttr = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragOver ? 'border-green-700 bg-green-50' : 'border-stone-300 bg-stone-50'
        )}
      >
        <Upload className="size-8 text-stone-400" aria-hidden />
        <p className="mt-3 text-sm text-stone-600">{t('productions.files.drop_hint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          onChange={handleSelect}
          className="sr-only"
          aria-label={t('productions.files.browse')}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {t('productions.files.browse')}
        </Button>

        {isUploading && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full bg-green-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-stone-500">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t('productions.files.uploading')} {progress}%
            </p>
          </div>
        )}

        {(clientError || serverFileError) && (
          <p className="mt-3 text-sm text-red-600">
            {clientError ?? t(serverFileError!, { defaultValue: serverFileError! })}
          </p>
        )}
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-stone-700">
                <FileIcon className="size-4 text-stone-400" aria-hidden />
                <span className="font-medium">{file.originalName}</span>
                <span className="text-stone-400">({formatBytes(file.sizeBytes)})</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleDelete(file.id)}
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">{t('productions.files.delete')}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
