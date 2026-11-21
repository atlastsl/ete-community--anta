import { type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff, Loader2, Search } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { urlFor } from '~/client'
import { cn } from '~/lib/utils'
import { taxonomyLabel } from '~/lib/taxonomy'
import { formatAuthorName } from '~/lib/author_form'
import { type FeaturedItem, authorLabels, imageStateOf, previewImage } from '~/lib/featured'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Shortest search term (the server returns nothing below) and debounce, as AuthorCombobox. */
const MIN_LENGTH = 2
const DEBOUNCE_MS = 250

type Props = {
  /** Id of the input (target of its label). */
  id: string
  /** Productions already in a slot: excluded from the results (`exclude[]`, then here). */
  excludeIds: string[]
  onSelect: (item: FeaturedItem) => void
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
}

/**
 * Production picker of a free featured slot (Story 11.4, D30): ARIA 1.2 combobox + listbox
 * written by hand like `AuthorCombobox` (no dependency). Server search of **published**
 * productions by title or author from 2 characters, debounced 250 ms, the previous request
 * aborted and its results cleared at once; ↑ ↓ browse, Enter selects, Escape closes then
 * clears. Each option shows the 16:9 thumbnail (or `ImageOff`), the title, authors · category
 * and the thumbnail state; a production without thumbnail stays selectable (it then blocks
 * the save until its thumbnail is uploaded, D26). A status region, always mounted, announces
 * the number of results, no result or the error.
 */
export default function ProductionPicker({
  id,
  excludeIds,
  onSelect,
  disabled = false,
  inputRef,
}: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const helpId = `${listId}-help`
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FeaturedItem[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [retry, setRetry] = useState(0)
  const [failedSrc, setFailedSrc] = useState<Set<string>>(() => new Set())
  const inputElement = useRef<HTMLInputElement | null>(null)

  const term = query.normalize('NFC').trim()
  const excludeKey = excludeIds.join(',')

  useEffect(() => {
    setResults([])
    setActiveIndex(-1)
    if (term.length < MIN_LENGTH) {
      setStatus('idle')
      return
    }
    setStatus('loading')
    const controller = new AbortController()
    const excluded = excludeKey === '' ? [] : excludeKey.split(',')
    const timer = window.setTimeout(async () => {
      try {
        const url = urlFor('admin.featured.candidates', {}, { qs: { q: term, exclude: excluded } })
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`candidates_failed_${response.status}`)
        const body = (await response.json()) as { productions: FeaturedItem[] }
        const found = body.productions.filter((item) => !excluded.includes(item.id))
        setResults(found)
        setActiveIndex(found.length > 0 ? 0 : -1)
        setStatus('ready')
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setResults([])
        setActiveIndex(-1)
        setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [term, excludeKey, retry])

  const hasTerm = term.length >= MIN_LENGTH
  const showList = open && hasTerm && !disabled
  const optionId = (index: number) => `${listId}-option-${index}`

  useEffect(() => {
    if (activeIndex < 0) return
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, listId])

  function setInputRef(element: HTMLInputElement | null) {
    inputElement.current = element
    if (typeof inputRef === 'function') inputRef(element)
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = element
  }

  function retryAfterError() {
    if (status === 'error') setRetry((count) => count + 1)
  }

  function select(item: FeaturedItem) {
    // Never an option of a search still running (its results were cleared anyway).
    if (status === 'loading' || disabled) return
    onSelect(item)
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
        if (event.key === 'ArrowDown') retryAfterError()
        if (!hasTerm || results.length === 0) return
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
        event.preventDefault()
        retryAfterError()
        if (status !== 'loading' && showList && activeIndex >= 0 && results[activeIndex]) {
          select(results[activeIndex])
        }
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
    status === 'loading'
      ? t('featured.picker.loading')
      : status === 'error'
        ? t('featured.picker.error')
        : status === 'ready' && results.length === 0
          ? t('featured.picker.no_results')
          : null

  const announcement =
    status === 'error'
      ? t('featured.picker.error')
      : status === 'ready'
        ? results.length === 0
          ? t('featured.picker.no_results')
          : t('featured.picker.results_count', { count: results.length })
        : ''

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {t('featured.picker.label')}
      </label>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <Input
          id={id}
          ref={setInputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && activeIndex >= 0 && activeIndex < results.length
              ? optionId(activeIndex)
              : undefined
          }
          aria-describedby={helpId}
          placeholder={t('featured.picker.placeholder')}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            retryAfterError()
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9"
        />
        {status === 'loading' && (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-stone-400"
            aria-hidden="true"
          />
        )}

        <div
          // mousedown (scrollbar, gaps between options): keeps the focus in the input.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            'absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-stone-200 bg-white shadow-md',
            !showList && 'hidden'
          )}
        >
          {message && (
            <p aria-hidden="true" className="px-3 py-2 text-sm text-stone-500">
              {message}
            </p>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label={t('featured.picker.label')}
            aria-busy={status === 'loading'}
            className="max-h-80 overflow-y-auto py-1"
          >
            {results.map((item, index) => {
              const state = imageStateOf(item)
              const src = previewImage(item)
              const category = taxonomyLabel(t, 'categories', item.category)
              const meta = [authorLabels(item.authors, formatAuthorName).join(', '), category]
                .filter(Boolean)
                .join(' · ')
              return (
                <li
                  key={item.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => select(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                    index === activeIndex && 'bg-accent'
                  )}
                >
                  <span className="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-stone-100">
                    {src && !failedSrc.has(src) ? (
                      <img
                        src={src}
                        alt=""
                        width={64}
                        height={36}
                        loading="lazy"
                        className="size-full object-cover"
                        onError={() => setFailedSrc((previous) => new Set(previous).add(src))}
                      />
                    ) : (
                      <ImageOff
                        className={cn(
                          'size-4',
                          state === 'missing' ? 'text-amber-600' : 'text-stone-400'
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">{item.title}</span>
                    {meta && <span className="block truncate text-xs text-stone-500">{meta}</span>}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs',
                      state === 'missing'
                        ? 'border border-amber-300 bg-amber-50 text-amber-800'
                        : 'bg-stone-100 text-stone-700'
                    )}
                  >
                    {t(`featured.state.${state}`)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <p id={helpId} className="mt-2 text-xs text-stone-500">
        {t('featured.picker.help')}
      </p>
    </div>
  )
}
