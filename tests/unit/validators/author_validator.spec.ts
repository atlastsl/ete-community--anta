import { test } from '@japa/runner'
import type { Assert } from '@japa/assert'
import { errors } from '@vinejs/vine'
import { authorValidator, assertAffiliationRule } from '#validators/admin/author_validator'

const VALID = {
  lastNames: 'Fictif',
  firstNames: 'Jean',
  affiliations: [{ institution: 'Université Exemple', department: 'Physique' }],
}

/** Messages (clés i18n) indexés par champ, ou {} si valide. */
async function messages(payload: unknown): Promise<Record<string, string>> {
  try {
    await authorValidator.validate(payload)
    return {}
  } catch (error) {
    if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
    return Object.fromEntries(
      (error.messages as { field: string; message: string }[]).map((m) => [m.field, m.message])
    )
  }
}

function expectAffiliationError(fn: () => void, assert: Assert) {
  try {
    fn()
    assert.fail('Expected assertAffiliationRule to throw')
  } catch (error) {
    assert.instanceOf(error, errors.E_VALIDATION_ERROR)
    assert.deepEqual(
      (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages.map(
        (m: { field: string; message: string }) => [m.field, m.message]
      ),
      [['affiliations', 'authors.form.errors.affiliation_required']]
    )
  }
}

test.group('AuthorValidator', () => {
  test('affiliations absent (multipart sans affiliation) → valide, normalisé par le contrôleur', async ({
    assert,
  }) => {
    const out = await authorValidator.validate({ lastNames: 'Fictif', firstNames: 'Jean' })
    assert.isUndefined(out.affiliations)
  })

  test("removePhoto : '1' (FormData), true (JSON) et '0' acceptés", async ({ assert }) => {
    const removePhoto = async (value: unknown) => {
      const out = await authorValidator.validate({ ...VALID, removePhoto: value })
      return out.removePhoto
    }
    assert.isTrue(await removePhoto('1'))
    assert.isTrue(await removePhoto(true))
    assert.isFalse(await removePhoto('0'))
    assert.isUndefined(await removePhoto(null))
  })

  test("photo qui n'est pas un fichier → authors.form.errors.photo_type", async ({ assert }) => {
    assert.deepInclude(await messages({ ...VALID, photo: 'pas-un-fichier' }), {
      photo: 'authors.form.errors.photo_type',
    })
  })

  test('fiche valide → trim, champs facultatifs absents', async ({ assert }) => {
    const out = await authorValidator.validate({
      lastNames: '  Fictif ',
      firstNames: ' Jean ',
      affiliations: [{ institution: ' Université Exemple ' }],
    })
    assert.equal(out.lastNames, 'Fictif')
    assert.equal(out.firstNames, 'Jean')
    assert.deepEqual(out.affiliations, [{ institution: 'Université Exemple' }])
    assert.isUndefined(out.googleScholarUrl)
  })

  test('null (chaîne vide convertie par le bodyparser) pour URL et département → absents', async ({
    assert,
  }) => {
    const out = await authorValidator.validate({
      ...VALID,
      affiliations: [{ institution: 'U', department: null }],
      googleScholarUrl: null,
    })
    assert.isUndefined(out.googleScholarUrl)
    assert.isUndefined(out.affiliations?.[0].department)
  })

  test('noms obligatoires et ≤ 120 caractères', async ({ assert }) => {
    assert.deepInclude(await messages({ ...VALID, lastNames: null, firstNames: '   ' }), {
      lastNames: 'authors.form.errors.last_names_required',
      firstNames: 'authors.form.errors.first_names_required',
    })
    assert.deepInclude(
      await messages({ ...VALID, lastNames: 'x'.repeat(121), firstNames: 'y'.repeat(121) }),
      {
        lastNames: 'authors.form.errors.last_names_too_long',
        firstNames: 'authors.form.errors.first_names_too_long',
      }
    )
    assert.deepEqual(await messages({ ...VALID, lastNames: 'x'.repeat(120) }), {})
  })

  test('institution obligatoire ≤ 255, département ≤ 255', async ({ assert }) => {
    assert.deepEqual(
      await messages({
        ...VALID,
        affiliations: [{ institution: null }, { institution: 'U', department: 'd'.repeat(256) }],
      }),
      {
        'affiliations.0.institution': 'authors.form.errors.institution_required',
        'affiliations.1.department': 'authors.form.errors.department_too_long',
      }
    )
    assert.deepEqual(
      await messages({ ...VALID, affiliations: [{ institution: 'i'.repeat(256) }] }),
      { 'affiliations.0.institution': 'authors.form.errors.institution_too_long' }
    )
  })

  test('au plus 20 affiliations', async ({ assert }) => {
    const many = Array.from({ length: 21 }, (_, i) => ({ institution: `U${i}` }))
    assert.deepEqual(await messages({ ...VALID, affiliations: many }), {
      affiliations: 'authors.form.errors.affiliations_too_many',
    })
  })

  test('URL Google Scholar http(s) ≤ 500', async ({ assert }) => {
    const key = { googleScholarUrl: 'authors.form.errors.scholar_url_invalid' }
    assert.deepEqual(await messages({ ...VALID, googleScholarUrl: 'ftp://scholar.test/x' }), key)
    assert.deepEqual(await messages({ ...VALID, googleScholarUrl: 'scholar.google.com' }), key)
    assert.deepEqual(
      await messages({
        ...VALID,
        googleScholarUrl: `https://scholar.google.com/${'a'.repeat(480)}`,
      }),
      key
    )
    assert.deepEqual(
      await messages({ ...VALID, googleScholarUrl: 'https://scholar.google.com/citations?user=x' }),
      {}
    )
  })

  test('affiliations manquantes → refus par assertAffiliationRule après normalisation', async ({
    assert,
  }) => {
    // Le schéma accepte l'absence (multipart, Story 9.3) ; le contrôleur normalise à [].
    assert.deepEqual(await messages({ lastNames: 'A', firstNames: 'B' }), {})
    expectAffiliationError(
      () => assertAffiliationRule({ affiliations: [] }, { isMigrated: false }),
      assert
    )
  })
})

test.group('AuthorValidator | assertAffiliationRule', () => {
  test('fiche du panel sans affiliation → refus', ({ assert }) => {
    expectAffiliationError(
      () => assertAffiliationRule({ affiliations: [] }, { isMigrated: false }),
      assert
    )
  })

  test('fiche migrée sans affiliation → acceptée (FR52)', ({ assert }) => {
    assert.doesNotThrow(() => assertAffiliationRule({ affiliations: [] }, { isMigrated: true }))
  })

  test('fiche du panel avec affiliation → acceptée', ({ assert }) => {
    assert.doesNotThrow(() =>
      assertAffiliationRule({ affiliations: [{ institution: 'U' }] }, { isMigrated: false })
    )
  })
})

/** Erreurs levées par `assertAffiliationRule` : [champ, clé], ou [] si rien n'est levé. */
function ruleErrors(
  data: { affiliations: unknown[]; consent?: boolean },
  options: { isMigrated: boolean; isPublic?: boolean }
): [string, string][] {
  try {
    assertAffiliationRule(data, options)
    return []
  } catch (error) {
    if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
    return (error.messages as { field: string; message: string }[]).map((m) => [m.field, m.message])
  }
}

const AFFILIATION_REQUIRED: [string, string] = [
  'affiliations',
  'authors.form.errors.affiliation_required',
]
const CONSENT_REQUIRES: [string, string] = [
  'consent',
  'authors.form.errors.consent_requires_affiliation',
]

test.group('AuthorValidator | consentement (Story 9.4)', () => {
  test("consent : '1' (FormData), true (JSON), '0' et absent acceptés", async ({ assert }) => {
    const consent = async (value: unknown) => {
      const out = await authorValidator.validate({ ...VALID, consent: value })
      return out.consent
    }
    assert.isTrue(await consent('1'))
    assert.isTrue(await consent(true))
    assert.isFalse(await consent('0'))
    assert.isUndefined(await consent(null))
  })

  test('fiche publique (même migrée) : 0 affiliation refusée (P2.1)', ({ assert }) => {
    assert.deepEqual(ruleErrors({ affiliations: [] }, { isMigrated: true, isPublic: true }), [
      AFFILIATION_REQUIRED,
    ])
    assert.deepEqual(ruleErrors({ affiliations: [] }, { isMigrated: true, isPublic: false }), [])
  })

  test('consent sans affiliation refusé (D27), cumulé avec la règle FR52', ({ assert }) => {
    assert.deepEqual(ruleErrors({ affiliations: [], consent: true }, { isMigrated: true }), [
      CONSENT_REQUIRES,
    ])
    assert.deepEqual(ruleErrors({ affiliations: [], consent: true }, { isMigrated: false }), [
      AFFILIATION_REQUIRED,
      CONSENT_REQUIRES,
    ])
    assert.deepEqual(
      ruleErrors({ affiliations: [{ institution: 'U' }], consent: true }, { isMigrated: false }),
      []
    )
    assert.deepEqual(ruleErrors({ affiliations: [], consent: false }, { isMigrated: true }), [])
  })
})
