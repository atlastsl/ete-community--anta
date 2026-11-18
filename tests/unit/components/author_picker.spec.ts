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
    assert.include(
      combobox,
      "urlFor('admin.authors.search', {}, { qs: { q: term, exclude: excluded } })"
    )
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
    // Maquette : seul « À compléter » dans les options.
    assert.include(combobox, 'showConsent={false}')
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
    assert.include(form, "t('authors.picker.legacy_title')")
    assert.equal(adminFr.authors.picker.legacy_title, 'Auteurs à rattacher')
    assert.include(editPage, 'legacyAuthorNames={legacyAuthorNames}')
  })

  test('envoi : authorIds ordonnés, jamais l’objet authors', ({ assert }) => {
    assert.include(submitLib, 'authorIds: authors.map((author) => author.id)')
    assert.include(createPage, 'form.transform(toProductionPayload)')
    assert.include(editPage, 'transform(toProductionPayload)')
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

test.group('Sélecteur d’auteurs | revue de code 9.7', () => {
  test('nouvelle saisie : options effacées, aucune sélection pendant le chargement', ({
    assert,
  }) => {
    const effect = combobox.slice(combobox.indexOf('useEffect(() => {'))
    assert.match(
      effect,
      /^useEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*setResults\(\[\]\)\s*setActiveIndex\(-1\)/
    )
    assert.include(combobox, "if (status === 'loading') return")
    assert.include(combobox, "status !== 'loading' && showList && activeIndex >= 0")
  })

  test('résultats déjà sélectionnés filtrés côté client ; sélection en double ignorée', ({
    assert,
  }) => {
    assert.include(combobox, 'body.authors.filter((author) => !excluded.includes(author.id))')
    assert.include(form, 'if (selectedIds.includes(author.id)) return')
  })

  test('région d’état toujours montée hors du popup : nombre de résultats annoncé', ({
    assert,
  }) => {
    const statusIndex = combobox.indexOf('<p role="status" className="sr-only">')
    assert.isAtLeast(statusIndex, 0)
    assert.isBelow(statusIndex, combobox.indexOf("!showList && 'hidden'"))
    assert.include(combobox, "t('authors.picker.results_count', { count: results.length })")
    assert.equal(adminFr.authors.picker.results_count_other, '{{count}} auteurs trouvés.')
    assert.equal(adminEn.authors.picker.results_count_one, '{{count}} author found.')
  })

  test('option active visible, clic dans la liste sans perte de focus, nouvel essai après erreur', ({
    assert,
  }) => {
    assert.include(combobox, "scrollIntoView?.({ block: 'nearest' })")
    assert.match(
      combobox,
      /<div\s*\/\/[^\n]*\n\s*onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/
    )
    assert.include(combobox, 'setRetry((count) => count + 1)')
    assert.include(combobox, '[term, excludeKey, retry]')
    assert.match(combobox, /onFocus=\{\(\) => \{\s*setOpen\(true\)\s*retryAfterError\(\)/)
  })

  test('longueur minimale mesurée en NFC', ({ assert }) => {
    assert.include(combobox, "query.normalize('NFC').trim()")
  })

  test('retrait : focus sur le × suivant, sinon le précédent, sinon la recherche ; annonce', ({
    assert,
  }) => {
    assert.include(list, 'const neighbour = next[index] ?? next[index - 1]')
    assert.include(list, 'pendingFocus.current = neighbour ? `${neighbour.id}:remove` : null')
    assert.include(list, 'if (!neighbour) onEmptied?.()')
    assert.include(form, 'onEmptied={() => authorSearchRef.current?.focus()}')
    assert.include(
      list,
      "announce(t('authors.picker.removed', { name: pickerAuthorLabel(author) }))"
    )
    assert.equal(adminFr.authors.picker.removed, '{{name}} retiré.')
    assert.equal(adminFr.authors.picker.move_up, 'Monter {{name}}')
    assert.equal(adminFr.authors.picker.remove, 'Retirer {{name}}')
  })

  test('annonce répétée reprononcée ; raison des ↑ ↓ indisponibles pour les lecteurs d’écran', ({
    assert,
  }) => {
    assert.include(list, '<span key={announcement.count}>{announcement.text}</span>')
    assert.include(list, 'aria-describedby={unavailable ? `${reasonId}-${action}` : undefined}')
    assert.include(list, "t('authors.picker.already_first')")
    assert.include(list, "t('authors.picker.already_last')")
    assert.equal(adminFr.authors.picker.already_first, 'Déjà en première position.')
  })

  test('liste sélectionnée sans badges de consentement (maquette) ; groupe fieldset + legend', ({
    assert,
  }) => {
    assert.notInclude(list, 'AuthorStatusBadges')
    assert.match(form, /<fieldset aria-describedby="authors-hint">\s*<legend/)
  })

  test('erreurs serveur authorIds et authorIds.N affichées ; valeur non textuelle signalée', ({
    assert,
  }) => {
    assert.include(form, "field === 'authorIds' || field.startsWith('authorIds.')")
    assert.include(form, "t('authors.picker.legacy_non_text')")
    assert.include(form, 'legacyAuthorNames.length > 0 || legacyAuthorsNonText')
    assert.include(editPage, 'legacyAuthorsNonText={legacyAuthorsNonText}')
  })
})
