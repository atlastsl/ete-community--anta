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
  clearFilters: (search: string, options?: { includeAuthor?: boolean }) => string
  hasActiveFilters: (active: Record<string, string[]>) => boolean
  hasClearableFilters: (active: Record<string, string[]>) => boolean
  setPage: (search: string, page: number) => string
  setSort: (search: string, value: string) => string
  setQuery: (search: string, value: string) => string
  homeSearchHref: (query: string) => string
  defaultListingSort: (q: string | null | undefined) => string
  effectiveListingSort: (sort: string, q: string | null | undefined) => string
  LISTING_SORTS: readonly string[]
  withActiveAuthors: (search: string, authors: string[]) => string
  MAX_AUTHOR_FILTERS: number
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

  test('matchesFacetQuery : chaque mot, dans n’importe quel ordre ; ligatures repliées', async ({
    assert,
  }) => {
    const { matchesFacetQuery } = await load()
    assert.isTrue(matchesFacetQuery('Jeanne Marie EXEMPLE', 'exemple jeanne'))
    assert.isTrue(matchesFacetQuery('Jeanne Marie EXEMPLE', '  marie   exem '))
    assert.isFalse(matchesFacetQuery('Jeanne Marie EXEMPLE', 'exemple paul'))
    assert.isTrue(matchesFacetQuery('Lætitia CŒURFICTIF', 'laetitia coeur'))
    assert.isTrue(matchesFacetQuery('Søren ØSTFICTIF', 'soren ost'))
  })

  test('withActiveAuthors : slugs ignorés retirés, autres paramètres conservés', async ({
    assert,
  }) => {
    const { withActiveAuthors, setPage, toggleFilter, MAX_AUTHOR_FILTERS } = await load()
    const search = withActiveAuthors('?q=x&author=Nom%20Libre&author=a-b&category=Livre', ['a-b'])
    assert.equal(search, '?q=x&category=Livre&author=a-b')
    assert.equal(withActiveAuthors('?author=inconnu&page=2', []), '?page=2')
    assert.equal(setPage(search, 2), '?q=x&category=Livre&author=a-b&page=2')
    assert.equal(toggleFilter(search, 'author', 'c-d'), '?q=x&category=Livre&author=a-b&author=c-d')
    assert.equal(MAX_AUTHOR_FILTERS, 20)
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
    // D-10.6-2 amendée (2026-11-21) : « Effacer les filtres » garde la vue de l'auteur.
    assert.equal(
      clearFilters('?q=x&author=a-b&author=c-d&category=Livre&page=2'),
      '?q=x&author=a-b&author=c-d'
    )
    assert.equal(clearFilters('?author=a-b&category=Livre', { includeAuthor: true }), '')
  })

  test('hasClearableFilters : le filtre auteur seul ne rend rien effaçable', async ({ assert }) => {
    const { hasActiveFilters, hasClearableFilters } = await load()
    const none = {
      category: [],
      domain: [],
      subdomain: [],
      author: [],
      language: [],
      country: [],
      license: [],
    }
    const authorOnly = { ...none, author: ['a-b'] }
    assert.isTrue(hasActiveFilters(authorOnly))
    assert.isFalse(hasClearableFilters(authorOnly))
    assert.isTrue(hasClearableFilters({ ...authorOnly, language: ['fr'] }))
    assert.isFalse(hasClearableFilters(none))
  })
})

test.group('keyboard | Espace sur un filtre-lien (10.6)', () => {
  type KeyboardModule = {
    spaceToggle: (event: Record<string, unknown>) => 'visit' | 'swallow' | null
  }
  const loadKeyboard = async (): Promise<KeyboardModule> =>
    import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/keyboard.ts')).href)

  test('Espace simple → visite ; répétition → avalée ; modificateurs et autres touches → rien', async ({
    assert,
  }) => {
    const { spaceToggle } = await loadKeyboard()
    assert.equal(spaceToggle({ key: ' ' }), 'visit')
    assert.equal(spaceToggle({ key: ' ', repeat: true }), 'swallow')
    for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
      assert.isNull(spaceToggle({ key: ' ', [modifier]: true }), modifier)
    }
    assert.isNull(spaceToggle({ key: 'Enter' }))
  })
})

test.group('search_query | recherche de l’accueil et tris du listing (12.1)', () => {
  test('LISTING_SORTS : quatre tris D34 dans l’ordre', async ({ assert }) => {
    const { LISTING_SORTS } = await load()
    assert.deepEqual([...LISTING_SORTS], ['relevance', 'date', 'views', 'downloads'])
  })

  test('défaut = relevance avec q, date sans ; relevance sans q = date', async ({ assert }) => {
    const { defaultListingSort, effectiveListingSort } = await load()
    assert.equal(defaultListingSort('x'), 'relevance')
    assert.equal(defaultListingSort(null), 'date')
    assert.equal(defaultListingSort('   '), 'date')
    assert.equal(effectiveListingSort('relevance', null), 'date')
    assert.equal(effectiveListingSort('relevance', 'x'), 'relevance')
    assert.equal(effectiveListingSort('views', null), 'views')
  })

  test('setSort : page retirée, q et filtres gardés, valeur par défaut omise', async ({
    assert,
  }) => {
    const { setSort } = await load()
    assert.equal(setSort('?q=x&category=Livre&page=3', 'views'), '?q=x&category=Livre&sort=views')
    assert.equal(setSort('?q=x&sort=views&page=2', 'relevance'), '?q=x')
    assert.equal(setSort('?q=x', 'date'), '?q=x&sort=date')
    assert.equal(setSort('?sort=views&page=4', 'date'), '')
    assert.equal(setSort('?category=Livre', 'relevance'), '?category=Livre')
    assert.equal(setSort('', 'downloads'), '?sort=downloads')
  })

  test('setQuery : un sort devenu redondant est retiré, un tri explicite survit', async ({
    assert,
  }) => {
    const { setQuery } = await load()
    assert.equal(setQuery('?q=x&sort=date&page=2', ''), '')
    assert.equal(setQuery('?sort=relevance', 'y'), '?q=y')
    assert.equal(setQuery('?sort=views', 'y'), '?sort=views&q=y')
    assert.equal(setQuery('?sort=date', 'y'), '?sort=date&q=y')
    assert.equal(setQuery('?q=x&author=a-b', 'z'), '?q=z&author=a-b')
  })

  test('homeSearchHref : /productions?q=… ou /productions si vide', async ({ assert }) => {
    const { homeSearchHref } = await load()
    assert.equal(homeSearchHref('x y'), '/productions?q=x+y')
    assert.equal(homeSearchHref('  algèbre  '), '/productions?q=alg%C3%A8bre')
    assert.equal(homeSearchHref(''), '/productions')
    assert.equal(homeSearchHref('   '), '/productions')
  })
})
