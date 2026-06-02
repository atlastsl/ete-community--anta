import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/ListingToggle.tsx'),
  'utf-8'
)

test.group('ListingToggle | source analysis', () => {
  test('groupe accessible avec aria-pressed sur chaque bouton', ({ assert }) => {
    assert.include(source, 'role="group"')
    assert.include(source, 'aria-pressed')
  })

  test('utilise les icônes List et LayoutGrid', ({ assert }) => {
    assert.include(source, 'List')
    assert.include(source, 'LayoutGrid')
  })

  test('composant contrôlé (value + onChange)', ({ assert }) => {
    assert.include(source, 'value')
    assert.include(source, 'onChange')
  })

  test('libellés via i18n', ({ assert }) => {
    assert.include(source, 'listing.view_list')
    assert.include(source, 'listing.view_grid')
  })
})
