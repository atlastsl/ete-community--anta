import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 5.6 — accessibilité & responsive. Le HTML public est rendu côté client
 * (`ssr: false`), donc skip link / `<main id>` / `<h1>` ne sont PAS dans le shell
 * serveur : on vérifie la SOURCE (pattern Node-pur du repo). L'audit axe / clavier
 * en conditions réelles est une étape manuelle (cf. story, Tâche 9.4).
 */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

const publicLayout = read('inertia/layouts/PublicLayout.tsx')
const appCss = read('inertia/css/app.css')
const searchBar = read('inertia/components/public/SearchBar.tsx')
const filterBar = read('inertia/components/public/FilterBar.tsx')
const listingToggle = read('inertia/components/public/ListingToggle.tsx')
const languageSwitcher = read('inertia/components/shared/LanguageSwitcher.tsx')

test.group('A11y | PublicLayout', () => {
  test('skip link en premier, ciblant #main-content', ({ assert }) => {
    assert.include(publicLayout, 'href="#main-content"')
    assert.include(publicLayout, 'a11y.skip_to_content')
    assert.include(publicLayout, 'sr-only')
    // le skip link précède le <header> dans la source
    assert.isBelow(publicLayout.indexOf('href="#main-content"'), publicLayout.indexOf('<header'))
  })

  test('main porte id="main-content" et est focusable', ({ assert }) => {
    assert.include(publicLayout, 'id="main-content"')
    assert.include(publicLayout, 'tabIndex={-1}')
  })

  test('structure sémantique header/main/footer', ({ assert }) => {
    assert.include(publicLayout, '<header')
    assert.include(publicLayout, '<main')
    assert.include(publicLayout, '<footer')
  })
})

test.group('A11y | focus visible global', () => {
  test('app.css définit :focus-visible avec la couleur primaire', ({ assert }) => {
    assert.include(appCss, ':focus-visible')
    assert.include(appCss, 'var(--color-primary)')
    assert.include(appCss, 'outline-offset')
  })
})

test.group('A11y | cibles tactiles >= 44px & scroll-snap', () => {
  test('ListingToggle: boutons 44px (size-11)', ({ assert }) => {
    assert.include(listingToggle, 'size-11')
  })

  test('LanguageSwitcher: zone tactile >= 44px (min-h-11)', ({ assert }) => {
    assert.include(languageSwitcher, 'min-h-11')
  })

  test('SearchBar: bouton reset 44px + input pleine largeur', ({ assert }) => {
    assert.include(searchBar, 'size-11')
    assert.include(searchBar, 'w-full')
  })

  test('FilterBar: scroll-snap horizontal (homepage)', ({ assert }) => {
    assert.include(filterBar, 'snap-x')
    assert.include(filterBar, 'overflow-x-auto')
  })
})

test.group('A11y | un seul <h1> par page publique', () => {
  for (const page of [
    'home.tsx',
    'productions.tsx',
    'privacy-policy.tsx',
    'authors.tsx',
    'errors/not_found.tsx',
  ]) {
    test(`${page} contient exactement un <h1`, ({ assert }) => {
      const source = read(`inertia/pages/${page}`)
      const count = (source.match(/<h1[\s>]/g) ?? []).length
      assert.equal(count, 1, `${page} doit avoir exactement un <h1>`)
    })
  }
})

// Story 10.8 — un seul h1 sur tout l'arbre rendu : la page, PublicLayout (posé par
// `inertia/app.tsx`) et tous les composants locaux importés, récursivement (le h1 du profil vit
// dans AuthorProfileHeader ; aucun enfant — cartes, filtres, pagination — n'en ajoute un).
function componentTree(entry: string, layout = 'inertia/layouts/PublicLayout.tsx'): string[] {
  const seen = new Set<string>()
  const visit = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    const source = read(path)
    for (const match of source.matchAll(/from '~\/((?:components|layouts)\/[^']+)'/g)) {
      visit(`inertia/${match[1]}.tsx`)
    }
  }
  visit(entry)
  visit(layout)
  return [...seen]
}

const h1Count = (source: string) => (source.match(/<h1[\s>]/g) ?? []).length

test.group('A11y | un seul <h1> sur l’arbre des pages auteurs (Story 10.8)', () => {
  const cases = {
    'inertia/pages/authors.tsx': {
      h1In: 'inertia/pages/authors.tsx',
      children: [
        'inertia/components/public/AuthorCard.tsx',
        'inertia/components/public/AuthorFilters.tsx',
        'inertia/components/shared/Pagination.tsx',
        'inertia/components/shared/SortSelect.tsx',
        'inertia/components/shared/Avatar.tsx',
      ],
    },
    'inertia/pages/author.tsx': {
      h1In: 'inertia/components/public/AuthorProfileHeader.tsx',
      children: [
        'inertia/components/public/AuthorProfileHeader.tsx',
        'inertia/components/public/ProductionCard.tsx',
        'inertia/components/public/AuthorByline.tsx',
        'inertia/components/shared/Pagination.tsx',
        'inertia/components/shared/SortSelect.tsx',
        'inertia/components/shared/Avatar.tsx',
      ],
    },
  }
  for (const [page, { h1In, children }] of Object.entries(cases)) {
    test(`${page} : exactement un <h1> (dans ${h1In}), aucun dans les autres fichiers`, ({
      assert,
    }) => {
      const tree = componentTree(page)
      for (const child of children) assert.include(tree, child, `${child} non résolu`)
      for (const file of tree) {
        assert.equal(h1Count(read(file)), file === h1In ? 1 : 0, `<h1> dans ${file}`)
      }
    })
  }
})

// Story 11.7 — même règle pour l'accueil avec sa bannière (h2 masqué, cartes en h3 : jamais de
// h1 dans `public/FeaturedBanner`, `shared/FeaturedBanner`, `AuthorByline`) et pour la page
// admin « À la une » (AdminLayout, emplacements, sélecteur, aperçu de la bannière partagée).
test.group('A11y | un seul <h1> sur l’arbre de l’accueil et de « À la une » (Story 11.7)', () => {
  const cases = {
    'inertia/pages/home.tsx': {
      layout: 'inertia/layouts/PublicLayout.tsx',
      children: [
        'inertia/components/public/FeaturedBanner.tsx',
        'inertia/components/shared/FeaturedBanner.tsx',
        'inertia/components/public/AuthorByline.tsx',
        'inertia/components/public/ProductionCard.tsx',
      ],
    },
    'inertia/pages/admin/Featured/Index.tsx': {
      layout: 'inertia/layouts/AdminLayout.tsx',
      children: [
        'inertia/components/admin/FeaturedSlot.tsx',
        'inertia/components/admin/ProductionPicker.tsx',
        'inertia/components/admin/ThumbnailField.tsx',
        'inertia/components/admin/BannerPreview.tsx',
        'inertia/components/shared/FeaturedBanner.tsx',
      ],
    },
  }
  for (const [page, { layout, children }] of Object.entries(cases)) {
    test(`${page} : exactement un <h1> (dans la page), aucun dans les composants`, ({ assert }) => {
      const tree = componentTree(page, layout)
      for (const child of children) assert.include(tree, child, `${child} non résolu`)
      for (const file of tree) {
        assert.equal(h1Count(read(file)), file === page ? 1 : 0, `<h1> dans ${file}`)
      }
    })
  }
})
