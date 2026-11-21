import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 11.5 — dialogs de dépublication / suppression avec l'avertissement « à la une » (D21),
// testés par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const dialog = read('inertia/components/admin/ProductionConfirmDialog.tsx')
const list = read('inertia/pages/admin/Productions/Index.tsx')
const actions = read('inertia/components/admin/ProductionFormActions.tsx')
const edit = read('inertia/pages/admin/Productions/Edit.tsx')
const fr = JSON.parse(read('inertia/locales/admin/fr.json'))
const en = JSON.parse(read('inertia/locales/admin/en.json'))

test.group('ProductionConfirmDialog (11.5)', () => {
  test('alertdialog dépublier / supprimer, libellés existants', ({ assert }) => {
    assert.include(dialog, 'role="alertdialog"')
    assert.include(dialog, "'unpublish' | 'delete'")
    assert.include(dialog, '`productions.${kind}_modal.title`')
    assert.include(dialog, '`productions.${kind}_modal.description`')
    assert.include(dialog, '`productions.${kind}_modal.confirm`')
    assert.include(dialog, "t('actions.cancel')")
    assert.include(dialog, 'variant="destructive"')
  })

  test('à la une : encadré d’avertissement AlertTriangle dans la description Radix', ({
    assert,
  }) => {
    assert.include(dialog, 'isFeatured &&')
    assert.include(dialog, "t('productions.confirm.featured_warning')")
    assert.include(dialog, 'AlertTriangle')
    assert.include(dialog, 'aria-hidden="true"')
    assert.match(dialog, /border-amber-\d+ bg-amber-50/)
    // Avertissement DANS la description (lu par l'aria-describedby de Radix), identifiant
    // Radix par défaut : jamais d'id ni d'aria-describedby personnalisés (avertissement
    // « Missing Description » de Radix en développement).
    const description = dialog.slice(
      dialog.indexOf('<DialogDescription asChild>'),
      dialog.indexOf('</DialogDescription>')
    )
    assert.include(description, "t('productions.confirm.featured_warning')")
    assert.notInclude(dialog, 'aria-describedby')
    assert.notMatch(dialog, /<DialogDescription[^>]*\sid=/)
  })

  test('liste : les deux dialogs passent par le composant avec isFeatured de la ligne', ({
    assert,
  }) => {
    assert.include(
      list,
      "import ProductionConfirmDialog from '~/components/admin/ProductionConfirmDialog'"
    )
    assert.include(list, 'isFeatured: boolean')
    assert.include(list, 'kind="unpublish"')
    assert.include(list, 'kind="delete"')
    assert.include(list, 'isFeatured={unpublishTarget?.isFeatured ?? false}')
    assert.include(list, 'isFeatured={deleteTarget?.isFeatured ?? false}')
    assert.notInclude(list, "from '~/components/ui/dialog'")
  })

  test('formulaire : « Dépublier » ouvre le dialog (D-11.5-4), isFeatured transmis', ({
    assert,
  }) => {
    assert.include(actions, 'isFeatured?: boolean')
    assert.include(actions, 'kind="unpublish"')
    assert.include(actions, 'isFeatured={isFeatured}')
    assert.include(actions, 'onClick={() => setConfirmUnpublish(true)}')
    assert.include(edit, 'isFeatured: boolean')
    assert.include(edit, 'isFeatured={isFeatured}')
  })

  test('i18n fr/en', ({ assert }) => {
    assert.equal(
      fr.productions.confirm.featured_warning,
      'Cette production est à la une : elle sera retirée de la bannière.'
    )
    assert.equal(
      en.productions.confirm.featured_warning,
      'This production is featured: it will be removed from the banner.'
    )
    assert.isString(fr.productions.auto_unpublished_featured)
    assert.isString(en.productions.auto_unpublished_featured)
    assert.equal(fr.activity.action.featured_auto_remove, 'Retrait automatique de la une')
    assert.equal(en.activity.action.featured_auto_remove, 'Automatically removed from featured')
  })
})
