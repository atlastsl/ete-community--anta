import vine, { SimpleMessagesProvider, errors } from '@vinejs/vine'

/** Limits shared with the client rules (`inertia/lib/author_form.ts`). */
export const AUTHOR_NAME_MAX = 120
export const AFFILIATION_FIELD_MAX = 255
export const SCHOLAR_URL_MAX = 500
export const AFFILIATIONS_MAX = 20

/**
 * Author card (Story 9.1, P2.6). Empty strings reach the validator as `null`
 * (`convertEmptyStringsToNull` in config/bodyparser.ts): optional fields are then absent,
 * required ones fail on `required`.
 *
 * The "at least one affiliation" rule depends on the card (migrated or not): it is
 * checked after validation by `assertAffiliationRule`.
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
      .maxLength(AFFILIATIONS_MAX),
    googleScholarUrl: vine
      .string()
      .trim()
      .maxLength(SCHOLAR_URL_MAX)
      .url({ require_protocol: true, protocols: ['http', 'https'] })
      .optional(),
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
})

/**
 * FR52: a card created in the panel keeps at least one affiliation; a migrated card
 * (`migration_key` not NULL) may stay without one until it is completed.
 */
export function assertAffiliationRule(
  data: { affiliations: unknown[] },
  options: { isMigrated: boolean }
): void {
  if (!options.isMigrated && data.affiliations.length === 0) {
    throw new errors.E_VALIDATION_ERROR([
      {
        field: 'affiliations',
        message: 'authors.form.errors.affiliation_required',
        rule: 'minLength',
      },
    ])
  }
}
