import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

/** `disabled`: listed but not selectable (« Pertinence » without a search term, 12.1). */
export type SortOption = { value: string; label: string; disabled?: boolean }

type Props = {
  id: string
  value: string
  options: SortOption[]
  onChange: (value: string) => void
  className?: string
}

/**
 * Sort control of the public lists (DESIGN.md `SortSelect`): shadcn `Select` preceded by the
 * visible label « Trier par ». Used by the author profile (10.3), later by the authors list
 * (10.5) and the listing (12.1). Navigation is up to the caller (`onChange`).
 */
export default function SortSelect({ id, value, options, onChange, className }: Props) {
  const { t } = useTranslation()

  return (
    <div className={cn('w-full sm:w-64', className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500"
      >
        {t('sort.label')}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="min-h-11 w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
