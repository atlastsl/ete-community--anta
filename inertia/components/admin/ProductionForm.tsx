import { ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { AFRICAN_COUNTRIES, OTHER_COUNTRIES, ALL_COUNTRIES } from '~/lib/countries'
import { LANGUAGE_OPTIONS } from '~/lib/languages'
import {
  PRODUCTION_CATEGORIES,
  PRODUCTION_DOMAINS,
  allowedSubdomainsForDomain,
  filterSubdomainsForDomain,
  taxonomyLabel,
} from '~/lib/taxonomy'
import type { PendingProductionLink } from '~/lib/production_submit'
import CompletionIndicator, { type FieldStatus } from '~/components/admin/CompletionIndicator'
import ChipInput from '~/components/admin/ChipInput'
import AuthorCombobox from '~/components/admin/AuthorCombobox'
import SelectedAuthorList from '~/components/admin/SelectedAuthorList'
import type { PickerAuthor } from '~/lib/author_picker'
import FileUploader, { type ProductionFileRow } from '~/components/admin/FileUploader'
import LinkManager, { type ProductionLinkRow } from '~/components/admin/LinkManager'
import { hasRequiredAuthors, isAttachmentSatisfied } from '~/lib/production_completion'

/** Valeurs existantes en BDD pour l'auto-complétion (toutes statuts). */
export type ProductionSuggestions = {
  authors: string[]
  tags: string[]
  subdomains: string[]
  categories: string[]
  domains: string[]
  languages: string[]
}

const EMPTY_SUGGESTIONS: ProductionSuggestions = {
  authors: [],
  tags: [],
  subdomains: [],
  categories: [],
  domains: [],
  languages: [],
}

export type ProductionFormData = {
  title: string
  summary: string
  /** Selected authors of the referential, in order (Story 9.7); sent as `authorIds`. */
  authors: PickerAuthor[]
  tags: string[]
  category: string
  domain: string
  subdomain: string[]
  language: string
  publicationCountry: string
  journal: string
  publisher: string
  isbnDoiIssn: string
  institution: string
  licenseStatus: 'member' | 'free_license' | 'external_link'
  workPublishedAt: string
}

export const EMPTY_PRODUCTION_FORM: ProductionFormData = {
  title: '',
  summary: '',
  authors: [],
  tags: [],
  category: '',
  domain: '',
  subdomain: [],
  language: '',
  publicationCountry: '',
  journal: '',
  publisher: '',
  isbnDoiIssn: '',
  institution: '',
  licenseStatus: 'member',
  workPublishedAt: '',
}

/** Champs obligatoires pour PUBLIER (FR21) + leur état de complétion. */
export function getRequiredFieldStatuses(data: ProductionFormData): FieldStatus[] {
  const text = (v: string) => v.trim() !== ''
  return [
    { key: 'title', labelKey: 'productions.form.fields.title', filled: text(data.title) },
    {
      key: 'authors',
      labelKey: 'productions.form.completion.authors',
      filled: hasRequiredAuthors(data.authors),
    },
    { key: 'category', labelKey: 'productions.form.fields.category', filled: text(data.category) },
    { key: 'domain', labelKey: 'productions.form.fields.domain', filled: text(data.domain) },
    {
      key: 'subdomain',
      labelKey: 'productions.form.fields.subdomain',
      filled: data.subdomain.length > 0,
    },
    { key: 'language', labelKey: 'productions.form.fields.language', filled: text(data.language) },
    {
      key: 'publicationCountry',
      labelKey: 'productions.form.fields.country',
      filled: text(data.publicationCountry),
    },
    { key: 'summary', labelKey: 'productions.form.fields.summary', filled: text(data.summary) },
    { key: 'tags', labelKey: 'productions.form.fields.tags', filled: data.tags.length > 0 },
    {
      key: 'workPublishedAt',
      labelKey: 'productions.form.fields.work_published_at',
      filled: text(data.workPublishedAt),
    },
    { key: 'licenseStatus', labelKey: 'productions.form.fields.license', filled: true },
  ]
}

type Setter = <K extends keyof ProductionFormData>(key: K, value: ProductionFormData[K]) => void

type Props = {
  data: ProductionFormData
  setData: Setter
  /** `authorIds` : erreurs serveur de la sélection d'auteurs (Story 9.7). */
  errors: Partial<Record<keyof ProductionFormData | 'authorIds', string>>
  /** Présent en édition : id persisté. Absent en création : files/links en attente côté client. */
  productionId?: string
  files?: ProductionFileRow[]
  links?: ProductionLinkRow[]
  pendingFiles?: File[]
  onPendingFilesChange?: (files: File[]) => void
  pendingLinks?: PendingProductionLink[]
  onPendingLinksChange?: (links: PendingProductionLink[]) => void
  /** Valeurs existantes pour l'auto-complétion (tags). */
  suggestions?: ProductionSuggestions
  /**
   * Noms de la colonne dénormalisée qu'aucune fiche liée ne porte (production non convertie
   * ou partiellement rattachée) : avertissement « Auteurs à rattacher » (Story 9.7, D-9.7-k).
   */
  legacyAuthorNames?: string[]
  /** La colonne dénormalisée contient une valeur non textuelle (message générique). */
  legacyAuthorsNonText?: boolean
}

const REQUIRED_KEYS = new Set([
  'title',
  'authors',
  'category',
  'domain',
  'subdomain',
  'language',
  'publicationCountry',
  'summary',
  'tags',
  'workPublishedAt',
])

export default function ProductionForm({
  data,
  setData,
  errors,
  productionId,
  files = [],
  links = [],
  pendingFiles = [],
  onPendingFilesChange,
  pendingLinks = [],
  onPendingLinksChange,
  suggestions = EMPTY_SUGGESTIONS,
  legacyAuthorNames = [],
  legacyAuthorsNonText = false,
}: Props) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const authorSearchRef = useRef<HTMLInputElement>(null)

  const hasFileOrLink = isAttachmentSatisfied(
    data.licenseStatus,
    files.length + pendingFiles.length > 0,
    links.length + pendingLinks.length > 0
  )

  const fields = getRequiredFieldStatuses(data)
  const filledMap = new Map(fields.map((f) => [f.key, f.filled]))

  function markTouched(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  /** Message d'erreur d'un champ : erreur serveur prioritaire, sinon hint "requis pour publier" au blur. */
  function fieldError(key: keyof ProductionFormData): string | null {
    if (errors[key]) return t(errors[key]!, { defaultValue: errors[key]! })
    if (key === 'authors') {
      // `authorIds` or a per-element `authorIds.N` (uuid) error of the server.
      const authorError = Object.entries(errors as Record<string, string | undefined>).find(
        ([field, message]) => (field === 'authorIds' || field.startsWith('authorIds.')) && message
      )?.[1]
      if (authorError) return t(authorError, { defaultValue: authorError })
    }
    if (REQUIRED_KEYS.has(key) && touched[key] && !filledMap.get(key)) {
      return t('productions.form.errors.required_to_publish')
    }
    return null
  }

  /** Liste déroulante taxonomie (catégorie, domaine). */
  function TaxonomySelect({
    name,
    options,
    group,
  }: {
    name: 'category' | 'domain'
    options: readonly string[]
    group: 'categories' | 'domains'
  }) {
    const error = fieldError(name)
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium text-stone-700">
          {t(`productions.form.fields.${name}`)}
          <span className="text-red-600"> *</span>
        </label>
        <Select
          value={data[name] || undefined}
          onValueChange={(value) => {
            setData(name, value)
            markTouched(name)
            if (name === 'domain') {
              setData('subdomain', filterSubdomainsForDomain(value, data.subdomain))
            }
          }}
        >
          <SelectTrigger id={name} className="mt-1 w-full" aria-invalid={!!error}>
            <SelectValue placeholder={t('productions.form.select_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((key) => (
              <SelectItem key={key} value={key}>
                {taxonomyLabel(t, group, key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  function TextField({
    name,
    type = 'text',
    required = false,
    suggestions: fieldSuggestions,
  }: {
    name: keyof ProductionFormData
    type?: string
    required?: boolean
    suggestions?: string[]
  }) {
    const error = fieldError(name)
    const listId = fieldSuggestions && fieldSuggestions.length > 0 ? `${name}-suggestions` : undefined
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium text-stone-700">
          {t(`productions.form.fields.${labelKeyFor(name)}`)}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <Input
          id={name}
          type={type}
          list={listId}
          value={data[name] as string}
          onChange={(e) => setData(name, e.target.value as never)}
          onBlur={() => markTouched(name)}
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={!!error}
          className="mt-1"
        />
        {listId && (
          <datalist id={listId}>
            {fieldSuggestions!.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {error && (
          <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  /** Pays de publication : liste déroulante (pays africains en tête, puis le reste du monde). */
  function CountryField() {
    const error = fieldError('publicationCountry')
    const current = data.publicationCountry
    const known = ALL_COUNTRIES.includes(current)
    return (
      <div>
        <label htmlFor="publicationCountry" className="text-sm font-medium text-stone-700">
          {t('productions.form.fields.country')}
          <span className="text-red-600"> *</span>
        </label>
        <Select
          value={current || undefined}
          onValueChange={(v) => {
            setData('publicationCountry', v)
            markTouched('publicationCountry')
          }}
        >
          <SelectTrigger id="publicationCountry" className="mt-1 w-full" aria-invalid={!!error}>
            <SelectValue placeholder={t('productions.form.country_placeholder')} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {current && !known && <SelectItem value={current}>{current}</SelectItem>}
            <SelectGroup>
              <SelectLabel>{t('productions.form.country_group_africa')}</SelectLabel>
              {AFRICAN_COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t('productions.form.country_group_other')}</SelectLabel>
              {OTHER_COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {error && (
          <p id="publicationCountry-error" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }

  /** Champ multi-valeurs (chips) avec libellé, hint, erreur et suggestions. */
  function ChipField({
    name,
    suggestions: fieldSuggestions,
    allowedValues,
    formatChip,
  }: {
    name: 'tags' | 'subdomain'
    suggestions?: string[]
    allowedValues?: readonly string[]
    formatChip?: (key: string) => string
  }) {
    const error = fieldError(name)
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium text-stone-700">
          {t(`productions.form.fields.${name}`)}
          <span className="text-red-600"> *</span>
        </label>
        <ChipInput
          id={name}
          value={data[name]}
          onChange={(v) => setData(name, v)}
          onBlur={() => markTouched(name)}
          suggestions={fieldSuggestions ?? []}
          allowedValues={allowedValues}
          formatChip={formatChip}
          placeholder={t('productions.form.chip_hint')}
          invalid={!!error}
          describedBy={error ? `${name}-error` : `${name}-hint`}
        />
        {error ? (
          <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        ) : (
          <p id={`${name}-hint`} className="mt-1 text-xs text-stone-500">
            {t('productions.form.chip_hint')}
          </p>
        )}
      </div>
    )
  }

  /**
   * Fieldset « Auteurs » (Story 9.7, D18) : sélection ordonnée dans le référentiel, plus de
   * saisie libre (FR54). Appelé comme fonction (pas `<AuthorsField />`) pour ne pas remonter
   * le combobox à chaque rendu.
   */
  function authorsField() {
    const error = fieldError('authors')
    const showLegacy = legacyAuthorNames.length > 0 || legacyAuthorsNonText
    const selectedIds = data.authors.map((author) => author.id)
    return (
      <fieldset aria-describedby="authors-hint">
        <legend className="text-sm font-medium text-stone-700">
          {t('productions.form.fields.authors')}
          <span className="text-red-600"> *</span>
        </legend>
        <p id="authors-hint" className="mt-1 text-xs text-stone-500">
          {t('productions.form.authors_hint')}
        </p>
        {showLegacy && (
          <div
            role="note"
            className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{t('authors.picker.legacy_title')}</p>
              {legacyAuthorNames.length > 0 && (
                <p className="mt-1">
                  {t('authors.picker.legacy_description', {
                    names: legacyAuthorNames.join(', '),
                  })}
                </p>
              )}
              {legacyAuthorsNonText && (
                <p className="mt-1">{t('authors.picker.legacy_non_text')}</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-2 space-y-3">
          <SelectedAuthorList
            authors={data.authors}
            onChange={(next) => {
              setData('authors', next)
              markTouched('authors')
            }}
            onEmptied={() => authorSearchRef.current?.focus()}
          />
          <AuthorCombobox
            id="authors"
            inputRef={authorSearchRef}
            selectedIds={selectedIds}
            onSelect={(author) => {
              // Already selected (stale result): no duplicate.
              if (selectedIds.includes(author.id)) return
              setData('authors', [...data.authors, author])
            }}
            onBlur={() => markTouched('authors')}
            invalid={!!error}
            describedBy={error ? 'authors-error authors-hint' : 'authors-hint'}
          />
        </div>
        {error && (
          <p id="authors-error" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </fieldset>
    )
  }

  return (
    <div className="space-y-8">
      <CompletionIndicator fields={fields} hasFileOrLink={hasFileOrLink} />

      <Section legend={t('productions.form.sections.general')}>
        {TextField({ name: 'title', required: true })}
        {authorsField()}
        <TaxonomySelect name="category" options={PRODUCTION_CATEGORIES} group="categories" />
        <TaxonomySelect name="domain" options={PRODUCTION_DOMAINS} group="domains" />
        {data.domain.trim() !== '' &&
          ChipField({
            name: 'subdomain',
            allowedValues: allowedSubdomainsForDomain(data.domain),
            formatChip: (key) => taxonomyLabel(t, 'subdomains', key),
          })}
        <div>
          <label htmlFor="language" className="text-sm font-medium text-stone-700">
            {t('productions.form.fields.language')}
            <span className="text-red-600"> *</span>
          </label>
          <Select value={data.language} onValueChange={(value) => setData('language', value)}>
            <SelectTrigger id="language" className="mt-1 w-full">
              <SelectValue placeholder={t('productions.form.fields.language')} />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {CountryField()}
      </Section>

      <Section legend={t('productions.form.sections.content')}>
        <div>
          <label htmlFor="summary" className="text-sm font-medium text-stone-700">
            {t('productions.form.fields.summary')}
            <span className="text-red-600"> *</span>
          </label>
          <textarea
            id="summary"
            value={data.summary}
            onChange={(e) => setData('summary', e.target.value)}
            onBlur={() => markTouched('summary')}
            rows={5}
            aria-describedby={fieldError('summary') ? 'summary-error' : undefined}
            aria-invalid={!!fieldError('summary')}
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {fieldError('summary') && (
            <p id="summary-error" className="mt-1 text-sm text-red-600">
              {fieldError('summary')}
            </p>
          )}
        </div>
        {ChipField({ name: 'tags', suggestions: suggestions.tags })}
        {TextField({ name: 'workPublishedAt', type: 'date', required: true })}
      </Section>

      <Section legend={t('productions.form.sections.rights')}>
        <div>
          <label htmlFor="licenseStatus" className="text-sm font-medium text-stone-700">
            {t('productions.form.fields.license')}
            <span className="text-red-600"> *</span>
          </label>
          <Select
            value={data.licenseStatus}
            onValueChange={(value) =>
              setData('licenseStatus', value as ProductionFormData['licenseStatus'])
            }
          >
            <SelectTrigger id="licenseStatus" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t('productions.form.license.member')}</SelectItem>
              <SelectItem value="free_license">
                {t('productions.form.license.free_license')}
              </SelectItem>
              <SelectItem value="external_link">
                {t('productions.form.license.external_link')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section legend={t('productions.form.sections.optional')}>
        {TextField({ name: 'journal' })}
        {TextField({ name: 'publisher' })}
        {TextField({ name: 'isbnDoiIssn' })}
        {TextField({ name: 'institution' })}
      </Section>

      <Section legend={t('productions.form.sections.files')}>
        <div className="space-y-6">
          <FileUploader
            productionId={productionId}
            files={files}
            pendingFiles={pendingFiles}
            onPendingFilesChange={onPendingFilesChange}
          />
          <LinkManager
            productionId={productionId}
            links={links}
            pendingLinks={pendingLinks}
            onPendingLinksChange={onPendingLinksChange}
          />
        </div>
      </Section>
    </div>
  )
}

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-stone-200 p-6">
      <legend className="px-2 text-sm font-semibold text-stone-900">{legend}</legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}

/** Mappe le nom de champ vers la sous-clé i18n du label (identité ici, sauf alias). */
function labelKeyFor(name: string): string {
  if (name === 'publicationCountry') return 'country'
  if (name === 'workPublishedAt') return 'work_published_at'
  return name
}
