import { useTranslation } from 'react-i18next'
import { List, LayoutGrid } from 'lucide-react'
import { cn } from '~/lib/utils'

export type ListingView = 'list' | 'grid'

const BASE = 'flex size-11 items-center justify-center rounded-md border transition-colors'
const ACTIVE = 'border-green-700 bg-green-700 text-white'
const INACTIVE = 'border-stone-300 text-stone-600 hover:bg-stone-50'

export default function ListingToggle({
  value,
  onChange,
}: {
  value: ListingView
  onChange: (view: ListingView) => void
}) {
  const { t } = useTranslation()

  return (
    <div role="group" aria-label={t('listing.view_label')} className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        aria-label={t('listing.view_list')}
        className={cn(BASE, value === 'list' ? ACTIVE : INACTIVE)}
      >
        <List className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        aria-label={t('listing.view_grid')}
        className={cn(BASE, value === 'grid' ? ACTIVE : INACTIVE)}
      >
        <LayoutGrid className="size-4" aria-hidden />
      </button>
    </div>
  )
}
