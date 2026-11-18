import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants et pages testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const form = read('inertia/components/admin/AuthorForm.tsx')
const createPage = read('inertia/pages/admin/Authors/Create.tsx')
const editPage = read('inertia/pages/admin/Authors/Edit.tsx')
const indexPage = read('inertia/pages/admin/Authors/Index.tsx')

test.group('AuthorForm | champs et affiliations', () => {
  test('Nom(s) avant Prénom(s) (D34), champs obligatoires signalés', ({ assert }) => {
    assert.isBelow(
      form.indexOf('authors.form.fields.last_names'),
      form.indexOf('authors.form.fields.first_names')
    )
    assert.include(form, 'aria-required={required || undefined}')
  })

  test('↑ ↓ × nommés, bornes désactivées, dernier × désactivé si affiliation requise', ({
    assert,
  }) => {
    assert.include(form, "t('authors.form.move_up', { n })")
    assert.include(form, "t('authors.form.move_down', { n })")
    assert.include(form, "t('authors.form.remove', { n })")
    assert.include(form, 'disabled={index === 0}')
    assert.include(form, 'disabled={index === count - 1}')
    assert.include(form, 'const removeDisabled = requireAffiliation && count === 1')
  })

  test('réordonnancement accessible : focus conservé et annonce polie, sans glisser-déposer', ({
    assert,
  }) => {
    assert.include(form, 'aria-live="polite"')
    assert.include(form, "t('authors.form.moved', { n: target + 1 })")
    assert.include(form, 'target?.focus()')
    assert.notInclude(form, 'draggable')
  })

  test('erreurs reliées au champ (aria-invalid, aria-describedby)', ({ assert }) => {
    assert.include(form, 'aria-invalid={!!error}')
    assert.include(form, 'aria-describedby={error ? errorId : undefined}')
    assert.include(form, "message('affiliations')")
  })

  test('pas de photo ni de consentement en 9.1', ({ assert }) => {
    assert.notInclude(form, 'type="file"')
    assert.notInclude(form, 'type="checkbox"')
  })
})

test.group('Pages Authors | création, édition, liste', () => {
  test('validation client avant envoi, URLs par urlFor (Tuyau)', ({ assert }) => {
    for (const page of [createPage, editPage]) {
      assert.include(page, 'validateAuthorForm(data, { requireAffiliation')
      assert.include(page, 'form.transform(toAuthorPayload)')
    }
    assert.include(createPage, "post(urlFor('admin.authors.store'))")
    assert.include(editPage, "urlFor('admin.authors.update', { id })")
    assert.include(editPage, 'const requireAffiliation = !isMigrated')
  })

  test('liste : nom formaté, affiliation principale ou « Aucune affiliation », état vide', ({
    assert,
  }) => {
    assert.include(indexPage, 'formatAuthorName(author.firstNames, author.lastNames)')
    assert.include(indexPage, "t('authors.no_affiliation')")
    assert.include(indexPage, "t('authors.empty_title')")
    assert.include(indexPage, 'scope="col"')
    assert.include(indexPage, 'Pagination')
  })
})
