import { type KeyboardEvent, type Ref, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { Input } from '~/components/ui/input'
import Avatar from '~/components/shared/Avatar'
import AuthorStatusBadges from '~/components/admin/AuthorStatusBadges'
import { urlFor } from '~/client'
import { cn } from '~/lib/utils'
import {
  AUTHOR_SEARCH_DEBOUNCE_MS,
  AUTHOR_SEARCH_MIN_LENGTH,
  type PickerAuthor,
  pickerAffiliationLabel,
  pickerAuthorLabel,
} from '~/lib/author_picker'

type Status = 'idle' | 'loading' | 'ready' | 'error'

type Props = {
  /** Id of the input (target of the label and of the completion indicator). */
  id: string
  /** Already selected authors: excluded from the results (`exclude[]`). */
  selectedIds: string[]
  onSelect: (author: PickerAuthor) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  inputRef?: Ref<HTMLInputElement>
}

/**
 * Author search of the production form (Story 9.7, D18): ARIA 1.2 combobox + listbox written
 * by hand (no dependency). Server search from 2 characters, debounced 250 ms, the previous
 * request aborted; ↑ ↓ browse, Enter selects, Escape closes then clears; the input is
 * cleared after a selection. No free text (FR54): only cards of the referential.
 */
export default function AuthorCombobox({
  id,
  selectedIds,
  onSelect,
  onBlur,
  invalid = false,
  describedBy,
  inputRef,
}: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickerAuthor[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const term = query.trim()
  const excludeKey = selectedIds.join(',')

  useEffect(() => {
    if (term.length < AUTHOR_SEARCH_MIN_LENGTH) {
      setResults([])
      setStatus('idle')
      setActiveIndex(-1)
      return
    }
    setStatus('loading')
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const url = urlFor(
          'admin.authors.search',
          {},
          { qs: { q: term, exclude: excludeKey === '' ? [] : excludeKey.split(',') } }
        )
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`search_failed_${response.status}`)
        const body = (await response.json()) as { authors: PickerAuthor[] }
        setResults(body.authors)
        setActiveIndex(body.authors.length > 0 ? 0 : -1)
        setStatus('ready')
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setResults([])
        setActiveIndex(-1)
        setStatus('error')
      }
    }, AUTHOR_SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, excludeKey])

  const showList = open && term.length >= AUTHOR_SEARCH_MIN_LENGTH
  const optionId = (index: number) => `${listId}-option-${index}`

  function select(author: PickerAuthor) {
    onSelect(author)
    setQuery('')
    setResults([])
    setStatus('idle')
    setActiveIndex(-1)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        setOpen(true)
        if (results.length === 0) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((current) =>
          current < 0
            ? delta === 1
              ? 0
              : results.length - 1
            : (current + delta + results.length) % results.length
        )
        return
      }
      case 'Enter':
        // Never submits the production form from the search input.
        event.preventDefault()
        if (showList && activeIndex >= 0 && results[activeIndex]) select(results[activeIndex])
        return
      case 'Escape':
        if (showList) {
          event.preventDefault()
          setOpen(false)
        } else if (query !== '') {
          event.preventDefault()
          setQuery('')
        }
        return
    }
  }

  const message =
    status === 'loading' && results.length === 0
      ? t('authors.picker.loading')
      : status === 'error'
        ? t('authors.picker.error')
        : status === 'ready' && results.length === 0
          ? t('authors.picker.no_results')
          : null

  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {t('authors.picker.label')}
      </label>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <Input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && activeIndex >= 0 && results[activeIndex] ? optionId(activeIndex) : undefined
          }
          aria-invalid={invalid}
          aria-describedby={describedBy}
          placeholder={t('authors.picker.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            onBlur?.()
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9"
        />
        {status === 'loading' && (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-stone-400"
            aria-hidden="true"
          />
        )}
      </div>

      <div
        className={cn(
          'absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-stone-200 bg-white shadow-md',
          !showList && 'hidden'
        )}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={t('authors.picker.label')}
          aria-busy={status === 'loading'}
          className="max-h-72 overflow-y-auto py-1"
        >
          {results.map((author, index) => {
            const affiliation = pickerAffiliationLabel(author)
            return (
              <li
                key={author.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown: keeps the focus in the input (no blur before the click).
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(author)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                  index === activeIndex && 'bg-accent'
                )}
              >
                <Avatar
                  src={author.photoUrl}
                  firstNames={author.firstNames}
                  lastNames={author.lastNames}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-stone-900">
                    {pickerAuthorLabel(author)}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {affiliation ?? t('authors.no_affiliation')}
                  </span>
                </span>
                <AuthorStatusBadges isPublic={author.isPublic} isIncomplete={author.isIncomplete} />
              </li>
            )
          })}
        </ul>
        {message && (
          <p role="status" className="px-3 py-2 text-sm text-stone-500">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
