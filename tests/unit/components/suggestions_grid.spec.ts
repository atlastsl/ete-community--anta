import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 12.4 — `SuggestionsGrid`, `Skeleton`, variante compacte de `ProductionCard`, page de
 * détail et i18n, par lecture de source (frontière TS6305 : composants jamais importés).
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

const grid = read('inertia/components/public/SuggestionsGrid.tsx')
const skeleton = read('inertia/components/ui/skeleton.tsx')
const card = read('inertia/components/public/ProductionCard.tsx')
const page = read('inertia/pages/production.tsx')
const fr = JSON.parse(read('inertia/locales/public/fr.json'))
const en = JSON.parse(read('inertia/locales/public/en.json'))

test.group('SuggestionsGrid | source analysis (12.4)', () => {
  test('chargement au montage via le helper pur, URL Tuyau, abandon au démontage', ({ assert }) => {
    assert.include(grid, "from '~/lib/suggestions'")
    assert.match(grid, /loadSuggestions(<\w+>)?\(/)
    assert.match(grid, /cachedSuggestions(<\w+>)?\(/)
    assert.include(grid, "urlFor('production.suggestions', { slug })")
    assert.include(grid, 'useEffect(')
    assert.include(grid, 'new AbortController()')
    assert.include(grid, 'controller.abort()')
  })

  test('le helper porte le délai de 2 000 ms et la Map du module', ({ assert }) => {
    const lib = read('inertia/lib/suggestions.ts')
    assert.include(lib, 'SUGGESTIONS_TIMEOUT_MS = 2000')
    assert.include(lib, 'new Map<')
    assert.include(lib, 'setTimeout(')
    assert.notMatch(lib, /^import /m)
  })

  test('chargement : aria-busy, statut masqué, 4 squelettes aria-hidden', ({ assert }) => {
    assert.include(grid, "aria-busy={loading ? 'true' : undefined}")
    assert.include(grid, 'role="status"')
    assert.include(grid, "t('suggestions.loading')")
    assert.include(grid, 'aria-hidden="true"')
    assert.include(grid, '<Skeleton')
    assert.include(grid, 'SUGGESTIONS_MAX')
  })

  test('résultats : h2, cartes compactes, grille 2 → 4 colonnes, aria-live masquée', ({
    assert,
  }) => {
    assert.match(grid, /<h2[^>]*>\s*\{t\('suggestions\.title'\)\}/)
    assert.include(grid, 'variant="compact"')
    assert.include(grid, 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4')
    assert.include(grid, 'aria-live="polite"')
    assert.include(grid, "t('suggestions.announce', { count: results.length })")
    assert.include(grid, 'sr-only')
  })

  test('0 résultat, erreur ou délai : section retirée, aucun message, focus jamais déplacé', ({
    assert,
  }) => {
    assert.include(grid, 'results.length === 0')
    assert.include(grid, 'return null')
    assert.notInclude(grid, '.focus(')
    assert.notInclude(grid, 'suggestions.error')
  })
})

test.group('Skeleton | shadcn ajouté à la main (12.4)', () => {
  test('div simple, animation motion-safe seulement', ({ assert }) => {
    assert.include(skeleton, 'data-slot="skeleton"')
    assert.include(skeleton, 'motion-safe:animate-pulse')
    assert.notMatch(skeleton, /(?<!motion-safe:)animate-pulse/)
    assert.include(skeleton, 'export { Skeleton }')
  })
})

test.group('ProductionCard | variante compacte (12.4, D22, D35)', () => {
  test('variante compact : sans date, résumé masqué < sm, line-clamp-2 dès sm', ({ assert }) => {
    assert.include(card, "variant?: 'grid' | 'list' | 'compact'")
    assert.include(card, "variant === 'compact'")
    // Tailwind 4 : `sm:block` écraserait le `display: -webkit-box` de line-clamp (revue).
    assert.include(card, 'line-clamp-2 max-sm:hidden')
    assert.notInclude(card, 'sm:block')
    assert.match(card, /font-display text-base[^"]*sm:text-lg/)
    // Titre de carte en h3 sous le h2 « Productions similaires ».
    assert.match(card, /variant === 'compact'[\s\S]*?<h3 className="font-display text-base/)
  })
})

test.group('Page de détail | suggestions (12.4)', () => {
  test('SuggestionsGrid pleine largeur sous la grille principale, clé = slug', ({ assert }) => {
    assert.include(page, "import SuggestionsGrid from '~/components/public/SuggestionsGrid'")
    assert.include(page, '<SuggestionsGrid key={production.slug} slug={production.slug} />')
    // Après la fermeture de la grille `lg:grid-cols-3`, avant le ViewTracker.
    const gridAt = page.indexOf('lg:grid-cols-3')
    const asideEnd = page.indexOf('</aside>')
    const suggestionsAt = page.indexOf('<SuggestionsGrid')
    const trackerAt = page.indexOf('<ViewTracker')
    assert.isAbove(asideEnd, gridAt)
    assert.isAbove(suggestionsAt, asideEnd)
    assert.isAbove(trackerAt, suggestionsAt)
  })
})

test.group('i18n | suggestions.* (12.4)', () => {
  test('FR et EN : titre, chargement, annonce au pluriel', ({ assert }) => {
    assert.equal(fr.suggestions.title, 'Productions similaires')
    assert.equal(fr.suggestions.loading, 'Chargement des productions similaires…')
    assert.equal(fr.suggestions.announce_one, '{{count}} production similaire')
    assert.equal(fr.suggestions.announce_other, '{{count}} productions similaires')
    assert.equal(en.suggestions.title, 'Similar productions')
    assert.equal(en.suggestions.loading, 'Loading similar productions…')
    assert.equal(en.suggestions.announce_one, '{{count}} similar production')
    assert.equal(en.suggestions.announce_other, '{{count}} similar productions')
  })
})
