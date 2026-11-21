import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 10.6 — facette auteur du panneau de filtres, par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const sidebar = read('inertia/components/public/FilterSidebar.tsx')
const filterBar = read('inertia/components/public/FilterBar.tsx')
const productionsPage = read('inertia/pages/productions.tsx')
const filterChip = read('inertia/components/public/FilterChip.tsx')

test.group('FilterSidebar | facette auteur (10.6)', () => {
  test('options { value, label } : libellé affiché, slug dans l’URL', ({ assert }) => {
    assert.include(sidebar, 'facetOptions(facets, dim')
    assert.include(sidebar, 'label={option.label}')
    assert.include(sidebar, 'toggleFilter(search, dim, option.value)')
    assert.include(sidebar, 'isFilterActive(activeFilters, dim, option.value)')
  })

  test('recherche de facette sur le libellé ; auteurs cochés toujours affichés', ({ assert }) => {
    assert.match(
      sidebar,
      /isFilterActive\(activeFilters, dim, option\.value\) \|\|\s*matchesFacetQuery\(option\.label, authorQuery\)/
    )
    assert.notInclude(sidebar, 'v.toLowerCase().includes')
  })

  test('bascules sur la même page : preserveState + preserveScroll (pas de remontage)', ({
    assert,
  }) => {
    assert.include(sidebar, 'const SAME_PAGE = { preserveState: true, preserveScroll: true }')
    assert.include(sidebar, 'router.visit(href, SAME_PAGE)')
    assert.equal(sidebar.split('{...SAME_PAGE}').length - 1, 2) // lignes + « Effacer filtres »
    assert.include(filterBar, 'preserveState')
    assert.include(
      filterChip,
      'router.visit(href, { preserveState, preserveScroll: preserveState })'
    )
  })

  test('groupe déplié par un état local (reste ouvert pendant les bascules)', ({ assert }) => {
    assert.include(sidebar, 'const [expanded, setExpanded] = useState(activeCount > 0)')
    assert.include(sidebar, 'open={expanded}')
    assert.include(sidebar, 'onToggle={(event) => setExpanded(event.currentTarget.open)}')
  })

  test('20 auteurs actifs : lignes non cochées inertes + texte d’aide', ({ assert }) => {
    assert.include(sidebar, 'activeCount >= MAX_AUTHOR_FILTERS')
    assert.include(sidebar, 'disabled={authorLimitReached && !active}')
    assert.include(sidebar, 'aria-disabled="true"')
    assert.include(sidebar, "t('filters.author_limit', { count: MAX_AUTHOR_FILTERS })")
  })

  test('Espace : spaceToggle (répétition et modificateurs ignorés) dans les deux filtres', ({
    assert,
  }) => {
    for (const source of [sidebar, filterChip]) {
      assert.include(source, 'const action = spaceToggle(event)')
      assert.include(source, "if (action === 'visit')")
      assert.notInclude(source, "if (event.key === ' ')")
    }
    assert.include(sidebar, 'aria-pressed={active}')
  })

  test('liens reconstruits depuis activeFilters.author (slugs ignorés retirés)', ({ assert }) => {
    for (const source of [sidebar, filterBar, productionsPage]) {
      assert.include(source, 'withActiveAuthors(')
      assert.include(source, 'activeFilters.author')
    }
  })

  test('« Effacer les filtres » : visible seulement si un filtre effaçable (hors auteur) est actif', ({
    assert,
  }) => {
    // D-10.6-2 amendée (2026-11-21) : le filtre auteur survit à « Effacer les filtres ».
    for (const source of [sidebar, filterBar]) {
      assert.include(source, '{hasClearableFilters(activeFilters) && (')
      assert.notInclude(source, 'hasActiveFilters(')
    }
  })

  test('état vide : la sortie garde l’auteur, sauf s’il est le seul filtre actif', ({ assert }) => {
    assert.include(productionsPage, '{hasActiveFilters(activeFilters) && (')
    assert.include(productionsPage, 'includeAuthor: !hasClearableFilters(activeFilters)')
  })

  test('FilterBar (mode listing) lit la même forme de facette', ({ assert }) => {
    assert.include(filterBar, 'facetOptions(facets, dim')
    assert.include(filterBar, 'label={option.label}')
  })

  test('région aria-live toujours montée, hors des branches de résultats (flux 5)', ({
    assert,
  }) => {
    const region = productionsPage.indexOf('role="status" aria-live="polite"')
    assert.isAbove(region, -1)
    assert.isBelow(region, productionsPage.indexOf('results.length === 0 ? ('))
    assert.include(productionsPage, '{announcement}')
    for (const key of ['no_results_for', 'no_results', 'approximate_notice', 'results_count']) {
      assert.include(productionsPage, `t('productions.${key}'`)
    }
    // Le compteur visible n'est plus annoncé une seconde fois.
    assert.equal(productionsPage.split('aria-live').length - 1, 1)
  })
})
