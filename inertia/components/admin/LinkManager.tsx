import { useState } from 'react'
import { useForm, router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Link2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import type { PendingProductionLink } from '~/lib/production_submit'

export type ProductionLinkRow = {
  id: string
  url: string
  linkType: 'embed' | 'simple'
  label: string | null
}

type Props = {
  productionId?: string
  links: ProductionLinkRow[]
  pendingLinks?: PendingProductionLink[]
  onPendingLinksChange?: (links: PendingProductionLink[]) => void
}

export default function LinkManager({
  productionId,
  links,
  pendingLinks = [],
  onPendingLinksChange,
}: Props) {
  const { t } = useTranslation()
  const [isAdding, setIsAdding] = useState(false)
  const { data, setData, post, processing, errors, reset, clearErrors } = useForm<{
    url: string
    linkType: 'embed' | 'simple'
    label: string
  }>({ url: '', linkType: 'simple', label: '' })

  const [localError, setLocalError] = useState<string | null>(null)

  function submitLink() {
    if (!productionId) {
      setLocalError(null)
      try {
        const parsed = new URL(data.url)
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid')
      } catch {
        setLocalError(t('productions.links.errors.invalid_url'))
        return
      }
      onPendingLinksChange?.([
        ...pendingLinks,
        {
          url: data.url.trim(),
          linkType: data.linkType,
          label: data.label.trim(),
        },
      ])
      reset()
      setIsAdding(false)
      return
    }

    post(`/admin/productions/${productionId}/links`, {
      preserveScroll: true,
      onSuccess: () => {
        reset()
        setIsAdding(false)
      },
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    submitLink()
  }

  // Entrée dans un champ de lien : ajoute le lien au lieu de soumettre le formulaire
  // production parent (la page Edit englobe ce composant dans un <form> → perte de données).
  function handleLinkKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!processing) submitLink()
    }
  }

  function handleDelete(linkId: string) {
    if (!productionId) return
    router.delete(`/admin/productions/${productionId}/links/${linkId}`, {
      preserveScroll: true,
    })
  }

  function removePending(index: number) {
    onPendingLinksChange?.(pendingLinks.filter((_, i) => i !== index))
  }

  const urlError =
    localError ?? (errors.url ? t(errors.url, { defaultValue: errors.url }) : null)
  const hasLinks = links.length > 0 || pendingLinks.length > 0

  return (
    <div className="space-y-4">
      {hasLinks ? (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {pendingLinks.map((link, index) => (
            <li key={`pending-${link.url}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                <Link2 className="size-4 shrink-0 text-stone-400" aria-hidden />
                <Badge variant="secondary">
                  {link.linkType === 'embed'
                    ? t('productions.links.type_embed')
                    : t('productions.links.type_simple')}
                </Badge>
                {link.label && <span className="font-medium">{link.label}</span>}
                <span className="truncate text-stone-500">{link.url}</span>
                <span className="text-xs text-amber-600">{t('productions.files.pending')}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => removePending(index)}
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">{t('productions.links.delete')}</span>
              </Button>
            </li>
          ))}
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                <Link2 className="size-4 shrink-0 text-stone-400" aria-hidden />
                <Badge variant="secondary">
                  {link.linkType === 'embed'
                    ? t('productions.links.type_embed')
                    : t('productions.links.type_simple')}
                </Badge>
                {link.label && <span className="font-medium">{link.label}</span>}
                <span className="truncate text-stone-500">{link.url}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleDelete(link.id)}
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">{t('productions.links.delete')}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">{t('productions.links.empty')}</p>
      )}

      {isAdding ? (
        <div className="rounded-lg border border-stone-200 p-4">
          {/* Formulaire inline (pas un <form> imbriqué — la page parente est déjà un form) */}
          <div className="space-y-3">
            <div>
              <label htmlFor="link-url" className="text-sm font-medium text-stone-700">
                {t('productions.links.url')}
              </label>
              <Input
                id="link-url"
                type="url"
                placeholder={t('productions.links.url_placeholder')}
                value={data.url}
                onChange={(e) => {
                  setData('url', e.target.value)
                  if (urlError) clearErrors('url')
                }}
                onKeyDown={handleLinkKeyDown}
                aria-describedby={urlError ? 'link-url-error' : undefined}
                aria-invalid={!!urlError}
                className="mt-1"
              />
              {urlError && (
                <p id="link-url-error" className="mt-1 text-sm text-red-600">
                  {urlError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="link-type" className="text-sm font-medium text-stone-700">
                {t('productions.links.type')}
              </label>
              <Select
                value={data.linkType}
                onValueChange={(value) => setData('linkType', value as 'embed' | 'simple')}
              >
                <SelectTrigger id="link-type" className="mt-1 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">{t('productions.links.type_simple')}</SelectItem>
                  <SelectItem value="embed">{t('productions.links.type_embed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="link-label" className="text-sm font-medium text-stone-700">
                {t('productions.links.label')}
              </label>
              <Input
                id="link-label"
                value={data.label}
                onChange={(e) => setData('label', e.target.value)}
                onKeyDown={handleLinkKeyDown}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={processing}
                onClick={handleAdd}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {t('productions.links.confirm')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  reset()
                  clearErrors()
                  setIsAdding(false)
                }}
              >
                {t('productions.links.cancel')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="mr-1 size-4" aria-hidden />
          {t('productions.links.add_button')}
        </Button>
      )}
    </div>
  )
}
