import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 11.6 — bannière à la une de l'accueil, testée par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const home = read('inertia/pages/home.tsx')
const entry = read('inertia/components/public/FeaturedBanner.tsx')
const shared = read('inertia/components/shared/FeaturedBanner.tsx')
const preview = read('inertia/components/admin/BannerPreview.tsx')
const css = read('inertia/css/app.css')
const fr = JSON.parse(read('inertia/locales/public/fr.json'))
const en = JSON.parse(read('inertia/locales/public/en.json'))

test.group('Accueil | bannière à la une (11.6)', () => {
  test('home : prop featured, bannière sous le hero, puis les blocs (12.2)', ({ assert }) => {
    assert.include(home, "from '~/components/public/FeaturedBanner'")
    assert.include(home, 'featured: FeaturedBannerItem[]')
    assert.include(home, '<FeaturedBanner items={featured} />')
    const hero = home.indexOf('<SearchBar')
    const banner = home.indexOf('<FeaturedBanner')
    const blocks = home.indexOf('<HomeBlock')
    assert.isTrue(hero < banner && banner < blocks, 'hero → bannière → blocs')
    assert.notInclude(home, '<FilterBar') // puces supprimées (12.1, D8)
  })

  test('point d’entrée public : rendu partagé, aria-label, AuthorByline, srcset, lien détail', ({
    assert,
  }) => {
    assert.include(entry, "from '~/components/shared/FeaturedBanner'")
    assert.include(entry, "heading={t('featured.region')}")
    assert.include(entry, '<AuthorByline')
    assert.include(entry, 'max={BANNER_MAX_AUTHORS}')
    assert.include(entry, 'const BANNER_MAX_AUTHORS = 3')
    assert.include(entry, 'bannerImage(item.imageUrl, bannerSlot(index, items.length))')
    assert.include(entry, 'imageSrcSet: image?.srcSet')
    assert.include(entry, 'imageSizes: image?.sizes')
    assert.include(entry, "urlFor('production.show', { slug: item.slug })")
    // Rien sans élément : ni section, ni espace réservé.
    assert.include(entry, 'if (items.length === 0) return null')
  })

  test('carte : un seul lien principal étiré, auteurs au-dessus et hors du titre, focus de carte', ({
    assert,
  }) => {
    assert.equal(shared.match(/<Link\b/g)?.length, 1, 'un seul lien principal')
    assert.notInclude(shared, '<a ')
    assert.include(shared, 'after:absolute after:inset-0')
    assert.include(shared, 'data-featured-link')
    assert.include(shared, 'has-[[data-featured-link]:focus-visible]:outline-2')
    // Auteurs après le </h3> (aucun lien imbriqué), au-dessus du lien étiré.
    const h3End = shared.indexOf('</h3>')
    const byline = shared.indexOf('renderAuthors ? renderAuthors(item)')
    assert.isTrue(h3End > 0 && byline > h3End, 'byline hors du titre, après lui')
    assert.include(shared, 'relative z-10 mt-1')
    // Titre puis auteurs dans l'ordre du DOM (tabulation).
    assert.isTrue(shared.indexOf('data-featured-link') < byline)
  })

  test('images : alt vide, 16:9 cover, LCP sur la 1re, lazy ensuite, zone vide en erreur', ({
    assert,
  }) => {
    assert.include(shared, 'alt=""')
    assert.include(shared, 'aspect-video w-full bg-stone-200')
    assert.include(shared, 'object-cover')
    assert.include(shared, "loading={lead ? 'eager' : 'lazy'}")
    assert.include(shared, "fetchPriority={lead ? 'high' : 'auto'}")
    assert.include(shared, 'lead={index === 0}')
    assert.include(shared, 'width={1600}')
    assert.include(shared, 'height={900}')
    assert.include(shared, 'onError={() => setFailedSrc(src)}')
  })

  test('image étirée de lead en position absolue (hauteur fixée par les cartes empilées)', ({
    assert,
  }) => {
    assert.include(shared, "stretched && 'lg:relative lg:aspect-auto lg:min-h-0 lg:flex-1'")
    assert.include(shared, "stretched && 'lg:absolute lg:inset-0'")
    assert.include(shared, 'lg:col-span-2 lg:row-span-2')
  })

  test('compteurs : libellés lecteurs d’écran, icônes aria-hidden ; pas de carrousel', ({
    assert,
  }) => {
    assert.include(shared, '<span className="sr-only">{labels.views}</span>')
    assert.include(shared, '<span className="sr-only">{labels.downloads}</span>')
    assert.equal(shared.match(/aria-hidden="true"/g)?.length, 2)
    // Pas de rotation automatique (EXPERIENCE.md:176).
    assert.notMatch(shared, /setInterval|setTimeout|autoplay/i)
  })

  test('aperçu admin inchangé : sans href, donc sans lien ni focus', ({ assert }) => {
    assert.notMatch(preview, /href[:=]/)
    assert.notInclude(preview, 'heading=')
    assert.notInclude(preview, 'renderAuthors')
    // Aperçu à l'échelle : largeur de contenu publique 1232 px (max-w-7xl − px-6), revue 11.6.
    assert.include(preview, 'const PUBLIC_WIDTH = 1232')
    // Contexte de titres admin : h2 « Aperçu de la bannière » au-dessus des h3 des cartes.
    assert.include(preview, '<h2 id="featured-preview-heading"')
  })

  test('i18n public featured.* : libellés EXPERIENCE.md, parité fr/en', ({ assert }) => {
    assert.equal(fr.featured.region, 'Productions à la une')
    assert.equal(en.featured.region, 'Featured productions')
    assert.equal(fr.featured.by, 'Par')
    assert.equal(fr.featured.views, 'Vues :')
    assert.equal(fr.featured.downloads, 'Téléchargements :')
    assert.sameMembers(Object.keys(fr.featured), Object.keys(en.featured))
    for (const key of Object.keys(en.featured)) assert.isNotEmpty(en.featured[key], key)
  })
})

test.group('Accueil | bannière — revue 11.6', () => {
  test('ordre des titres h1 → h2 → h3 : h2 masqué nommant la région, cartes en h3', ({
    assert,
  }) => {
    assert.include(shared, '<section aria-labelledby={headingId}>')
    assert.include(shared, '<h2 id={headingId} className="sr-only">')
    assert.include(shared, 'useId()')
    assert.notInclude(shared, 'aria-label=')
    assert.include(shared, '<h3')
  })

  test('focus : contour du lien retiré seulement si :has() est pris en charge (repli)', ({
    assert,
  }) => {
    assert.notInclude(shared, 'focus-visible:outline-none')
    assert.match(
      css,
      /@supports selector\(:has\(\*\)\) \{\s*\[data-featured-link\]:focus-visible \{\s*outline: none;/
    )
    assert.include(shared, 'has-[[data-featured-link]:focus-visible]:outline-ring')
  })
})
