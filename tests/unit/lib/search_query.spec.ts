import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `inertia/lib/search_query.ts` n'est pas importable depuis un test serveur
 * (frontière TS séparée, TS6305 — cf. notify.spec.ts / production_completion.spec.ts).
 * On vérifie la SOURCE des helpers purs d'état d'URL des filtres (Story 5.3).
 * Le comportement de filtrage de bout en bout est couvert par
 * tests/functional/public/search.spec.ts.
 */
const source = readFileSync(resolve(process.cwd(), 'inertia/lib/search_query.ts'), 'utf-8')

test.group('search_query | dimensions', () => {
  test('déclare les 7 dimensions de filtre (FR2–FR8)', ({ assert }) => {
    for (const dim of [
      'category',
      'domain',
      'subdomain',
      'author',
      'language',
      'country',
      'license',
    ]) {
      assert.include(source, `'${dim}'`)
    }
  })
})

test.group('search_query | helpers', () => {
  test('utilise URLSearchParams pour encoder/décoder', ({ assert }) => {
    assert.include(source, 'URLSearchParams')
  })

  test('toggleFilter retire page (retour page 1) et gère ajout/retrait', ({ assert }) => {
    assert.include(source, 'export function toggleFilter')
    assert.include(source, "params.delete('page')")
    assert.include(source, 'current.includes(value)')
  })

  test('clearFilters supprime les dimensions de filtre', ({ assert }) => {
    assert.include(source, 'export function clearFilters')
    assert.include(source, 'for (const dimension of FILTER_DIMENSIONS) params.delete(dimension)')
  })

  test('setQuery définit ou retire q', ({ assert }) => {
    assert.include(source, 'export function setQuery')
    assert.include(source, "params.set('q', value)")
    assert.include(source, "params.delete('q')")
  })

  test('hasActiveFilters et isFilterActive exportés', ({ assert }) => {
    assert.include(source, 'export function hasActiveFilters')
    assert.include(source, 'export function isFilterActive')
  })

  test('setSort fixe sort et retire page', ({ assert }) => {
    assert.include(source, 'export function setSort')
    assert.include(source, "params.set('sort', value)")
    // setSort réinitialise la pagination
    assert.match(source, /export function setSort[\s\S]*?params\.delete\('page'\)/)
  })

  test("setPage ne touche qu'à page (préserve le reste)", ({ assert }) => {
    assert.include(source, 'export function setPage')
    assert.include(source, "params.set('page', String(page))")
  })
})
