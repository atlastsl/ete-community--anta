import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 12.1 — recherche avancée depuis l'accueil et tris du listing, par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const home = read('inertia/pages/home.tsx')
const listing = read('inertia/pages/productions.tsx')
const sortSelect = read('inertia/components/shared/SortSelect.tsx')
const searchBar = read('inertia/components/public/SearchBar.tsx')
const layout = read('inertia/layouts/PublicLayout.tsx')
const fr = JSON.parse(read('inertia/locales/public/fr.json'))
const en = JSON.parse(read('inertia/locales/public/en.json'))

test.group('Accueil | SearchBar + « Recherche avancée » (12.1, D8)', () => {
  test('lien « Recherche avancée » vers /productions sans paramètre, comme le pied de page', ({
    assert,
  }) => {
    assert.include(home, '<Link')
    assert.match(home, /<Link\s+href="\/productions"/)
    assert.include(layout, '<Link href="/productions"')
    assert.include(home, "t('home.hero.advanced_search')")
  })

  test('bouton outline pilule 48 px, icône aria-hidden, accolé ≥ sm et pleine largeur < sm', ({
    assert,
  }) => {
    assert.include(home, '<SlidersHorizontal className="size-4" aria-hidden />')
    for (const cls of ['h-12', 'rounded-full', 'border-stone-300', 'hover:border-green-700']) {
      assert.include(home, cls)
    }
    assert.include(home, 'flex-col gap-3 sm:flex-row')
    assert.include(home, 'w-full')
    assert.include(home, 'sm:w-auto')
  })

  test('le lien suit la SearchBar dans le hero ; la SearchBar partagée ne le porte pas', ({
    assert,
  }) => {
    const bar = home.indexOf('<SearchBar')
    const link = home.indexOf("t('home.hero.advanced_search')")
    const banner = home.indexOf('<FeaturedBanner')
    assert.isTrue(bar > -1 && bar < link && link < banner)
    assert.notInclude(searchBar, 'advanced_search')
  })

  test('soumission par homeSearchHref (barre vide → /productions)', ({ assert }) => {
    assert.include(home, 'homeSearchHref')
    assert.include(home, 'router.visit(homeSearchHref(query))')
    assert.notInclude(home, 'if (!query) return')
  })

  test('puces de catégories et prop categories supprimées', ({ assert }) => {
    assert.notInclude(home, 'FilterBar')
    assert.notInclude(home, 'categories')
  })
})

test.group('Listing | SortSelect (12.1, D34)', () => {
  test('SortSelect partagé avec id, options LISTING_SORTS et libellés listing.sort.*', ({
    assert,
  }) => {
    assert.include(listing, "import SortSelect from '~/components/shared/SortSelect'")
    assert.include(listing, '<SortSelect')
    assert.include(listing, 'id="listing-sort"')
    assert.include(listing, 'LISTING_SORTS.map(')
    assert.include(listing, 't(`listing.sort.${value}`)')
    assert.notInclude(listing, "from '~/components/ui/select'")
    assert.notInclude(listing, 'SORT_VALUES')
  })

  test('« Pertinence » désactivée sans q (D-12.1-4)', ({ assert }) => {
    assert.include(listing, "disabled: value === 'relevance' && !q")
    assert.include(sortSelect, 'disabled?: boolean')
    assert.include(sortSelect, 'disabled={option.disabled}')
  })

  test('libellé visible associé au déclencheur (htmlFor / id)', ({ assert }) => {
    assert.include(sortSelect, 'htmlFor={id}')
    assert.include(sortSelect, '<SelectTrigger id={id}')
    assert.include(sortSelect, "t('sort.label')")
  })

  test('changement de tri : setSort, scroll préservé puis ramené en haut des résultats', ({
    assert,
  }) => {
    assert.include(listing, 'router.visit(`/productions${setSort(search, value)}`, {')
    assert.include(listing, 'preserveScroll: true')
    assert.include(listing, 'getElementById(RESULTS_ID)')
    // En-tête collant : seuil = scroll-margin-top de l'ancre (scroll-mt-24), pas 0 (revue).
    assert.include(listing, 'getComputedStyle(results).scrollMarginTop')
    assert.include(listing, 'getBoundingClientRect().top < offset')
    assert.notInclude(listing, 'getBoundingClientRect().top < 0')
    assert.include(listing, "scrollIntoView({ block: 'start' })")
    assert.include(listing, 'id={RESULTS_ID}')
    assert.include(listing, 'scroll-mt-24')
  })
})

test.group('Listing | focus clavier après un tri (revue 12.1)', () => {
  test('preserveState : pas de remontage, le focus reste sur #listing-sort', ({ assert }) => {
    const visit = listing.slice(listing.indexOf('function handleSort'))
    const body = visit.slice(0, visit.indexOf('\n  }\n'))
    assert.include(body, 'preserveState: true')
    assert.include(listing, 'id="listing-sort"')
    assert.include(sortSelect, '<SelectTrigger id={id}')
  })
})

test.group('i18n | clés 12.1 (D23, EXPERIENCE.md:72)', () => {
  test('home.hero.advanced_search en FR et EN', ({ assert }) => {
    assert.equal(fr.home.hero.advanced_search, 'Recherche avancée')
    assert.equal(en.home.hero.advanced_search, 'Advanced search')
  })

  test('listing.sort.* : libellés D34 en FR et EN', ({ assert }) => {
    assert.deepEqual(fr.listing.sort, {
      relevance: 'Pertinence',
      date: 'Récemment publiées',
      views: 'Les plus consultées',
      downloads: 'Les plus téléchargées',
    })
    assert.deepEqual(en.listing.sort, {
      relevance: 'Relevance',
      date: 'Recently published',
      views: 'Most viewed',
      downloads: 'Most downloaded',
    })
  })

  test('sort.label conservé (SortSelect), anciens libellés courts retirés', ({ assert }) => {
    assert.equal(fr.sort.label, 'Trier par')
    assert.equal(en.sort.label, 'Sort by')
    assert.notProperty(fr.sort, 'views')
    assert.notProperty(en.sort, 'views')
  })

  test('filters.label orphelin retiré (FilterBar supprimé)', ({ assert }) => {
    assert.notProperty(fr.filters, 'label')
    assert.notProperty(en.filters, 'label')
  })
})
