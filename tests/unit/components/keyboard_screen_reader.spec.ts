import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 13.2 — parcours 1 et 2 au clavier et au lecteur d'écran (NFR16, D33, D36). Composants
 * vérifiés par lecture de source (frontière TS6305) ; le comportement réel (Tab, focus visible,
 * `lang`, titres) est couvert par `tests/browser/keyboard.spec.ts`.
 */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

const productionCard = read('inertia/components/public/ProductionCard.tsx')
const sharedBanner = read('inertia/components/shared/FeaturedBanner.tsx')
const publicBanner = read('inertia/components/public/FeaturedBanner.tsx')
const detail = read('inertia/pages/production.tsx')
const listing = read('inertia/pages/productions.tsx')
const home = read('inertia/pages/home.tsx')
const app = read('inertia/app.tsx')
const layout = read('inertia/layouts/PublicLayout.tsx')
const searchBar = read('inertia/components/public/SearchBar.tsx')
const filterSidebar = read('inertia/components/public/FilterSidebar.tsx')
const authorFilters = read('inertia/components/public/AuthorFilters.tsx')
const sortSelect = read('inertia/components/shared/SortSelect.tsx')
const pdfViewer = read('inertia/components/public/PdfViewer.tsx')
const shareButton = read('inertia/components/public/ShareButton.tsx')
const authorCard = read('inertia/components/public/AuthorCard.tsx')
const appCss = read('inertia/css/app.css')
const authorsPage = read('inertia/pages/authors.tsx')
const authorPage = read('inertia/pages/author.tsx')
const cardTransformer = read('app/transformers/production_card_transformer.ts')
const featuredService = read('app/services/featured_service.ts')
const locales = {
  fr: JSON.parse(read('inertia/locales/public/fr.json')),
  en: JSON.parse(read('inertia/locales/public/en.json')),
}

test.group('13.2 | langue des contenus (WCAG 3.1.1, 3.1.2)', () => {
  test('`language` sérialisé pour les cartes et la bannière', ({ assert }) => {
    assert.include(cardTransformer, 'language: p.language')
    assert.include(featuredService, 'language: production.language')
  })

  test('ProductionCard : `lang` conditionnel sur le titre et le résumé (3 variantes)', ({
    assert,
  }) => {
    assert.include(productionCard, "import { contentLang } from '~/lib/content_lang'")
    assert.include(
      productionCard,
      'contentLang(production.language, i18n.resolvedLanguage ?? i18n.language)'
    )
    assert.match(productionCard, /<Link href=\{`\/productions\/\$\{slug\}`\} lang=\{lang\}/)
    assert.equal(productionCard.match(/<p lang=\{lang\}/g)?.length, 3)
  })

  test('bannière : `lang` du titre de carte (h3), calculé par le câblage public', ({ assert }) => {
    assert.include(sharedBanner, 'lang?: string')
    assert.match(sharedBanner, /<h3\s+lang=\{item\.lang\}/)
    assert.include(publicBanner, 'lang: contentLang(item.language, uiLanguage)')
  })

  test('détail : `lang` sur le h1, le résumé et le fil d’Ariane', ({ assert }) => {
    assert.include(
      detail,
      'contentLang(production.language, i18n.resolvedLanguage ?? i18n.language)'
    )
    assert.match(detail, /<h1 lang=\{lang\}/)
    assert.match(detail, /<p lang=\{lang\} className="mt-3 whitespace-pre-line/)
    assert.match(detail, /<li aria-current="page" lang=\{lang\}/)
  })

  test('<html lang> suit la langue d’interface au démarrage et à chaque changement', ({
    assert,
  }) => {
    assert.include(app, "import { documentLang } from '~/lib/content_lang'")
    assert.include(app, 'document.documentElement.lang = documentLang(language)')
    assert.include(app, "publicI18n.on('languageChanged', syncDocumentLang)")
    assert.include(app, 'syncDocumentLang(publicI18n.resolvedLanguage ?? publicI18n.language)')
  })

  test('logo : nom accessible traduit (plus de libellé français en dur)', ({ assert }) => {
    assert.notInclude(layout, 'aria-label="Anta — Accueil"')
    assert.include(layout, "aria-label={`Anta — ${t('nav.home')}`}")
  })
})

test.group('13.2 | hiérarchie des titres', () => {
  test('listing : h2 masqué « Résultats » avant les cartes (h3), après la barre latérale', ({
    assert,
  }) => {
    assert.include(listing, `<h2 className="sr-only">{t('productions.results_heading')}</h2>`)
    assert.isBelow(listing.indexOf('<FilterSidebar'), listing.indexOf('results_heading'))
    assert.isBelow(listing.indexOf('results_heading'), listing.indexOf("{view === 'grid'"))
    assert.equal(locales.fr.productions.results_heading, 'Résultats')
    assert.equal(locales.en.productions.results_heading, 'Results')
  })

  test('cartes de production : titre en h3, jamais h1 / h2', ({ assert }) => {
    assert.equal(productionCard.match(/<h3 /g)?.length, 3)
    assert.notMatch(productionCard, /<h[12][ >]/)
  })
})

test.group('13.2 | landmarks', () => {
  test('détail : plus d’<aside> imbriqué dans l’<article> (complementary non top-level)', ({
    assert,
  }) => {
    assert.notInclude(detail, '<aside')
  })
})

test.group('13.2 | focus visible et ordre de tabulation', () => {
  test('focus global 2 px conservé', ({ assert }) => {
    assert.match(appCss, /:focus-visible\s*\{\s*outline: 2px solid var\(--color-primary\)/)
  })

  test('champs publics : plus d’`outline-none` ni d’anneau translucide', ({ assert }) => {
    assert.notInclude(searchBar, 'outline-none')
    assert.notInclude(searchBar, 'ring-green-700/20')
    assert.notInclude(filterSidebar, 'outline-none')
    for (const source of [authorFilters, sortSelect]) {
      assert.include(
        source,
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )
    }
    assert.include(
      shareButton,
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
    )
  })

  test('cartes à lien étiré : contour couvrant la carte', ({ assert }) => {
    assert.include(sharedBanner, 'has-[[data-featured-link]:focus-visible]:outline-2')
    assert.include(authorCard, 'focus-visible:after:ring-2')
  })

  test('cartes : titre puis auteurs dans l’ordre du DOM', ({ assert }) => {
    assert.isBelow(
      productionCard.indexOf('const titleLink'),
      productionCard.indexOf('const byline')
    )
    for (const variant of productionCard.split('<article').slice(1)) {
      assert.isBelow(variant.indexOf('{titleLink}'), variant.indexOf('{byline}'))
    }
    assert.isBelow(sharedBanner.indexOf('data-featured-link=""'), sharedBanner.indexOf('labels.by'))
  })
})

test.group('13.2 | focus conservé après un filtre ou un tri', () => {
  test('/authors et profil : visites `preserveState` (le focus ne retombe pas sur <body>)', ({
    assert,
  }) => {
    assert.match(authorsPage, /router\.visit\(filtersHref\(base, next\), \{\s+preserveState: true,/)
    assert.match(
      authorPage,
      /router\.visit\(sortHref\(author\.slug, value\), \{\s+preserveState: true,/
    )
  })
})

test.group('13.2 | revue : focus non rogné, options, langue de la métadonnée', () => {
  test('boîte défilante des filtres : marge pour le contour décalé (p-1, scroll-p-1)', ({
    assert,
  }) => {
    assert.include(filterSidebar, 'max-h-80 scroll-p-1 overflow-y-auto p-1')
  })

  test('options des listes publiques : contour 2 px au focus', ({ assert }) => {
    assert.include(
      sortSelect,
      'focus:outline-solid focus:outline-2 focus:-outline-offset-2 focus:outline-ring'
    )
    assert.include(sortSelect, 'className={OPTION_FOCUS}')
    assert.equal(authorFilters.match(/className=\{OPTION_FOCUS\}/g)?.length, 4)
  })

  test('détail : nom natif de la langue avec son `lang`', ({ assert }) => {
    assert.include(detail, '<dd lang={valueLang}')
    assert.include(detail, 'production.language in LANGUAGE_LABELS ? lang : undefined')
  })
})

test.group('13.2 | cibles ≥ 44 px', () => {
  test('filtres : résumés, lignes, recherche de facette, « Effacer les filtres »', ({ assert }) => {
    assert.include(filterSidebar, "const ROW_CLASS = 'flex min-h-11")
    assert.include(filterSidebar, '<summary className="flex min-h-11')
    assert.include(filterSidebar, 'mb-2 h-11 w-full')
    assert.include(filterSidebar, 'inline-flex min-h-11 items-center text-xs text-green-700')
    assert.include(filterSidebar, 'mb-3 flex min-h-11 w-full')
  })

  test('pagination du listing, plein écran du PDF, partage', ({ assert }) => {
    assert.match(
      listing,
      /buildHref=\{\(p\) => `\/productions\$\{setPage\(search, p\)\}`\}\s+size="touch"/
    )
    assert.include(pdfViewer, 'inline-flex min-h-11')
    assert.include(shareButton, "'min-h-11 shrink-0")
    assert.include(listing, 'mt-3 inline-flex min-h-11 items-center text-sm text-green-700')
  })
})

test.group('13.2 | contrastes (1.4.3, 1.4.11)', () => {
  test('cases et chevrons du panneau de filtres ≥ 3:1 (revue 13.2)', ({ assert }) => {
    assert.include(filterSidebar, "'border-green-700 bg-green-700 text-white' : 'border-stone-500'")
    assert.include(filterSidebar, '<ChevronDown className="size-4 text-stone-500" aria-hidden />')
    assert.notInclude(filterSidebar, "'border-stone-300'")
  })

  test('champs publics : bordure stone-500 (≥ 3:1), placeholder stone-500 (≥ 4,5:1)', ({
    assert,
  }) => {
    assert.include(searchBar, 'border border-stone-500')
    assert.include(searchBar, 'placeholder:text-stone-500')
    assert.notInclude(searchBar, 'text-stone-400')
    assert.include(filterSidebar, 'border border-stone-500 px-3 text-sm placeholder:text-stone-500')
    assert.match(authorFilters, /const FIELD =\s+'border-stone-500/)
    assert.include(authorFilters, 'placeholder:text-stone-500')
    assert.notInclude(authorFilters, 'text-stone-400')
    assert.include(sortSelect, 'border-stone-500')
  })

  test('accroche du hero en green-800 (6,5:1), plus green-700 (4,6:1)', ({ assert }) => {
    assert.include(home, 'tracking-widest text-green-800')
    assert.notInclude(home, 'tracking-widest text-green-700')
  })

  test('aucun texte informatif en stone-400 dans le panneau de filtres (sauf ligne inerte)', ({
    assert,
  }) => {
    assert.notInclude(filterSidebar, 'text-xs text-stone-400')
    // Ligne inerte (limite de 20 auteurs) : composant désactivé, exempté du 1.4.3.
    assert.include(filterSidebar, "'cursor-not-allowed text-stone-400'")
  })
})
