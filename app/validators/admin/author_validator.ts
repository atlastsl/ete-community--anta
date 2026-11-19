import vine, { SimpleMessagesProvider, errors } from '@vinejs/vine'

/** Limits shared with the client rules (`inertia/lib/author_form.ts`). */
export const AUTHOR_NAME_MAX = 120
export const AFFILIATION_FIELD_MAX = 255
export const SCHOLAR_URL_MAX = 500
export const AFFILIATIONS_MAX = 20
/** Photo limits (Story 9.3), shared with `inertia/lib/author_form.ts` and `ImageService`. */
export const PHOTO_MAX_MB = 5
export const PHOTO_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']

/**
 * Author card (Story 9.1, P2.6). Empty strings reach the validator as `null`
 * (`convertEmptyStringsToNull` in config/bodyparser.ts): optional fields are then absent,
 * required ones fail on `required`.
 *
 * The "at least one affiliation" rule depends on the card (migrated or not): it is
 * checked after validation by `assertAffiliationRule`. `affiliations` is optional because
 * a multipart request (photo attached) carries no field for an empty array: the controller
 * normalizes it to `[]`.
 *
 * `photo` is checked here for size and extension only; `ImageService` then decodes it.
 * `removePhoto` and `consent` (Story 9.4, D16) accept JSON booleans and the `'1'` / `'0'`
 * of Inertia's FormData.
 */
export const authorValidator = vine.compile(
  vine.object({
    lastNames: vine.string().trim().minLength(1).maxLength(AUTHOR_NAME_MAX),
    firstNames: vine.string().trim().minLength(1).maxLength(AUTHOR_NAME_MAX),
    affiliations: vine
      .array(
        vine.object({
          institution: vine.string().trim().minLength(1).maxLength(AFFILIATION_FIELD_MAX),
          department: vine.string().trim().maxLength(AFFILIATION_FIELD_MAX).optional(),
        })
      )
      .maxLength(AFFILIATIONS_MAX)
      .optional(),
    googleScholarUrl: vine
      .string()
      .trim()
      .maxLength(SCHOLAR_URL_MAX)
      .url({ require_protocol: true, protocols: ['http', 'https'] })
      .optional(),
    photo: vine.file({ size: `${PHOTO_MAX_MB}mb`, extnames: PHOTO_EXTNAMES }).optional(),
    removePhoto: vine.boolean().optional(),
    consent: vine.boolean().optional(),
  })
)

authorValidator.messagesProvider = new SimpleMessagesProvider({
  'lastNames.required': 'authors.form.errors.last_names_required',
  'lastNames.minLength': 'authors.form.errors.last_names_required',
  'lastNames.maxLength': 'authors.form.errors.last_names_too_long',
  'firstNames.required': 'authors.form.errors.first_names_required',
  'firstNames.minLength': 'authors.form.errors.first_names_required',
  'firstNames.maxLength': 'authors.form.errors.first_names_too_long',
  'affiliations.required': 'authors.form.errors.affiliation_required',
  'affiliations.array': 'authors.form.errors.affiliation_required',
  'affiliations.array.maxLength': 'authors.form.errors.affiliations_too_many',
  'affiliations.*.institution.required': 'authors.form.errors.institution_required',
  'affiliations.*.institution.minLength': 'authors.form.errors.institution_required',
  'affiliations.*.institution.maxLength': 'authors.form.errors.institution_too_long',
  'affiliations.*.department.maxLength': 'authors.form.errors.department_too_long',
  'googleScholarUrl.maxLength': 'authors.form.errors.scholar_url_invalid',
  'googleScholarUrl.url': 'authors.form.errors.scholar_url_invalid',
  'photo.file': 'authors.form.errors.photo_type',
  'photo.file.extname': 'authors.form.errors.photo_type',
  'photo.file.size': 'authors.form.errors.photo_size',
})

/** "At least one affiliation" error on the `affiliations` field (validator and service). */
export function affiliationRequiredError() {
  return new errors.E_VALIDATION_ERROR([
    {
      field: 'affiliations',
      message: 'authors.form.errors.affiliation_required',
      rule: 'minLength',
    },
  ])
}

/** D27 error on the `consent` field (validator and service). */
export function consentRequiresAffiliationError() {
  return new errors.E_VALIDATION_ERROR([
    {
      field: 'consent',
      message: 'authors.form.errors.consent_requires_affiliation',
      rule: 'consent',
    },
  ])
}

/**
 * FR52: a card created in the panel keeps at least one affiliation; a migrated card
 * (`migration_key` not NULL) may stay without one until it is completed, unless its profile
 * is public (P2.1: a public card never falls back to 0 affiliation).
 * D27: consent cannot be confirmed without an affiliation (`consent` field).
 */
export function assertAffiliationRule(
  data: { affiliations: unknown[]; consent?: boolean },
  options: { isMigrated: boolean; isPublic?: boolean }
): void {
  const empty = data.affiliations.length === 0
  const messages: { field: string; message: string; rule: string }[] = []
  if (empty && (!options.isMigrated || options.isPublic === true)) {
    messages.push({
      field: 'affiliations',
      message: 'authors.form.errors.affiliation_required',
      rule: 'minLength',
    })
  }
  if (empty && data.consent === true) {
    messages.push({
      field: 'consent',
      message: 'authors.form.errors.consent_requires_affiliation',
      rule: 'consent',
    })
  }
  if (messages.length > 0) throw new errors.E_VALIDATION_ERROR(messages)
}
