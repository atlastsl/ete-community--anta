import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Story 10.6 — comportement des helpers purs de `inertia/lib/search_query.ts`. Le module est
 * chargé à l'exécution par une URL calculée (aucun import statique : la frontière TS6305
 * ne s'applique qu'au typecheck) ; il n'importe rien, donc s'exécute tel quel.
 */
type FacetOption = { value: string; label: string }
type SearchQueryModule = {
  facetOptions: (
    facets: Record<string, unknown>,
    dimension: string,
    labelOf: (dimension: string, value: string) => string
  ) => FacetOption[]
  matchesFacetQuery: (label: string, query: string) => boolean
  toggleFilter: (search: string, dimension: string, value: string) => string
  clearFilters: (search: string) => string
  setPage: (search: string, page: number) => string
  setSort: (search: string, value: string) => string
}

const load = async (): Promise<SearchQueryModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/search_query.ts')).href)

test.group('search_query | facette auteur par slug (10.6)', () => {
  test('facetOptions : auteurs = options du serveur, autres dimensions libellées', async ({
    assert,
  }) => {
    const { facetOptions } = await load()
    const facets = {
      category: ['Livre'],
      author: [{ value: 'jeanne-exemple', label: 'Jeanne EXEMPLE' }],
    }
    const labelOf = (dim: string, value: string) => `${dim}:${value}`
    assert.deepEqual(facetOptions(facets, 'author', labelOf), [
      { value: 'jeanne-exemple', label: 'Jeanne EXEMPLE' },
    ])
    assert.deepEqual(facetOptions(facets, 'category', labelOf), [
      { value: 'Livre', label: 'category:Livre' },
    ])
    assert.deepEqual(facetOptions(facets, 'language', labelOf), [])
  })

  test('matchesFacetQuery : casse et accents ignorés, saisie vide = tout', async ({ assert }) => {
    const { matchesFacetQuery } = await load()
    assert.isTrue(matchesFacetQuery('Hélène ÉCRIVAINE', 'helene'))
    assert.isTrue(matchesFacetQuery('Hélène ÉCRIVAINE', 'ecriv'))
    assert.isTrue(matchesFacetQuery('Jean EXEMPLE', 'ÉXEMPLE'))
    assert.isTrue(matchesFacetQuery('Jean EXEMPLE', '  '))
    assert.isFalse(matchesFacetQuery('Jean EXEMPLE', 'marie'))
  })

  test('toggleFilter ajoute / retire un slug et revient page 1', async ({ assert }) => {
    const { toggleFilter } = await load()
    assert.equal(toggleFilter('?q=x&page=3', 'author', 'a-b'), '?q=x&author=a-b')
    assert.equal(toggleFilter('?author=a-b&author=c-d', 'author', 'a-b'), '?author=c-d')
  })

  test('pagination et tri conservent author ; Effacer filtres le retire et garde q', async ({
    assert,
  }) => {
    const { setPage, setSort, clearFilters } = await load()
    assert.equal(setPage('?author=a-b&author=c-d', 2), '?author=a-b&author=c-d&page=2')
    assert.equal(setSort('?author=a-b&page=2', 'views'), '?author=a-b&sort=views')
    assert.equal(clearFilters('?q=x&author=a-b&category=Livre&page=2'), '?q=x')
  })
})
