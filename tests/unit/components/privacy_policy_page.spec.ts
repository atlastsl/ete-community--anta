import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : page testée par lecture de source (Story 10.1, FR55, PRD RGPD).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const page = read('inertia/pages/privacy-policy.tsx')
const fr = JSON.parse(read('inertia/locales/public/fr.json'))
const en = JSON.parse(read('inertia/locales/public/en.json'))

const AUTHOR_ITEMS = ['data', 'basis', 'withdrawal', 'optional_fields', 'deletion'] as const

test.group('Privacy policy | section auteurs', () => {
  test('section « authors » rendue entre la conservation et les droits', ({ assert }) => {
    assert.include(page, "t('privacy.authors.heading')")
    assert.include(page, "t('privacy.authors.intro')")
    assert.include(page, '`privacy.authors.${item}`')
    assert.include(page, '<ul')
    const order = ['data_retention', 'authors', 'rights'].map((s) => page.indexOf(`'${s}'`))
    assert.isTrue(
      order.every((i) => i >= 0),
      'sections présentes dans la source'
    )
    assert.isBelow(order[0], order[1])
    assert.isBelow(order[1], order[2])
  })

  test('les cinq points sont déclarés dans la page', ({ assert }) => {
    for (const item of AUTHOR_ITEMS) assert.include(page, `'${item}'`)
  })

  test('clés privacy.authors.* présentes et non vides en FR et EN', ({ assert }) => {
    for (const dict of [fr, en]) {
      const section = dict.privacy.authors
      for (const key of ['heading', 'intro', ...AUTHOR_ITEMS]) {
        assert.isString(section[key])
        assert.isAbove(section[key].length, 5)
      }
    }
  })

  test('le texte couvre les données, la base, le retrait, les champs facultatifs et FR55', ({
    assert,
  }) => {
    const a = fr.privacy.authors
    assert.include(a.data, 'Google Scholar')
    assert.include(a.data, 'photo')
    assert.include(a.data, 'affiliations')
    assert.include(a.basis, 'consentement')
    assert.include(a.basis, 'administrateur')
    assert.include(a.withdrawal, 'non public')
    assert.include(a.optional_fields, 'département')
    assert.include(a.deletion, 'aucune production')
    const b = en.privacy.authors
    assert.include(b.data, 'Google Scholar')
    assert.include(b.basis, 'consent')
    assert.include(b.withdrawal, 'no longer public')
    assert.include(b.optional_fields, 'department')
    assert.include(b.deletion, 'not linked to any production')
  })
})
