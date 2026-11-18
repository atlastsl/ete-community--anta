/**
 * Author card form (Story 9.1): shared types, display name and the client copy of the
 * server rules (`app/validators/admin/author_validator.ts`). Intentional duplication,
 * like `production_completion.ts`: same limits, same i18n keys, keyed like VineJS
 * (`affiliations.0.institution`). Photo (Story 9.3): type and size are checked here too,
 * the server then decodes the image (`ImageService`). Consent (Story 9.4): the box needs an
 * affiliation (D27), checked here, in `assertAffiliationRule` and in `AuthorService`.
 */

export type AffiliationFormData = { institution: string; department: string }

export type AuthorFormData = {
  lastNames: string
  firstNames: string
  googleScholarUrl: string
  affiliations: AffiliationFormData[]
  /** Newly chosen file, sent as multipart; `null` keeps the saved photo. */
  photo: File | null
  /** Removes the saved photo (ignored when a new file is chosen). */
  removePhoto: boolean
  /** "The author has consented to the publication of their profile" (D16, optional). */
  consent: boolean
}

export const AUTHOR_NAME_MAX = 120
export const AFFILIATION_FIELD_MAX = 255
export const SCHOLAR_URL_MAX = 500
export const AFFILIATIONS_MAX = 20
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

export const EMPTY_AFFILIATION: AffiliationFormData = { institution: '', department: '' }

export const EMPTY_AUTHOR_FORM: AuthorFormData = {
  lastNames: '',
  firstNames: '',
  googleScholarUrl: '',
  affiliations: [{ ...EMPTY_AFFILIATION }],
  photo: null,
  removePhoto: false,
  consent: false,
}

/** At least one affiliation with an institution typed: the consent box is available (D27). */
export function hasEnteredAffiliation(affiliations: AffiliationFormData[]): boolean {
  return affiliations.some((a) => a.institution.trim() !== '')
}

/** "Prénom NOM": last name upper-cased for display only, the data keeps its case (D13, D34). */
export function formatAuthorName(firstNames: string, lastNames: string): string {
  return `${firstNames} ${lastNames.toLocaleUpperCase('fr-FR')}`.trim()
}

/** Initials of the avatar (D13): first letter of the first word of each field, capitals. */
export function authorInitials(firstNames: string, lastNames: string): string {
  // NFC: a decomposed « É » stays one character; leading punctuation (« (Jean) ») is skipped.
  const initial = (value: string) => value.normalize('NFC').match(/\p{L}|\p{N}/u)?.[0] ?? ''
  return `${initial(firstNames)}${initial(lastNames)}`.toLocaleUpperCase('fr-FR')
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
  } catch {
    return false
  }
}

/** Client validation: `{ field: i18nKey }`, empty when valid. */
export function validateAuthorForm(
  data: AuthorFormData,
  options: { requireAffiliation: boolean }
): Record<string, string> {
  const errors: Record<string, string> = {}
  const lastNames = data.lastNames.trim()
  const firstNames = data.firstNames.trim()

  if (!lastNames) errors.lastNames = 'authors.form.errors.last_names_required'
  else if (lastNames.length > AUTHOR_NAME_MAX)
    errors.lastNames = 'authors.form.errors.last_names_too_long'

  if (!firstNames) errors.firstNames = 'authors.form.errors.first_names_required'
  else if (firstNames.length > AUTHOR_NAME_MAX)
    errors.firstNames = 'authors.form.errors.first_names_too_long'

  if (options.requireAffiliation && data.affiliations.length === 0) {
    errors.affiliations = 'authors.form.errors.affiliation_required'
  } else if (data.affiliations.length > AFFILIATIONS_MAX) {
    errors.affiliations = 'authors.form.errors.affiliations_too_many'
  }

  data.affiliations.forEach((affiliation, index) => {
    const institution = affiliation.institution.trim()
    if (!institution) {
      errors[`affiliations.${index}.institution`] = 'authors.form.errors.institution_required'
    } else if (institution.length > AFFILIATION_FIELD_MAX) {
      errors[`affiliations.${index}.institution`] = 'authors.form.errors.institution_too_long'
    }
    if (affiliation.department.trim().length > AFFILIATION_FIELD_MAX) {
      errors[`affiliations.${index}.department`] = 'authors.form.errors.department_too_long'
    }
  })

  const scholar = data.googleScholarUrl.trim()
  if (scholar && (scholar.length > SCHOLAR_URL_MAX || !isHttpUrl(scholar))) {
    errors.googleScholarUrl = 'authors.form.errors.scholar_url_invalid'
  }

  if (data.photo) {
    // Some systems report no MIME type: fall back on the extension (the server decodes).
    const typeOk = data.photo.type
      ? PHOTO_MIME_TYPES.includes(data.photo.type)
      : /\.(jpe?g|png|webp)$/i.test(data.photo.name)
    if (!typeOk) {
      errors.photo = 'authors.form.errors.photo_type'
    } else if (data.photo.size > PHOTO_MAX_BYTES) {
      errors.photo = 'authors.form.errors.photo_size'
    }
  }

  if (data.consent && !hasEnteredAffiliation(data.affiliations)) {
    errors.consent = 'authors.form.errors.consent_requires_affiliation'
  }

  return errors
}

/**
 * Request body: trimmed values, empty optional fields omitted. A chosen file makes Inertia
 * send multipart; `removePhoto` is sent only when checked and no new file is chosen;
 * `consent` only when checked while available (an affiliation is entered).
 */
export function toAuthorPayload(data: AuthorFormData) {
  const scholar = data.googleScholarUrl.trim()
  return {
    lastNames: data.lastNames.trim(),
    firstNames: data.firstNames.trim(),
    affiliations: data.affiliations.map((a) => {
      const department = a.department.trim()
      return department
        ? { institution: a.institution.trim(), department }
        : { institution: a.institution.trim() }
    }),
    ...(scholar ? { googleScholarUrl: scholar } : {}),
    ...(data.photo instanceof File ? { photo: data.photo } : {}),
    ...(data.removePhoto && !data.photo ? { removePhoto: true } : {}),
    ...(data.consent && hasEnteredAffiliation(data.affiliations) ? { consent: true } : {}),
  }
}

/**
 * Prefill of the « Create an author » window from the picker query (Story 9.8, D36): spaces
 * collapsed, split at the last space — before = first names, last word = last names; a
 * single word = last names; an empty query = empty fields.
 */
export function splitAuthorQuery(query: string): { firstNames: string; lastNames: string } {
  const words = query.normalize('NFC').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { firstNames: '', lastNames: '' }
  const lastNames = words.pop()!
  return { firstNames: words.join(' '), lastNames }
}

/**
 * Multipart body of `toAuthorPayload` for a `fetch` request (Story 9.8): nested affiliations
 * as `affiliations[0][institution]`, booleans as `'1'` (accepted by the validator). An empty
 * affiliation list sends no field, which the server reads as « no affiliation » (multipart).
 */
export function toAuthorFormData(payload: ReturnType<typeof toAuthorPayload>): FormData {
  const body = new FormData()
  body.append('lastNames', payload.lastNames)
  body.append('firstNames', payload.firstNames)
  payload.affiliations.forEach((affiliation, index) => {
    body.append(`affiliations[${index}][institution]`, affiliation.institution)
    if ('department' in affiliation && affiliation.department) {
      body.append(`affiliations[${index}][department]`, affiliation.department)
    }
  })
  if (payload.googleScholarUrl) body.append('googleScholarUrl', payload.googleScholarUrl)
  if (payload.photo) body.append('photo', payload.photo)
  if (payload.consent) body.append('consent', '1')
  return body
}
