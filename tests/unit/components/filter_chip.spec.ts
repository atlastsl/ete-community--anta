import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const chipSource = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/FilterChip.tsx'),
  'utf-8'
)

test.group('FilterChip | source analysis', () => {
  test("expose l'état actif via aria-pressed (lien de navigation, pas une vraie checkbox)", ({
    assert,
  }) => {
    assert.include(chipSource, 'aria-pressed={active}')
    assert.notInclude(chipSource, 'role="checkbox"')
  })

  test('aria-label "Filtrer par {label}" via i18n', ({ assert }) => {
    assert.include(chipSource, 'filters.filter_by')
    assert.include(chipSource, 'aria-label')
  })

  test('activable au clavier (Espace) + reste un Link', ({ assert }) => {
    assert.include(chipSource, 'Link')
    assert.include(chipSource, 'onKeyDown')
    assert.include(chipSource, 'spaceToggle(event)') // Espace simple (10.6 : répétition, modificateurs)
  })

  test('cible tactile >= 44px (min-h-11)', ({ assert }) => {
    assert.include(chipSource, 'min-h-11')
  })
})
