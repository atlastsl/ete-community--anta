import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '~/lib/utils'

export type FieldStatus = {
  /** Identifiant du champ (= id de l'input, pour le focus au clic) */
  key: string
  /** Clé i18n du libellé du champ */
  labelKey: string
  filled: boolean
}

type Props = {
  fields: FieldStatus[]
  /** Au moins un fichier hébergé ou un lien externe (requis pour publier — FR21) */
  hasFileOrLink: boolean
}

export default function CompletionIndicator({ fields, hasFileOrLink }: Props) {
  const { t } = useTranslation()

  // Le critère « au moins un fichier ou lien » compte comme une condition à part entière,
  // incluse dans le total et le décompte (cohérent avec « {filled}/{total} — {missing} requis »).
  const missing = fields.filter((f) => !f.filled)
  const total = fields.length + 1
  const filledCount = fields.filter((f) => f.filled).length + (hasFileOrLink ? 1 : 0)
  const missingForPublish = total - filledCount
  const isComplete = missingForPublish === 0

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-10 rounded-lg border p-4',
        isComplete
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {isComplete ? (
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="size-5 shrink-0" aria-hidden />
        )}
        <span>
          {isComplete
            ? t('productions.completion.complete')
            : t('productions.completion.summary', {
                filled: filledCount,
                total,
                missing: missingForPublish,
              })}
        </span>
      </div>

      {!isComplete && missing.length > 0 && (
        <div className="mt-2 text-sm">
          <span className="text-amber-800">{t('productions.completion.missing_label')} </span>
          <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
            {missing.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => {
                  // Le champ peut être conditionnel (sous-domaine masqué tant que le
                  // domaine est vide) → fallback sur le domaine si l'input n'existe pas.
                  const el = document.getElementById(field.key)
                  ;(el ?? document.getElementById('domain'))?.focus()
                }}
                className="underline underline-offset-2 hover:text-amber-950"
              >
                {t(field.labelKey)}
              </button>
            ))}
          </span>
        </div>
      )}

      {!isComplete && !hasFileOrLink && (
        <p className="mt-1 text-sm text-amber-800">{t('productions.completion.file_or_link')}</p>
      )}
    </div>
  )
}
