import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 10.6 — facette auteur du panneau de filtres, par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const sidebar = read('inertia/components/public/FilterSidebar.tsx')
const filterBar = read('inertia/components/public/FilterBar.tsx')
const productionsPage = read('inertia/pages/productions.tsx')

test.group('FilterSidebar | facette auteur (10.6)', () => {
  test('options { value, label } : libellé affiché, slug dans l’URL', ({ assert }) => {
    assert.include(sidebar, 'facetOptions(facets, dim')
    assert.include(sidebar, 'label={option.label}')
    assert.include(sidebar, 'toggleFilter(search, dim, option.value)')
    assert.include(sidebar, 'isFilterActive(activeFilters, dim, option.value)')
  })

  test('recherche de facette sur le libellé, casse et accents ignorés', ({ assert }) => {
    assert.include(sidebar, 'matchesFacetQuery(option.label, authorQuery)')
    assert.notInclude(sidebar, 'v.toLowerCase().includes')
  })

  test('ligne opérable au clavier : aria-pressed, Espace bascule', ({ assert }) => {
    assert.include(sidebar, 'aria-pressed={active}')
    assert.include(sidebar, 'onKeyDown={handleKeyDown}')
    assert.include(sidebar, "event.key === ' '")
    assert.include(sidebar, 'router.visit(href)')
  })

  test('FilterBar (mode listing) lit la même forme de facette', ({ assert }) => {
    assert.include(filterBar, 'facetOptions(facets, dim')
    assert.include(filterBar, 'label={option.label}')
  })

  test('compteur de résultats annoncé (flux 5)', ({ assert }) => {
    assert.match(productionsPage, /aria-live="polite">\s*\{t\('productions\.results_count'/)
  })
})
