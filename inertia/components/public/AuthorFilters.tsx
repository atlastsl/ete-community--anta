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
import SortSelect from '~/components/shared/SortSelect'
import { taxonomyLabel } from '~/lib/taxonomy'
import { AUTHORS_LIST_SORTS, type AuthorsListState } from '~/lib/authors_list_query'

/** Radix `Select` refuses `value=""`: sentinel for "all" (not a plausible label). */
const ALL_VALUE = '__all__'

const LABEL = 'mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500'

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
export default function AuthorFilters({ state, institutionOptions, domainOptions, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const [q, setQ] = useState(state.q ?? '')

  // Server state wins after a navigation (clear filters, back button).
  useEffect(() => setQ(state.q ?? ''), [state.q])

  function submit(event: FormEvent) {
    event.preventDefault()
    onChange({ ...state, q: q.trim() || null })
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
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
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
              className="min-h-11 bg-white pl-9"
            />
          </div>
        </div>

        <div>
          <label id="authors-institution-label" className={LABEL}>
            {t('authors.list.institution_label')}
          </label>
          <Select
            value={institution}
            onValueChange={(v) => onChange({ ...state, institution: v === ALL_VALUE ? null : v })}
          >
            <SelectTrigger
              aria-labelledby="authors-institution-label"
              className="min-h-11 w-full bg-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_VALUE}>{t('authors.list.institution_all')}</SelectItem>
              {institutionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
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
            onValueChange={(v) => onChange({ ...state, domain: v === ALL_VALUE ? null : v })}
          >
            <SelectTrigger aria-labelledby="authors-domain-label" className="min-h-11 w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_VALUE}>{t('authors.list.domain_all')}</SelectItem>
              {domains.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SortSelect
          id="authors-sort"
          value={state.sort}
          onChange={(sort) => onChange({ ...state, sort })}
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
