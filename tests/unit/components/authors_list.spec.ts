import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PublicAuthorService from '#services/public_author_service'

// Story 10.5 — frontière TS6305 : page, composants et helpers testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const card = read('inertia/components/public/AuthorCard.tsx')
const filters = read('inertia/components/public/AuthorFilters.tsx')
const page = read('inertia/pages/authors.tsx')
const query = read('inertia/lib/authors_list_query.ts')
const layout = read('inertia/layouts/PublicLayout.tsx')
const pagination = read('inertia/components/shared/Pagination.tsx')
const profilePage = read('inertia/pages/author.tsx')
const locales = {
  fr: JSON.parse(read('inertia/locales/public/fr.json')),
  en: JSON.parse(read('inertia/locales/public/en.json')),
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/** i18n keys used through `t('…')` in a source file (plural keys resolved by suffix). */
function usedKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*['`]([a-z_.]+)['`]/g)].map((m) => m[1])
}

function hasKey(dict: Record<string, any>, key: string): boolean {
  return (
    typeof lookup(dict, key) === 'string' ||
    (typeof lookup(dict, `${key}_one`) === 'string' &&
      typeof lookup(dict, `${key}_other`) === 'string')
  )
}

test.group('AuthorCard', () => {
  test('un seul lien, étendu à la carte (stretched link), jamais de onClick', ({ assert }) => {
    assert.lengthOf(card.match(/<Link\b/g) ?? [], 1)
    assert.notMatch(card, /<a\b/)
    assert.notInclude(card, 'onClick=')
    assert.match(card, /<article className="relative\b/)
    // La classe d'extension est portée par le lien lui-même (dans sa balise ouvrante), à
    // l'intérieur de la carte `relative`.
    const linkTag = card.match(/<Link\b[^>]*>/)?.[0] ?? ''
    assert.match(linkTag, /className="after:absolute after:inset-0\b/)
    const article = card.indexOf('<article')
    assert.isTrue(
      article < card.indexOf('<Link') && card.indexOf('</Link>') < card.indexOf('</article>')
    )
    assert.include(card, "href={urlFor('authors.show', { slug: author.slug })}")
  })

  test('avatar md décoratif (alt=""), nom « Prénom NOM »', ({ assert }) => {
    assert.match(card, /<Avatar[\s\S]*?size="md"[\s\S]*?alt=""/)
    assert.include(card, 'photoBase={author.photoBase}')
    assert.include(card, 'formatAuthorName(author.firstNames, author.lastNames)')
  })

  test('institution principale omise si absente, productions et vues au pluriel', ({ assert }) => {
    assert.include(card, '{author.primaryInstitution && (')
    assert.include(card, "t('authors.list.card.productions'")
    assert.include(card, "t('authors.list.card.views'")
    assert.include(card, 'count: author.viewsCount')
  })

  test('focus visible sur la carte', ({ assert }) => {
    assert.include(card, 'focus-visible:after:ring-2')
  })
})

test.group('AuthorFilters', () => {
  test('formulaire de recherche nommé, soumis par Entrée, libellés visibles', ({ assert }) => {
    assert.include(filters, 'role="search"')
    assert.include(filters, 'onSubmit={submit}')
    assert.include(filters, 'event.preventDefault()')
    assert.include(filters, '<label htmlFor="authors-q"')
    assert.include(filters, 'aria-labelledby="authors-institution-label"')
    assert.include(filters, 'aria-labelledby="authors-domain-label"')
    assert.include(filters, '<SortSelect')
  })

  test('sélections uniques avec sentinelle « toutes » (Radix refuse value="")', ({ assert }) => {
    assert.include(filters, "const ALL_VALUE = '__all__'")
    assert.include(filters, "t('authors.list.institution_all')")
    assert.include(filters, "t('authors.list.domain_all')")
    assert.include(filters, 'v === ALL_VALUE ? null : v')
  })

  test('chaque changement transmet la saisie courante de q (pas l’état serveur)', ({ assert }) => {
    assert.include(filters, 'onChange({ ...state, q: q.trim() || null, ...patch })')
    // Un seul appel à onChange (dans `change`) ; sélections, tri et soumission passent par lui.
    assert.lengthOf(filters.match(/\bonChange\(\{/g) ?? [], 1)
    assert.lengthOf(filters.match(/\bchange\(\{/g) ?? [], 4)
  })

  test('contrôles ≥ 44 px, grille empilée / 2 / 4 colonnes', ({ assert }) => {
    assert.lengthOf(filters.match(/min-h-11/g) ?? [], 3)
    assert.include(filters, 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4')
  })

  test('domaines affichés avec leur libellé de taxonomie', ({ assert }) => {
    assert.include(filters, "taxonomyLabel(t, 'domains', value)")
  })
})

test.group('Page authors', () => {
  test('un seul h1, introduction, grille 1/2/3/4 colonnes', ({ assert }) => {
    assert.lengthOf(page.match(/<h1\b/g) ?? [], 1)
    assert.include(page, "{t('authors.list.title')}")
    assert.include(page, "{t('authors.list.intro')}")
    assert.include(page, 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
  })

  test('compteur en aria-live="polite" (résultats et absence de résultat), nombres formatés', ({
    assert,
  }) => {
    const live = page.match(/<p\b[^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/p>/)
    assert.isNotNull(live)
    assert.include(live![1], "t('authors.list.count'")
    assert.include(live![1], "t('authors.list.no_results')")
    assert.include(live![1], 'formattedCount: format(pagination.total)')
    assert.include(live![1], 'from: format(from)')
    assert.include(page, 'value.toLocaleString(i18n.language)')
  })

  test('changement de filtre ou de tri : défilement ramené en haut des résultats', ({ assert }) => {
    assert.include(page, "const RESULTS_ID = 'authors-results'")
    assert.match(page, /<p\s+id=\{RESULTS_ID\}/)
    assert.match(page, /onSuccess:[\s\S]*?getElementById\(RESULTS_ID\)[\s\S]*?scrollIntoView/)
  })

  test('états vides distincts : aucun profil / filtres sans résultat + Effacer les filtres', ({
    assert,
  }) => {
    assert.include(page, "t('authors.list.empty')")
    assert.include(page, "t('authors.list.no_results')")
    assert.include(page, "t('authors.list.clear_filters')")
    assert.match(page, /<Link\s+href=\{base\}[\s\S]*?min-h-11/)
  })

  test('URL via urlFor, changement → page 1, pagination conservant l’état, cibles 44 px', ({
    assert,
  }) => {
    assert.include(page, "urlFor('authors.index')")
    assert.include(page, 'filtersHref(base, next)')
    assert.include(page, 'buildHref={(p) => pageHref(base, state, p)}')
    assert.include(page, 'size="touch"')
    assert.include(profilePage, 'size="touch"')
    assert.include(pagination, "size === 'touch' ? 'h-11 min-w-11' : 'h-9 min-w-9'")
  })
})

test.group('Helpers d’URL (miroir serveur)', () => {
  test('défauts omis, page 1 omise, paramètres dans le même ordre que le serveur', ({ assert }) => {
    assert.include(query, "DEFAULT_AUTHORS_LIST_SORT = 'views'")
    assert.include(query, "['views', 'name', 'productions']")
    assert.include(query, 'if (page > 1)')
    assert.include(query, 'return listUrl(base, state, 1)')
    const order = ["'q'", "'institution'", "'domain'", "'sort'", "'page'"].map((k) =>
      query.indexOf(`params.set(${k}`)
    )
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order
    )
  })

  test('serveur : authorsListPath', ({ assert }) => {
    const empty = { q: null, institution: null, domain: null }
    assert.equal(PublicAuthorService.authorsListPath(empty, 'views', 1), '/authors')
    assert.equal(
      PublicAuthorService.authorsListPath(
        { q: 'jeanne', institution: 'Institut Exemple', domain: 'law' },
        'name',
        3
      ),
      '/authors?q=jeanne&institution=Institut+Exemple&domain=law&sort=name&page=3'
    )
  })

  test('serveur : parseListFilters et parseListSort', ({ assert }) => {
    assert.deepEqual(
      PublicAuthorService.parseListFilters({ q: '  ', institution: ['a'], domain: 3 }),
      {
        q: null,
        institution: null,
        domain: null,
      }
    )
    assert.equal(PublicAuthorService.parseListFilters({ q: 'x'.repeat(150) }).q?.length, 100)
    // Troncature par points de code : jamais de paire de substitution coupée.
    const emoji = PublicAuthorService.parseListFilters({ q: '😀'.repeat(150) }).q!
    assert.equal(Array.from(emoji).length, 100)
    assert.equal(emoji, '😀'.repeat(100))
    assert.equal(PublicAuthorService.parseListSort('productions'), 'productions')
    assert.equal(PublicAuthorService.parseListSort('relevance'), 'views')
  })

  test('serveur : facettes limitées par le scope partagé visibleOnSite (règle non réécrite)', ({
    assert,
  }) => {
    const service = read('app/services/public_author_service.ts')
    assert.notMatch(service, /consent_confirmed_at IS NOT NULL/i)
    assert.notMatch(service, /whereNotNull\('(authors\.)?consent_confirmed_at'\)/)
    assert.lengthOf(
      service.match(/whereIn\('[a-z]+\.author_id', this\.visibleAuthorIds\(\)\)/g) ?? [],
      2
    )
  })

  test('serveur : knownFilters (libellé canonique, valeurs inconnues → null)', ({ assert }) => {
    const options = [{ value: 'École Exemple', label: 'École Exemple' }]
    const known = (institution: string | null, domain: string | null) =>
      PublicAuthorService.knownFilters({ q: 'x', institution, domain }, options, ['law'])
    assert.deepEqual(known('ecole EXEMPLE', 'law'), {
      q: 'x',
      institution: 'École Exemple',
      domain: 'law',
    })
    assert.deepEqual(known('Autre', 'LAW'), { q: 'x', institution: null, domain: null })
    assert.deepEqual(known(null, null), { q: 'x', institution: null, domain: null })
  })
})

test.group('Pied de page « Explorer »', () => {
  test('Accueil, Recherche avancée, Auteurs, Politique de confidentialité, dans cet ordre', ({
    assert,
  }) => {
    const keys = ['nav.home', 'nav.advanced_search', 'nav.authors', 'nav.privacy_policy'].map((k) =>
      layout.indexOf(`{t('${k}')}`)
    )
    for (const index of keys) assert.isAbove(index, -1)
    assert.deepEqual(
      [...keys].sort((a, b) => a - b),
      keys
    )
    assert.include(layout, "href={urlFor('authors.index')}")
    assert.notInclude(layout, "t('nav.search')")
  })

  test('libellés conformes à EXPERIENCE.md', ({ assert }) => {
    assert.equal(lookup(locales.fr, 'nav.advanced_search'), 'Recherche avancée')
    assert.equal(lookup(locales.en, 'nav.advanced_search'), 'Advanced search')
    assert.equal(lookup(locales.fr, 'nav.authors'), 'Auteurs')
    assert.equal(lookup(locales.en, 'nav.authors'), 'Authors')
  })
})

test.group('Liste des auteurs | i18n', () => {
  test('toutes les clés utilisées existent en FR et EN', ({ assert }) => {
    const sources = [card, filters, page, layout]
    const keys = sources.flatMap(usedKeys).filter((k) => !k.endsWith('.'))
    // Clés de tri construites dynamiquement.
    for (const sort of ['views', 'name', 'productions']) keys.push(`authors.list.sort.${sort}`)
    keys.push('authors.profile.breadcrumb_authors')
    for (const [name, dict] of Object.entries(locales)) {
      for (const key of keys) assert.isTrue(hasKey(dict, key), `${name} : clé manquante ${key}`)
    }
  })

  test('libellés de EXPERIENCE.md (Voice and Tone)', ({ assert }) => {
    assert.equal(
      lookup(locales.fr, 'authors.list.sort.views'),
      'Les plus consultés (12 derniers mois)'
    )
    assert.equal(lookup(locales.fr, 'authors.list.empty'), 'Aucun auteur pour le moment.')
    assert.equal(
      lookup(locales.fr, 'authors.list.no_results'),
      'Aucun auteur ne correspond à votre recherche.'
    )
    assert.equal(lookup(locales.en, 'authors.list.empty'), 'No authors yet.')
    assert.equal(
      lookup(locales.fr, 'authors.list.count_other'),
      '{{formattedCount}} auteurs · {{from}}–{{to}}'
    )
    assert.equal(
      lookup(locales.en, 'authors.list.count_other'),
      '{{formattedCount}} authors · {{from}}–{{to}}'
    )
  })
})
