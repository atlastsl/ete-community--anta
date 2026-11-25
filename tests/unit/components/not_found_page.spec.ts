import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : page testée par lecture de source (Story 10.1, D36).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const page = read('inertia/pages/errors/not_found.tsx')
const locales = {
  'public/fr': JSON.parse(read('inertia/locales/public/fr.json')),
  'public/en': JSON.parse(read('inertia/locales/public/en.json')),
  'admin/fr': JSON.parse(read('inertia/locales/admin/fr.json')),
  'admin/en': JSON.parse(read('inertia/locales/admin/en.json')),
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

test.group('NotFoundPage | structure', () => {
  test('un seul h1, traduit', ({ assert }) => {
    assert.lengthOf(page.match(/<h1\b/g) ?? [], 1)
    assert.include(page, "{t('not_found.title')}")
    assert.include(page, "{t('not_found.message')}")
    assert.notInclude(page, 'Page not found</h1>')
  })

  test('liens Accueil, Auteurs et Recherche avancée (dans cet ordre), hauteur ≥ 44 px', ({
    assert,
  }) => {
    assert.include(page, 'href="/"')
    assert.include(page, 'href="/productions"')
    assert.include(page, "{t('not_found.home')}")
    assert.include(page, "{t('not_found.search')}")
    // Story 10.5 (report D-10.1-5) : lien « Auteurs » entre Accueil et Recherche avancée.
    assert.include(page, "{t('not_found.authors')}")
    const links = page.match(/<a\s+href=[^>]*>/g) ?? []
    assert.lengthOf(links, 3)
    assert.deepEqual(
      links.map((l) => l.match(/href="([^"]+)"/)?.[1]),
      ['/', '/authors', '/productions']
    )
    assert.match(page, /const LINK_BASE =\s*'[^']*\bmin-h-11\b/)
    for (const link of links) assert.include(link, '${LINK_BASE}')
  })

  test('liens en <a href> (chargement complet), jamais <Link> Inertia', ({ assert }) => {
    // Revue 10.1 : rendue aussi par le bundle admin (URL /admin/* inconnue) et sans <Head> public.
    assert.notInclude(page, '@adonisjs/inertia/react')
    assert.notInclude(page, '@inertiajs/react')
    assert.notMatch(page, /<Link\b/)
  })

  test('liens regroupés dans une navigation nommée', ({ assert }) => {
    assert.include(page, "<nav aria-label={t('not_found.nav_label')}")
  })
})

test.group('NotFoundPage | i18n', () => {
  test('clés utilisées présentes en FR et EN (public et admin)', ({ assert }) => {
    const keys = [...page.matchAll(/t\('([^']+)'\)/g)].map((m) => m[1])
    assert.includeMembers(keys, [
      'not_found.title',
      'not_found.message',
      'not_found.home',
      'not_found.authors',
    ])
    for (const [name, dict] of Object.entries(locales)) {
      for (const key of keys) {
        assert.isString(lookup(dict, key), `${name} : clé manquante ${key}`)
      }
    }
  })

  test('message 404 conforme à EXPERIENCE.md', ({ assert }) => {
    assert.equal(
      lookup(locales['public/fr'], 'not_found.message'),
      "Cette page n'existe pas ou n'est plus disponible."
    )
    assert.equal(
      lookup(locales['public/en'], 'not_found.message'),
      'This page does not exist or is no longer available.'
    )
    assert.equal(lookup(locales['public/fr'], 'not_found.search'), 'Recherche avancée')
    assert.equal(lookup(locales['public/en'], 'not_found.search'), 'Advanced search')
  })
})
