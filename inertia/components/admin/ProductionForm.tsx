import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import CompletionIndicator, { type FieldStatus } from '~/components/admin/CompletionIndicator'
import ChipInput from '~/components/admin/ChipInput'
import FileUploader, { type ProductionFileRow } from '~/components/admin/FileUploader'
import LinkManager, { type ProductionLinkRow } from '~/components/admin/LinkManager'
import { isAttachmentSatisfied } from '~/lib/production_completion'

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
  authors: string[]
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
    { key: 'authors', labelKey: 'productions.form.fields.authors', filled: data.authors.length > 0 },
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
  errors: Partial<Record<keyof ProductionFormData, string>>
  /** Présent uniquement en édition (Story 4.7) : active l'upload de fichiers et la gestion des liens. */
  productionId?: string
  files?: ProductionFileRow[]
  links?: ProductionLinkRow[]
  /** Valeurs existantes pour l'auto-complétion des champs (auteur, catégorie…). */
  suggestions?: ProductionSuggestions
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
  suggestions = EMPTY_SUGGESTIONS,
}: Props) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Règle d'attachement (AC5 Story 4.5) : pour external_link, un lien est requis ;
  // sinon un fichier OU un lien suffit.
  const hasFileOrLink = isAttachmentSatisfied(data.licenseStatus, files.length > 0, links.length > 0)

  const fields = getRequiredFieldStatuses(data)
  const filledMap = new Map(fields.map((f) => [f.key, f.filled]))

  function markTouched(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  /** Message d'erreur d'un champ : erreur serveur prioritaire, sinon hint "requis pour publier" au blur. */
  function fieldError(key: keyof ProductionFormData): string | null {
    if (errors[key]) return t(errors[key]!, { defaultValue: errors[key]! })
    if (REQUIRED_KEYS.has(key) && touched[key] && !filledMap.get(key)) {
      return t('productions.form.errors.required_to_publish')
    }
    return null
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
          <SelectTrigger id="publicationCountry" className="mt-1 w-72" aria-invalid={!!error}>
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
  }: {
    name: 'authors' | 'tags' | 'subdomain'
    suggestions: string[]
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
          suggestions={fieldSuggestions}
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

  return (
    <div className="space-y-8">
      <CompletionIndicator fields={fields} hasFileOrLink={hasFileOrLink} />

      <Section legend={t('productions.form.sections.general')}>
        {TextField({ name: 'title', required: true })}
        {ChipField({ name: 'authors', suggestions: suggestions.authors })}
        {TextField({ name: 'category', required: true, suggestions: suggestions.categories })}
        {TextField({ name: 'domain', required: true, suggestions: suggestions.domains })}
        {data.domain.trim() !== '' &&
          ChipField({ name: 'subdomain', suggestions: suggestions.subdomains })}
        {TextField({ name: 'language', required: true, suggestions: suggestions.languages })}
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
            <SelectTrigger id="licenseStatus" className="mt-1 w-72">
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
        {productionId ? (
          <div className="space-y-6">
            <FileUploader productionId={productionId} files={files} />
            <LinkManager productionId={productionId} links={links} />
          </div>
        ) : (
          <p className="text-sm text-stone-500">{t('productions.form.files_placeholder')}</p>
        )}
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
  return name
}
