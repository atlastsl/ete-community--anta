/**
 * Author card form (Story 9.1): shared types, display name and the client copy of the
 * server rules (`app/validators/admin/author_validator.ts`). Intentional duplication,
 * like `production_completion.ts`: same limits, same i18n keys, keyed like VineJS
 * (`affiliations.0.institution`). Photo (Story 9.3): type and size are checked here too,
 * the server then decodes the image (`ImageService`).
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
}

/** "Prénom NOM": last name upper-cased for display only, the data keeps its case (D13, D34). */
export function formatAuthorName(firstNames: string, lastNames: string): string {
  return `${firstNames} ${lastNames.toLocaleUpperCase('fr-FR')}`.trim()
}

/** Initials of the avatar (D13): first letter of the first word of each field, capitals. */
export function authorInitials(firstNames: string, lastNames: string): string {
  const initial = (value: string) => {
    const word = value.trim().split(/\s+/)[0] ?? ''
    return Array.from(word)[0] ?? ''
  }
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
    if (!PHOTO_MIME_TYPES.includes(data.photo.type)) {
      errors.photo = 'authors.form.errors.photo_type'
    } else if (data.photo.size > PHOTO_MAX_BYTES) {
      errors.photo = 'authors.form.errors.photo_size'
    }
  }

  return errors
}

/**
 * Request body: trimmed values, empty optional fields omitted. A chosen file makes Inertia
 * send multipart; `removePhoto` is sent only when checked and no new file is chosen.
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
  }
}
