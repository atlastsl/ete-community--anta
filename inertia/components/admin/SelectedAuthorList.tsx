import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import Avatar from '~/components/shared/Avatar'
import { cn } from '~/lib/utils'
import {
  type PickerAuthor,
  moveItem,
  pickerAffiliationLabel,
  pickerAuthorLabel,
} from '~/lib/author_picker'

type Action = 'up' | 'down' | 'remove'

type Props = {
  authors: PickerAuthor[]
  onChange: (authors: PickerAuthor[]) => void
  /** Focus target once the last author is removed (the search input). */
  onEmptied?: () => void
}

/**
 * Selected authors of a production, in publication order (Story 9.7, D18; mockup
 * `admin-author-picker.html`: position, avatar, name, first affiliation): ↑ ↓ move one rank
 * (unavailable at the ends, with the reason given to assistive technologies), × removes;
 * buttons named after the author; the focus stays on the activated button (after a removal:
 * the next ×, else the previous one, else the search input); moves and removals announced
 * politely, a repeated message being spoken again. No drag and drop, no link to the card.
 */
export default function SelectedAuthorList({ authors, onChange, onEmptied }: Props) {
  const { t } = useTranslation()
  const reasonId = useId()
  // The counter re-mounts the message node: an identical announcement is spoken again.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 })
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    const key = pendingFocus.current
    if (key === null) return
    pendingFocus.current = null
    buttons.current.get(key)?.focus()
  }, [authors])

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ text, count: previous.count + 1 }))

  const buttonRef = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(key, element)
    else buttons.current.delete(key)
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= authors.length) return
    const author = authors[index]
    pendingFocus.current = `${author.id}:${delta === -1 ? 'up' : 'down'}`
    onChange(moveItem(authors, index, delta))
    announce(t('authors.picker.moved', { name: pickerAuthorLabel(author), n: target + 1 }))
  }

  function remove(index: number) {
    const author = authors[index]
    const next = authors.filter((_, i) => i !== index)
    const neighbour = next[index] ?? next[index - 1]
    pendingFocus.current = neighbour ? `${neighbour.id}:remove` : null
    onChange(next)
    announce(t('authors.picker.removed', { name: pickerAuthorLabel(author) }))
    if (!neighbour) onEmptied?.()
  }

  function actionButton(author: PickerAuthor, index: number, action: Action) {
    const name = pickerAuthorLabel(author)
    // aria-disabled (not disabled): the focus stays on the button when it reaches an end.
    const unavailable =
      (action === 'up' && index === 0) || (action === 'down' && index === authors.length - 1)
    const Icon = action === 'up' ? ArrowUp : action === 'down' ? ArrowDown : X
    const label =
      action === 'up'
        ? t('authors.picker.move_up', { name })
        : action === 'down'
          ? t('authors.picker.move_down', { name })
          : t('authors.picker.remove', { name })
    return (
      <Button
        ref={buttonRef(`${author.id}:${action}`)}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        aria-disabled={unavailable || undefined}
        aria-describedby={unavailable ? `${reasonId}-${action}` : undefined}
        onClick={() => {
          if (unavailable) return
          if (action === 'remove') remove(index)
          else move(index, action === 'up' ? -1 : 1)
        }}
        className={cn('size-8', unavailable && 'cursor-not-allowed opacity-40')}
      >
        <Icon className="size-4" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div>
      {authors.length > 0 ? (
        <ol
          aria-label={t('authors.picker.selected_label')}
          className="divide-y divide-stone-200 rounded-md border border-stone-200"
        >
          {authors.map((author, index) => {
            const affiliation = pickerAffiliationLabel(author)
            return (
              <li key={author.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-right text-sm tabular-nums text-stone-500">
                  {index + 1}
                </span>
                <Avatar
                  src={author.photoUrl}
                  firstNames={author.firstNames}
                  lastNames={author.lastNames}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-stone-900">
                    {pickerAuthorLabel(author)}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {affiliation ?? t('authors.no_affiliation')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center">
                  {actionButton(author, index, 'up')}
                  {actionButton(author, index, 'down')}
                  {actionButton(author, index, 'remove')}
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500">
          {t('authors.picker.empty')}
        </p>
      )}
      {/* Reasons of the unavailable ↑ / ↓ (referenced by aria-describedby). */}
      <span id={`${reasonId}-up`} className="sr-only">
        {t('authors.picker.already_first')}
      </span>
      <span id={`${reasonId}-down`} className="sr-only">
        {t('authors.picker.already_last')}
      </span>
      <p aria-live="polite" className="sr-only">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
    </div>
  )
}
