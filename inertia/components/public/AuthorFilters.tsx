import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import SortSelect, { OPTION_FOCUS } from '~/components/shared/SortSelect'
import { taxonomyLabel } from '~/lib/taxonomy'
import { AUTHORS_LIST_SORTS, type AuthorsListState } from '~/lib/authors_list_query'

/** Radix `Select` refuses `value=""`: sentinel for "all" (not a plausible label). */
const ALL_VALUE = '__all__'

const LABEL = 'mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500'

/**
 * Fields (Story 13.2): border ≥ 3:1 (stone-500, 4.8:1 — WCAG 1.4.11, D33 amended: the fields are
 * not identifiable without it) and a solid 2 px focus ring instead of shadcn's 50 % one.
 */
const FIELD =
  'border-stone-500 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

type Props = {
  state: AuthorsListState
  institutionOptions: { value: string; label: string }[]
  domainOptions: string[]
  /** New state; the caller navigates (always back to page 1). */
  onChange: (state: AuthorsListState) => void
}

/**
 * Filters of the authors list (DESIGN.md `AuthorFilters`, D31, maquette `authors-list.html`):
 * name search (`q`, submitted with Enter), Institution and Domain (single choice), Sort. Visible
 * labels, 44 px controls; stacked < sm, 2 columns sm, 4 columns lg. The state lives in the URL.
 */
export default function AuthorFilters({
  state,
  institutionOptions,
  domainOptions,
  onChange,
}: Props) {
  const { t, i18n } = useTranslation()
  const [q, setQ] = useState(state.q ?? '')

  // Server state wins after a navigation (clear filters, back button).
  useEffect(() => setQ(state.q ?? ''), [state.q])

  /** Every change carries the typed search term (trimmed), not the last submitted one. */
  function change(patch: Partial<AuthorsListState>) {
    onChange({ ...state, q: q.trim() || null, ...patch })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    change({})
  }

  const institution = institutionOptions.some((o) => o.value === state.institution)
    ? state.institution!
    : ALL_VALUE
  // Domain keys of the taxonomy, shown with their translated label, in label order.
  const domains = domainOptions
    .map((value) => ({ value, label: taxonomyLabel(t, 'domains', value) }))
    .sort((a, b) => a.label.localeCompare(b.label, i18n.language))
  const domain = state.domain && domainOptions.includes(state.domain) ? state.domain : ALL_VALUE

  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
      <form
        role="search"
        aria-label={t('authors.list.filters_label')}
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <div>
          <label htmlFor="authors-q" className={LABEL}>
            {t('authors.list.search_label')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500"
              aria-hidden
            />
            <Input
              id="authors-q"
              type="search"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t('authors.list.search_placeholder')}
              enterKeyHint="search"
              className={`min-h-11 bg-white pl-9 placeholder:text-stone-500 ${FIELD}`}
            />
          </div>
        </div>

        <div>
          <label id="authors-institution-label" className={LABEL}>
            {t('authors.list.institution_label')}
          </label>
          <Select
            value={institution}
            onValueChange={(v) => change({ institution: v === ALL_VALUE ? null : v })}
          >
            <SelectTrigger
              aria-labelledby="authors-institution-label"
              className={`min-h-11 w-full bg-white ${FIELD}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_VALUE} className={OPTION_FOCUS}>
                {t('authors.list.institution_all')}
              </SelectItem>
              {institutionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className={OPTION_FOCUS}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label id="authors-domain-label" className={LABEL}>
            {t('authors.list.domain_label')}
          </label>
          <Select
            value={domain}
            onValueChange={(v) => change({ domain: v === ALL_VALUE ? null : v })}
          >
            <SelectTrigger
              aria-labelledby="authors-domain-label"
              className={`min-h-11 w-full bg-white ${FIELD}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_VALUE} className={OPTION_FOCUS}>
                {t('authors.list.domain_all')}
              </SelectItem>
              {domains.map((option) => (
                <SelectItem key={option.value} value={option.value} className={OPTION_FOCUS}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SortSelect
          id="authors-sort"
          value={state.sort}
          onChange={(sort) => change({ sort })}
          className="sm:w-full"
          options={AUTHORS_LIST_SORTS.map((value) => ({
            value,
            label: t(`authors.list.sort.${value}`),
          }))}
        />
      </form>
    </div>
  )
}
