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
  for (const page of ['home.tsx', 'productions.tsx', 'privacy-policy.tsx']) {
    test(`${page} contient exactement un <h1`, ({ assert }) => {
      const source = read(`inertia/pages/${page}`)
      const count = (source.match(/<h1[\s>]/g) ?? []).length
      assert.equal(count, 1, `${page} doit avoir exactement un <h1>`)
    })
  }
})
