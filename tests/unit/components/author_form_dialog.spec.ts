import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants et lib client testés par lecture de source (Story 9.8).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const dialog = read('inertia/components/admin/AuthorFormDialog.tsx')
const combobox = read('inertia/components/admin/AuthorCombobox.tsx')
const formLib = read('inertia/lib/author_form.ts')
const xsrfLib = read('inertia/lib/xsrf.ts')
const fr = JSON.parse(read('inertia/locales/admin/fr.json'))
const en = JSON.parse(read('inertia/locales/admin/en.json'))
const packageJson = JSON.parse(read('package.json'))

test.group('AuthorFormDialog | fenêtre « Créer un auteur »', () => {
  test('Dialog shadcn role="dialog", titre, description, max-w-lg, défilement', ({ assert }) => {
    assert.include(dialog, "from '~/components/ui/dialog'")
    // role="dialog" posé par Radix (DialogContent), pas répété dans la source.
    assert.include(dialog, '<DialogContent')
    assert.include(dialog, "<DialogTitle>{t('authors.create_button')}</DialogTitle>")
    assert.include(
      dialog,
      "<DialogDescription>{t('authors.dialog.description')}</DialogDescription>"
    )
    assert.include(dialog, 'sm:max-w-lg')
    assert.include(dialog, 'overflow-y-auto')
  })

  test('réutilise AuthorForm (affiliation requise) et les règles client', ({ assert }) => {
    assert.include(dialog, "import AuthorForm from '~/components/admin/AuthorForm'")
    assert.match(dialog, /<AuthorForm[^>]*requireAffiliation/)
    assert.include(dialog, 'validateAuthorForm(data, { requireAffiliation: true })')
    assert.include(dialog, 'toAuthorFormData(toAuthorPayload(data))')
    // Sans retrait de consentement dans la fenêtre (fiche jamais publique avant création).
    assert.notInclude(dialog, 'onWithdrawConsent')
  })

  test('préremplissage D36 depuis la saisie', ({ assert }) => {
    assert.include(dialog, 'splitAuthorQuery(initialQuery)')
    assert.include(formLib, 'export function splitAuthorQuery(query: string)')
    assert.include(formLib, '.trim().split(/\\s+/)')
    assert.include(formLib, 'const lastNames = words.pop()!')
    assert.include(formLib, "firstNames: words.join(' ')")
    assert.include(formLib, "if (words.length === 0) return { firstNames: '', lastNames: '' }")
  })

  test('fetch multipart, X-XSRF-TOKEN, Accept JSON, route nommée, jamais de navigation', ({
    assert,
  }) => {
    assert.include(dialog, "fetch(urlFor('admin.authors.quick-store')")
    assert.include(dialog, "method: 'POST'")
    assert.include(dialog, "'X-XSRF-TOKEN': token")
    assert.match(dialog, /'?Accept'?: 'application\/json'/)
    assert.include(dialog, "credentials: 'same-origin'")
    assert.include(dialog, "redirect: 'manual'")
    assert.notMatch(dialog, /['"`]\/admin\/authors\/quick/)
    assert.notInclude(dialog, '@inertiajs/react')
    assert.notInclude(dialog, 'router.')
    assert.notInclude(combobox, '@inertiajs/react')
    assert.include(xsrfLib, "name === 'XSRF-TOKEN'")
    assert.include(xsrfLib, 'decodeURIComponent(')
    assert.include(formLib, 'body.append(`affiliations[${index}][institution]`')
    assert.include(formLib, "body.append('consent', '1')")
  })

  test('submit stoppé (portail React → formulaire de production)', ({ assert }) => {
    const handler = dialog.slice(
      dialog.indexOf('async function handleSubmit('),
      dialog.indexOf('if (inFlight.current) return', dialog.indexOf('async function handleSubmit('))
    )
    assert.include(handler, 'event.preventDefault()')
    assert.include(handler, 'event.stopPropagation()')
    assert.include(dialog, '<form onSubmit={handleSubmit} noValidate>')
  })

  test('focus initial sur le premier champ, pas sur ×', ({ assert }) => {
    const open = dialog.slice(
      dialog.indexOf('onOpenAutoFocus='),
      dialog.indexOf('onCloseAutoFocus=')
    )
    assert.include(open, 'event.preventDefault()')
    assert.include(
      open,
      '.querySelector<HTMLElement>(\'form input:not([type="hidden"])\')?.focus()'
    )
  })

  test('session expirée distinguée ; 422 sur un champ non affiché → alerte générique', ({
    assert,
  }) => {
    assert.include(dialog, "response.type === 'opaqueredirect'")
    for (const status of [0, 401, 403, 419]) {
      assert.include(dialog, `response.status === ${status}`)
    }
    assert.include(dialog, "setFailure(t('authors.dialog.session_expired'))")
    assert.include(dialog, 'keys.some((key) => !DISPLAYED_ERROR.test(key))')
    const pattern = dialog.match(/const DISPLAYED_ERROR =\s*\n?\s*(\/.*\/)\n/)
    assert.isNotNull(pattern)
    const displayed = new RegExp(pattern![1].slice(1, -1))
    for (const key of [
      'lastNames',
      'firstNames',
      'affiliations',
      'affiliations.2.institution',
      'affiliations.0.department',
      'googleScholarUrl',
      'photo',
      'consent',
    ]) {
      assert.isTrue(displayed.test(key), key)
    }
    for (const key of ['affiliations.0', 'removePhoto', 'affiliations.0.other', 'x']) {
      assert.isFalse(displayed.test(key), key)
    }
  })

  test('422 en ligne, échec générique role="alert", Loader2 et bouton désactivé', ({ assert }) => {
    assert.include(dialog, 'response.status === 422')
    assert.include(dialog, 'serverErrors[error.field] ??= error.message')
    assert.include(dialog, 'setErrors(serverErrors)')
    assert.include(dialog, 'role="alert"')
    assert.include(dialog, "t('authors.dialog.error')")
    assert.include(dialog, '<Button type="submit" disabled={submitting}')
    assert.include(dialog, '<Loader2')
    assert.include(dialog, "{t('authors.dialog.submit')}")
    assert.include(dialog, 'inFlight.current')
  })

  test('fermeture : Échap / Annuler / ×, focus rendu, pas de clic extérieur, rien pendant l’envoi', ({
    assert,
  }) => {
    assert.include(dialog, 'onInteractOutside={(event) => event.preventDefault()}')
    assert.include(dialog, 'onEscapeKeyDown=')
    assert.include(dialog, 'if (!next && inFlight.current) return')
    assert.include(dialog, 'onCloseAutoFocus=')
    assert.include(dialog, 'returnFocusRef.current?.focus()\n          onClosed?.()')
    assert.include(dialog, "{t('actions.cancel')}")
    assert.include(dialog, "aria-label={t('authors.dialog.close')}")
    assert.notMatch(dialog, /<button(?![^>]*type=)/)
  })
})

test.group('AuthorCombobox | création (Story 9.8)', () => {
  test('dernière option « Créer un auteur « {saisie} » » toujours présente', ({ assert }) => {
    assert.include(combobox, 'const createIndex = results.length')
    assert.include(combobox, 'const optionCount = results.length + 1')
    assert.include(combobox, "t('authors.picker.create_option', { query: term })")
    assert.include(combobox, 'id={optionId(createIndex)}')
    assert.include(combobox, 'aria-selected={activeIndex === createIndex}')
    // Après la liste des résultats, dans la listbox, jamais sous condition d'état.
    const createLi = combobox.lastIndexOf('<li', combobox.indexOf('id={optionId(createIndex)}'))
    const between = combobox.slice(combobox.indexOf('results.map('), createLi)
    assert.isAbove(createLi, combobox.indexOf('results.map('))
    assert.isBelow(createLi, combobox.indexOf('</ul>'))
    assert.match(between, /\)\s*\}\)\}\s*\{\/\*[^*]*\*\/\}\s*$/)
    assert.notMatch(between.slice(between.lastIndexOf('})}')), /&&|\?/)
  })

  test('surlignage de « Créer » conservé à l’arrivée des résultats, après erreur et nouvel essai', ({
    assert,
  }) => {
    assert.include(
      combobox,
      'createActive.current = activeIndex >= 0 && activeIndex === results.length'
    )
    assert.include(combobox, 'setActiveIndex(createActive.current ? found.length : 0)')
    assert.equal(combobox.split('setActiveIndex(createActive.current ? 0 : -1)').length - 1, 2)
    // L'effet de synchronisation précède l'effet de recherche.
    assert.isBelow(
      combobox.indexOf('createActive.current = activeIndex'),
      combobox.indexOf('const timer = window.setTimeout')
    )
  })

  test('ouvrir la fenêtre ne marque pas le champ « touché »', ({ assert }) => {
    assert.include(combobox, "openingCreate.current = trigger === 'input'")
    assert.match(
      combobox,
      /if \(openingCreate\.current\) \{\s*openingCreate\.current = false\s*return\s*\}\s*onBlur\?\.\(\)/
    )
  })

  test('mise en page mobile : champ et bouton empilés, côte à côte dès sm', ({ assert }) => {
    assert.include(combobox, 'className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start"')
  })

  test('clavier : ↑ ↓ incluent l’option, Entrée l’ouvre', ({ assert }) => {
    assert.include(combobox, '(current + delta + optionCount) % optionCount')
    assert.include(
      combobox,
      "if (showList && activeIndex === createIndex) {\n          openCreate('input')"
    )
  })

  test('bouton outline « Créer un auteur » à côté du champ, sans soumettre', ({ assert }) => {
    assert.match(
      combobox,
      /<Button\s+ref=\{createButton\}\s+type="button"\s+variant="outline"\s+onClick=\{\(\) => openCreate\('button'\)\}/
    )
    assert.include(combobox, "{t('authors.create_button')}")
  })

  test('retour du focus au déclencheur, puis au champ après création', ({ assert }) => {
    assert.include(
      combobox,
      "returnFocus.current = trigger === 'input' ? inputElement.current : createButton.current"
    )
    assert.match(
      combobox,
      /function handleCreated[^}]*returnFocus\.current = inputElement\.current/
    )
    assert.include(combobox, 'returnFocusRef={returnFocus}')
  })

  test('ajout en fin de sélection (onSelect), saisie vidée ; toast et annonce après fermeture', ({
    assert,
  }) => {
    const created = combobox.slice(
      combobox.indexOf('function handleCreated'),
      combobox.indexOf('function handleDialogClosed')
    )
    assert.include(created, 'onSelect(author)')
    assert.include(created, "setQuery('')")
    assert.include(created, 'pendingCreated.current = author')
    assert.notInclude(created, 'notify.success')
    const closed = combobox.slice(combobox.indexOf('function handleDialogClosed'))
    assert.include(closed, 'window.setTimeout(')
    assert.include(closed, "notify.success(t('authors.flash.created'))")
    assert.include(closed, "t('authors.dialog.added', { name: pickerAuthorLabel(author) })")
    assert.include(combobox, 'onClosed={handleDialogClosed}')
    assert.include(combobox, 'const announcement = searchAnnouncement || notice')
  })
})

test.group('Story 9.8 | i18n et dépendances', () => {
  test('libellés FR / EN (EXPERIENCE.md)', ({ assert }) => {
    assert.equal(fr.authors.picker.create_option, 'Créer un auteur « {{query}} »')
    assert.equal(en.authors.picker.create_option, 'Create author “{{query}}”')
    assert.equal(fr.authors.create_button, 'Créer un auteur')
    assert.equal(fr.authors.dialog.submit, 'Créer et ajouter')
    assert.equal(fr.authors.dialog.description, "L'auteur créé sera ajouté à la production.")
    assert.equal(fr.authors.flash.created, 'Auteur créé.')
    assert.include(fr.authors.dialog.added, '{{name}}')
    assert.include(en.authors.dialog.added, '{{name}}')
    assert.equal(
      fr.authors.dialog.session_expired,
      "Session expirée : reconnectez-vous dans un autre onglet ; la production n'est pas encore enregistrée."
    )
    assert.sameMembers(Object.keys(fr.authors.dialog), Object.keys(en.authors.dialog))
  })

  test('aucune nouvelle dépendance', ({ assert }) => {
    assert.notProperty(packageJson.dependencies, 'cn')
    assert.property(packageJson.dependencies, 'radix-ui')
  })
})
