import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

type ChipInputProps = {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  suggestions?: string[]
  /** Si défini, seules ces valeurs peuvent être ajoutées (clés taxonomie). */
  allowedValues?: readonly string[]
  /** Affichage des chips (ex. libellé i18n). La valeur stockée reste la clé. */
  formatChip?: (key: string) => string
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}

/**
 * Saisie multi-valeurs sous forme de chips. Entrée (ou virgule) valide une valeur ;
 * Retour arrière sur champ vide retire la dernière. Suggestions natives via `<datalist>`
 * ou liste contrainte via `allowedValues`.
 */
export default function ChipInput({
  id,
  value,
  onChange,
  onBlur,
  suggestions = [],
  allowedValues,
  formatChip,
  placeholder,
  invalid,
  describedBy,
}: ChipInputProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const reactId = useId()
  const listId = `${id ?? reactId}-suggestions`

  function resolveKey(raw: string): string | null {
    const v = raw.trim()
    if (!v) return null
    if (allowedValues) {
      if (allowedValues.includes(v)) return v
      const byLabel = allowedValues.find(
        (key) => formatChip?.(key).toLowerCase() === v.toLowerCase()
      )
      return byLabel ?? null
    }
    return v
  }

  function addChip(raw: string) {
    const key = resolveKey(raw)
    if (key && !value.includes(key)) onChange([...value, key])
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addChip(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const optionSource = allowedValues ?? suggestions
  const available = optionSource.filter((s) => !value.includes(s))

  return (
    <div className="mt-1">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 ${
          invalid ? 'border-destructive' : 'border-input'
        }`}
      >
        {value.map((chip, index) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-800"
          >
            {formatChip ? formatChip(chip) : chip}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={t('productions.form.remove_chip', {
                label: formatChip ? formatChip(chip) : chip,
              })}
              className="text-green-700 hover:text-green-900"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={available.length > 0 && !allowedValues ? listId : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            addChip(draft)
            onBlur?.()
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {allowedValues && available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addChip(key)}
              className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-600 hover:border-green-600 hover:text-green-800"
            >
              + {formatChip ? formatChip(key) : key}
            </button>
          ))}
        </div>
      )}
      {available.length > 0 && !allowedValues && (
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}
