import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants et pages testés par lecture de source (Story 9.7).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const combobox = read('inertia/components/admin/AuthorCombobox.tsx')
const list = read('inertia/components/admin/SelectedAuthorList.tsx')
const form = read('inertia/components/admin/ProductionForm.tsx')
const pickerLib = read('inertia/lib/author_picker.ts')
const submitLib = read('inertia/lib/production_submit.ts')
const createPage = read('inertia/pages/admin/Productions/Create.tsx')
const editPage = read('inertia/pages/admin/Productions/Edit.tsx')
const adminFr = JSON.parse(read('inertia/locales/admin/fr.json'))
const adminEn = JSON.parse(read('inertia/locales/admin/en.json'))
const packageJson = JSON.parse(read('package.json'))

test.group('AuthorCombobox | motif ARIA 1.2 combobox + listbox', () => {
  test('combobox, listbox, options, aria-activedescendant', ({ assert }) => {
    assert.include(combobox, 'role="combobox"')
    assert.include(combobox, 'aria-autocomplete="list"')
    assert.include(combobox, 'aria-expanded={showList}')
    assert.include(combobox, 'aria-controls={listId}')
    assert.include(combobox, 'aria-activedescendant={')
    assert.include(combobox, 'role="listbox"')
    assert.include(combobox, 'role="option"')
    assert.include(combobox, 'aria-selected={index === activeIndex}')
  })

  test('recherche dès 2 caractères, anti-rebond 250 ms, requête annulée, Loader2', ({ assert }) => {
    assert.match(pickerLib, /AUTHOR_SEARCH_MIN_LENGTH = 2\b/)
    assert.match(pickerLib, /AUTHOR_SEARCH_DEBOUNCE_MS = 250\b/)
    assert.include(combobox, 'term.length < AUTHOR_SEARCH_MIN_LENGTH')
    assert.include(combobox, 'AUTHOR_SEARCH_DEBOUNCE_MS)')
    assert.include(combobox, 'new AbortController()')
    assert.include(combobox, 'controller.abort()')
    assert.include(combobox, '<Loader2')
  })

  test('URL par Tuyau (urlFor), auteurs sélectionnés exclus', ({ assert }) => {
    assert.include(combobox, "urlFor(\n          'admin.authors.search'")
    assert.include(combobox, 'exclude:')
    assert.notMatch(combobox, /['"`]\/admin\/authors\/search/)
  })

  test('↑ ↓ parcourent, Entrée sélectionne sans soumettre, Échap ferme puis vide', ({ assert }) => {
    assert.include(combobox, "case 'ArrowDown':")
    assert.include(combobox, "case 'ArrowUp':")
    assert.match(combobox, /case 'Enter':\s*\/\/[^\n]*\n\s*event\.preventDefault\(\)/)
    assert.include(combobox, "case 'Escape':")
    assert.include(combobox, 'setOpen(false)')
    assert.include(combobox, "setQuery('')")
  })

  test('états : chargement, aucun résultat, erreur ; options avec avatar, affiliation, badges', ({
    assert,
  }) => {
    assert.include(combobox, "t('authors.picker.no_results')")
    assert.include(combobox, "t('authors.picker.error')")
    assert.include(combobox, 'role="status"')
    assert.include(combobox, '<Avatar')
    assert.include(combobox, 'pickerAffiliationLabel(author)')
    assert.include(combobox, '<AuthorStatusBadges')
  })
})

test.group('SelectedAuthorList | réordonnancement accessible (D18)', () => {
  test('boutons ↑ ↓ × nommés d’après l’auteur', ({ assert }) => {
    assert.include(list, "t('authors.picker.move_up', { name })")
    assert.include(list, "t('authors.picker.move_down', { name })")
    assert.include(list, "t('authors.picker.remove', { name })")
    assert.include(list, 'aria-label={label}')
  })

  test('indisponibles aux extrémités sans perdre le focus ; focus rendu au bouton actionné', ({
    assert,
  }) => {
    assert.include(list, "(action === 'up' && index === 0)")
    assert.include(list, "(action === 'down' && index === authors.length - 1)")
    assert.include(list, 'aria-disabled={unavailable || undefined}')
    assert.include(list, "pendingFocus.current = `${author.id}:${delta === -1 ? 'up' : 'down'}`")
    assert.include(list, '.focus()')
  })

  test('annonce polie « déplacé en position n », pas de glisser-déposer', ({ assert }) => {
    assert.include(list, 'aria-live="polite"')
    assert.include(
      list,
      "t('authors.picker.moved', { name: pickerAuthorLabel(author), n: target + 1 })"
    )
    assert.notInclude(list, 'draggable')
    assert.notInclude(combobox, 'draggable')
    assert.equal(adminFr.authors.picker.moved, '{{name}} déplacé en position {{n}}.')
  })
})

test.group('ProductionForm | fieldset Auteurs (Story 9.7)', () => {
  test('SelectedAuthorList + AuthorCombobox remplacent ChipInput pour les auteurs', ({
    assert,
  }) => {
    assert.include(form, '<SelectedAuthorList')
    assert.include(form, '<AuthorCombobox')
    assert.notInclude(form, "ChipField({ name: 'authors'")
    assert.include(form, "ChipField({ name: 'tags'")
    assert.include(form, "name: 'tags' | 'subdomain'")
  })

  test('« Au moins un auteur » dans l’indicateur, règle partagée hasRequiredAuthors', ({
    assert,
  }) => {
    assert.include(form, "labelKey: 'productions.form.completion.authors'")
    assert.include(form, 'filled: hasRequiredAuthors(data.authors)')
    assert.equal(adminFr.productions.form.completion.authors, 'Au moins un auteur')
  })

  test('avertissement « Auteurs à rattacher » pour une production non convertie', ({ assert }) => {
    assert.include(form, 'legacyAuthorNames.length > 0 && data.authors.length === 0')
    assert.include(form, "t('authors.picker.legacy_title')")
    assert.equal(adminFr.authors.picker.legacy_title, 'Auteurs à rattacher')
    assert.include(editPage, 'legacyAuthorNames={legacyAuthorNames}')
  })

  test('envoi : authorIds ordonnés, jamais l’objet authors', ({ assert }) => {
    assert.include(submitLib, 'authorIds: authors.map((author) => author.id)')
    assert.include(createPage, 'form.transform(toProductionPayload)')
    assert.include(editPage, 'transform(toProductionPayload)')
    assert.include(form, 'errors.authorIds')
  })
})

test.group('Sélecteur d’auteurs | libellés et dépendances', () => {
  test('libellés FR/EN d’EXPERIENCE.md', ({ assert }) => {
    assert.equal(adminFr.authors.picker.label, 'Ajouter un auteur')
    assert.equal(adminFr.authors.picker.placeholder, 'Nom ou prénom…')
    assert.equal(adminFr.authors.picker.no_results, 'Aucun auteur trouvé.')
    assert.equal(adminFr.authors.picker.error, 'Recherche indisponible, réessayez.')
    assert.equal(adminEn.authors.picker.label, 'Add an author')
    assert.equal(adminEn.authors.picker.no_results, 'No author found.')
  })

  test('aucune dépendance ajoutée pour le combobox (pas de cmdk, popover, cn)', ({ assert }) => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    for (const name of ['cmdk', '@radix-ui/react-popover', 'cn', 'downshift']) {
      assert.notProperty(deps, name)
    }
  })
})
