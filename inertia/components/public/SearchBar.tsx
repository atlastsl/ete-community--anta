import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'

type SearchBarProps = {
  defaultValue?: string
  onSubmit: (query: string) => void
  placeholder?: string
}

export default function SearchBar({ defaultValue = '', onSubmit, placeholder }: SearchBarProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(value.trim())
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? t('home.search_placeholder')}
          aria-label={t('search.label')}
          className="h-12 w-full rounded-full border border-stone-300 bg-white pl-11 pr-12 text-base outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label={t('search.clear')}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-stone-500 hover:text-stone-700"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="h-12 rounded-full bg-green-700 px-6 font-medium text-white hover:bg-green-800"
      >
        {t('search.submit')}
      </button>
    </form>
  )
}
