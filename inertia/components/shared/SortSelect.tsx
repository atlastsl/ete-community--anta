import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/utils'

/** Border ≥ 3:1 (WCAG 1.4.11, D33 amended) and solid 2 px focus ring (Story 13.2). */
const TRIGGER =
  'min-h-11 w-full border-stone-500 bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/**
 * Options of the public lists (review 13.2): the shadcn item only tints its background on
 * focus (`outline-hidden`, which also zeroes `--tw-outline-style`: hence `outline-solid`); a 2 px inset outline makes the focused option visible (2.4.7).
 */
export const OPTION_FOCUS =
  'focus:outline-solid focus:outline-2 focus:-outline-offset-2 focus:outline-ring'

export type SortOption = { value: string; label: string }

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
        <SelectTrigger id={id} className={TRIGGER}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className={OPTION_FOCUS}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
