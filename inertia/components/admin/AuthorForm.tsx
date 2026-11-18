import { ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import {
  AFFILIATIONS_MAX,
  EMPTY_AFFILIATION,
  type AffiliationFormData,
  type AuthorFormData,
} from '~/lib/author_form'

type Setter = <K extends keyof AuthorFormData>(key: K, value: AuthorFormData[K]) => void

type Props = {
  data: AuthorFormData
  setData: Setter
  /** Server (Inertia) or client errors, keyed like VineJS: `affiliations.0.institution`. */
  errors: Record<string, string | undefined>
  /** A card created in the panel keeps at least one affiliation (FR52). */
  requireAffiliation: boolean
}

type Direction = 'up' | 'down'

/**
 * Author card fields (Story 9.1): names, ordered affiliations, Google Scholar link.
 * Photo and consent come with Stories 9.3 and 9.4. Reordering uses explicit ↑ ↓ buttons,
 * no drag and drop (D18).
 */
export default function AuthorForm({ data, setData, errors, requireAffiliation }: Props) {
  const { t } = useTranslation()
  const [announcement, setAnnouncement] = useState('')
  const [focusTarget, setFocusTarget] = useState<{ index: number; direction: Direction } | null>(
    null
  )
  // Errors keyed by index (`affiliations.0.institution`) no longer match their row once the
  // list is reordered or shortened: hide them until the next submit returns fresh errors.
  const [indexedErrorsStale, setIndexedErrorsStale] = useState(false)
  const moveButtons = useRef(new Map<string, HTMLButtonElement | null>())
  const [focusAdd, setFocusAdd] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)

  const affiliations = data.affiliations
  const count = affiliations.length

  // Keep the focus on the moved affiliation; fall back to the opposite arrow at the ends.
  useEffect(() => {
    if (!focusTarget) return
    const { index, direction } = focusTarget
    const preferred = moveButtons.current.get(`${index}-${direction}`)
    const fallback = moveButtons.current.get(`${index}-${direction === 'up' ? 'down' : 'up'}`)
    const target = preferred && !preferred.disabled ? preferred : fallback
    target?.focus()
    setFocusTarget(null)
  }, [focusTarget])

  useEffect(() => {
    if (!focusAdd) return
    addButton.current?.focus()
    setFocusAdd(false)
  }, [focusAdd])

  // New errors (client or server): reset the stale flag and focus the first invalid field.
  useEffect(() => {
    setIndexedErrorsStale(false)
    if (!Object.values(errors).some(Boolean)) return
    const invalid = container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(invalid ?? (errors.affiliations ? addButton.current : null))?.focus()
  }, [errors])

  // Same text twice in a row is not re-read by screen readers: alternate a trailing NBSP.
  function announce(text: string) {
    setAnnouncement((previous) => (previous === text ? `${text}\u00a0` : text))
  }

  function message(key: string): string | null {
    if (indexedErrorsStale && key.startsWith('affiliations.')) return null
    const value = errors[key]
    return value ? t(value, { defaultValue: value }) : null
  }

  function updateAffiliation(index: number, patch: Partial<AffiliationFormData>) {
    setData(
      'affiliations',
      affiliations.map((a, i) => (i === index ? { ...a, ...patch } : a))
    )
  }

  function move(index: number, direction: Direction) {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= count) return
    const next = [...affiliations]
    ;[next[index], next[target]] = [next[target], next[index]]
    setData('affiliations', next)
    setIndexedErrorsStale(true)
    announce(t('authors.form.moved', { n: target + 1 }))
    setFocusTarget({ index: target, direction })
  }

  function remove(index: number) {
    setData(
      'affiliations',
      affiliations.filter((_, i) => i !== index)
    )
    setIndexedErrorsStale(true)
    announce(t('authors.form.removed'))
    // The focused × button is unmounted: move the focus to "Add" once it is re-enabled.
    setFocusAdd(true)
  }

  function add() {
    if (count >= AFFILIATIONS_MAX) return
    setData('affiliations', [...affiliations, { ...EMPTY_AFFILIATION }])
  }

  return (
    <div ref={container} className="space-y-6">
      <Section legend={t('authors.form.sections.identity')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="lastNames"
            label={t('authors.form.fields.last_names')}
            required
            value={data.lastNames}
            onChange={(v) => setData('lastNames', v)}
            error={message('lastNames')}
            autoComplete="family-name"
          />
          <Field
            id="firstNames"
            label={t('authors.form.fields.first_names')}
            required
            value={data.firstNames}
            onChange={(v) => setData('firstNames', v)}
            error={message('firstNames')}
            autoComplete="given-name"
          />
        </div>
      </Section>

      <Section legend={t('authors.form.sections.affiliations')}>
        <p className="text-sm text-stone-500">
          {count === 0 ? t('authors.form.no_affiliation_yet') : t('authors.form.primary_hint')}
        </p>

        {count > 0 && (
          <ol className="mt-4 space-y-3">
            {affiliations.map((affiliation, index) => {
              const n = index + 1
              const removeDisabled = requireAffiliation && count === 1
              return (
                <li key={index} className="rounded-md border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-stone-900">
                      {t('authors.form.affiliation_n', { n })}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        ref={(el) => {
                          moveButtons.current.set(`${index}-up`, el)
                        }}
                        disabled={index === 0}
                        onClick={() => move(index, 'up')}
                        aria-label={t('authors.form.move_up', { n })}
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        ref={(el) => {
                          moveButtons.current.set(`${index}-down`, el)
                        }}
                        disabled={index === count - 1}
                        onClick={() => move(index, 'down')}
                        aria-label={t('authors.form.move_down', { n })}
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={removeDisabled}
                        onClick={() => remove(index)}
                        aria-label={t('authors.form.remove', { n })}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field
                      id={`affiliations.${index}.institution`}
                      label={t('authors.form.fields.institution')}
                      required
                      value={affiliation.institution}
                      onChange={(v) => updateAffiliation(index, { institution: v })}
                      error={message(`affiliations.${index}.institution`)}
                    />
                    <Field
                      id={`affiliations.${index}.department`}
                      label={t('authors.form.fields.department')}
                      value={affiliation.department}
                      onChange={(v) => updateAffiliation(index, { department: v })}
                      error={message(`affiliations.${index}.department`)}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {message('affiliations') && (
          <p id="affiliations-error" className="mt-3 text-sm text-red-600">
            {message('affiliations')}
          </p>
        )}

        <Button
          ref={addButton}
          type="button"
          variant="ghost"
          className="mt-3"
          aria-describedby={message('affiliations') ? 'affiliations-error' : undefined}
          onClick={add}
          disabled={count >= AFFILIATIONS_MAX}
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t('authors.form.add_affiliation')}
        </Button>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </Section>

      <Section legend={t('authors.form.sections.links')}>
        <Field
          id="googleScholarUrl"
          type="url"
          label={t('authors.form.fields.google_scholar_url')}
          placeholder={t('authors.form.scholar_placeholder')}
          value={data.googleScholarUrl}
          onChange={(v) => setData('googleScholarUrl', v)}
          error={message('googleScholarUrl')}
        />
      </Section>
    </div>
  )
}

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-stone-200 p-6">
      <legend className="px-2 text-sm font-semibold text-stone-900">{legend}</legend>
      {children}
    </fieldset>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error: string | null
  required?: boolean
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete ?? 'off'}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="mt-1"
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
