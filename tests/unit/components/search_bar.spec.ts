import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/SearchBar.tsx'),
  'utf-8'
)

test.group('SearchBar | source analysis', () => {
  test('is an accessible search form (role="search")', ({ assert }) => {
    assert.include(source, 'role="search"')
  })

  test('input has an aria-label and uses i18n placeholder', ({ assert }) => {
    assert.include(source, 'aria-label')
    assert.include(source, 'home.search_placeholder')
  })

  test('submits via onSubmit callback (presentational, no direct nav)', ({ assert }) => {
    assert.include(source, 'onSubmit')
    assert.include(source, 'preventDefault')
  })

  test('provides a clear/reset control', ({ assert }) => {
    assert.include(source, 'search.clear')
  })
})
