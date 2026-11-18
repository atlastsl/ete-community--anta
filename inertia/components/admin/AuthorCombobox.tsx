import { type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Search } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import Avatar from '~/components/shared/Avatar'
import AuthorStatusBadges from '~/components/admin/AuthorStatusBadges'
import AuthorFormDialog from '~/components/admin/AuthorFormDialog'
import { notify } from '~/lib/notify'
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
  /** Already selected authors: excluded from the results (`exclude[]`, then filtered here). */
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
 * request aborted and its results cleared at once (no stale option can be selected); ↑ ↓
 * browse, Enter selects, Escape closes then clears; the input is cleared after a selection.
 * A status region, always mounted outside the popup, announces the number of results, no
 * result or the error; after an error, focus, ↓ or Enter retry the search. No free text
 * (FR54): only cards of the referential.
 *
 * Story 9.8 (D16, D36): the last option is always « Create author “{query}” », and an outline
 * « Create an author » button sits next to the input; both open `AuthorFormDialog` prefilled
 * from the query. The created card is handed to `onSelect` (appended to the selection), the
 * input is cleared, the focus comes back to it and the addition is announced. Cancelling
 * returns the focus to the trigger (input or button).
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
  const [retry, setRetry] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogQuery, setDialogQuery] = useState('')
  // Polite message after a creation; a trailing NBSP alternates so a repeat is read again.
  const [notice, setNotice] = useState('')
  const inputElement = useRef<HTMLInputElement | null>(null)
  const createButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  // NFC: a decomposed « é » counts as one character, as on the server (normalizeKey).
  const term = query.normalize('NFC').trim()
  const excludeKey = selectedIds.join(',')

  useEffect(() => {
    // A new term invalidates the current options immediately.
    setResults([])
    setActiveIndex(-1)
    if (term.length < AUTHOR_SEARCH_MIN_LENGTH) {
      setStatus('idle')
      return
    }
    setStatus('loading')
    const controller = new AbortController()
    const excluded = excludeKey === '' ? [] : excludeKey.split(',')
    const timer = window.setTimeout(async () => {
      try {
        const url = urlFor('admin.authors.search', {}, { qs: { q: term, exclude: excluded } })
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`search_failed_${response.status}`)
        const body = (await response.json()) as { authors: PickerAuthor[] }
        const found = body.authors.filter((author) => !excluded.includes(author.id))
        setResults(found)
        // First result, or the « Create » option when nothing was found.
        setActiveIndex(0)
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
  }, [term, excludeKey, retry])

  const hasTerm = term.length >= AUTHOR_SEARCH_MIN_LENGTH
  const showList = open && hasTerm
  const optionId = (index: number) => `${listId}-option-${index}`
  // The « Create author » option always comes last (index `results.length`).
  const createIndex = results.length
  const optionCount = results.length + 1

  function setInputRef(element: HTMLInputElement | null) {
    inputElement.current = element
    if (typeof inputRef === 'function') inputRef(element)
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = element
  }

  function openCreate(trigger: 'input' | 'button') {
    setDialogQuery(query)
    returnFocus.current = trigger === 'input' ? inputElement.current : createButton.current
    setOpen(false)
    setDialogOpen(true)
  }

  function handleCreated(author: PickerAuthor) {
    returnFocus.current = inputElement.current
    onSelect(author)
    setQuery('')
    setResults([])
    setStatus('idle')
    setActiveIndex(-1)
    notify.success(t('authors.flash.created'))
    const text = t('authors.dialog.added', { name: pickerAuthorLabel(author) })
    setNotice((previous) => (previous === text ? `${text}\u00a0` : text))
  }

  useEffect(() => {
    if (activeIndex < 0) return
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, listId])

  function retryAfterError() {
    if (status === 'error') setRetry((count) => count + 1)
  }

  function select(author: PickerAuthor) {
    // Never an option of a search still running (its results were cleared anyway).
    if (status === 'loading') return
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
        if (event.key === 'ArrowDown') retryAfterError()
        if (!hasTerm) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((current) =>
          current < 0
            ? delta === 1
              ? 0
              : optionCount - 1
            : (current + delta + optionCount) % optionCount
        )
        return
      }
      case 'Enter':
        // Never submits the production form from the search input.
        event.preventDefault()
        retryAfterError()
        if (showList && activeIndex === createIndex) {
          openCreate('input')
        } else if (status !== 'loading' && showList && activeIndex >= 0 && results[activeIndex]) {
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
    status === 'loading' && results.length === 0
      ? t('authors.picker.loading')
      : status === 'error'
        ? t('authors.picker.error')
        : status === 'ready' && results.length === 0
          ? t('authors.picker.no_results')
          : null

  const searchAnnouncement =
    status === 'error'
      ? t('authors.picker.error')
      : status === 'ready'
        ? results.length === 0
          ? t('authors.picker.no_results')
          : t('authors.picker.results_count', { count: results.length })
        : ''
  const announcement = searchAnnouncement || notice

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {t('authors.picker.label')}
      </label>
      {/* Always mounted (never inside the hidden popup): results announced politely. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="mt-1 flex items-start gap-2">
        <div className="relative min-w-0 flex-1">
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
              showList && activeIndex >= 0 && activeIndex < optionCount
                ? optionId(activeIndex)
                : undefined
            }
            aria-invalid={invalid}
            aria-describedby={describedBy}
            placeholder={t('authors.picker.placeholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setNotice('')
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
              retryAfterError()
            }}
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
                    <AuthorStatusBadges
                      isPublic={author.isPublic}
                      isIncomplete={author.isIncomplete}
                      showConsent={false}
                    />
                  </li>
                )
              })}
              {/* Always the last option (Story 9.8): opens the « Create an author » window. */}
              <li
                key="create"
                id={optionId(createIndex)}
                role="option"
                aria-selected={activeIndex === createIndex}
                onClick={() => openCreate('input')}
                onMouseEnter={() => setActiveIndex(createIndex)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 border-t border-stone-100 px-3 py-2 text-sm font-medium text-primary',
                  activeIndex === createIndex && 'bg-accent'
                )}
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {t('authors.picker.create_option', { query: term })}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <Button
          ref={createButton}
          type="button"
          variant="outline"
          onClick={() => openCreate('button')}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('authors.create_button')}
        </Button>
      </div>


      <AuthorFormDialog
        open={dialogOpen}
        initialQuery={dialogQuery}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
        returnFocusRef={returnFocus}
      />
    </div>
  )
}
