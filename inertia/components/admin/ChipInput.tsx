import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

type ChipInputProps = {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  suggestions?: string[]
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}

/**
 * Saisie multi-valeurs sous forme de chips. Entrée (ou virgule) valide une valeur ;
 * Retour arrière sur champ vide retire la dernière. Suggestions natives via `<datalist>`
 * alimenté par les valeurs existantes en BDD.
 */
export default function ChipInput({
  id,
  value,
  onChange,
  onBlur,
  suggestions = [],
  placeholder,
  invalid,
  describedBy,
}: ChipInputProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const reactId = useId()
  const listId = `${id ?? reactId}-suggestions`

  function addChip(raw: string) {
    const v = raw.trim()
    if (v && !value.includes(v)) onChange([...value, v])
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

  const available = suggestions.filter((s) => !value.includes(s))

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
            {chip}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={t('productions.form.remove_chip', { label: chip })}
              className="text-green-700 hover:text-green-900"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={available.length > 0 ? listId : undefined}
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
      {available.length > 0 && (
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}
