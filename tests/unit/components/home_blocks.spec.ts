import { test } from '@japa/runner'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 12.2 — blocs de l'accueil, testés par lecture de source (TS6305).
// A missing file reads as '' (failed assertions rather than a runner stuck on a load error).
const read = (path: string) => {
  const file = resolve(process.cwd(), path)
  return existsSync(file) ? readFileSync(file, 'utf-8') : ''
}
const home = read('inertia/pages/home.tsx')
const block = read('inertia/components/public/HomeBlock.tsx')
const fr = JSON.parse(read('inertia/locales/public/fr.json'))
const en = JSON.parse(read('inertia/locales/public/en.json'))

test.group('HomeBlock | composant (12.2)', () => {
  test('bloc vide absent, titre compris (FR46, D5)', ({ assert }) => {
    assert.match(block, /if \(items\.length === 0\) return null/)
  })

  test('titre h2 relié à la section, sous-titre des blocs classés (D4)', ({ assert }) => {
    assert.include(block, 'useId()')
    assert.include(block, '<section className="mt-12" aria-labelledby={headingId}>')
    assert.include(block, '<h2 id={headingId} className="text-2xl text-stone-900">')
    assert.include(
      block,
      '{windowed && <p className="mt-1 text-sm text-stone-500">{t(\'home.blocks.window\')}</p>}'
    )
  })

  test('« Voir plus » : lien, nom accessible complet, cible ≥ 44 px (D28)', ({ assert }) => {
    assert.include(block, '<Link')
    assert.include(block, 'href={seeMoreHref}')
    // Visible text hidden from the accessible name, which comes whole from i18n (no literal
    // « : » suffix in the component).
    assert.include(block, "<span aria-hidden>{t('home.blocks.see_more')}</span>")
    assert.include(
      block,
      `<span className="sr-only">{t('home.blocks.see_more_named', { title })}</span>`
    )
    assert.notInclude(block, '> : {title}')
    assert.include(block, 'min-h-11')
    assert.include(block, '<ArrowRight className="size-4 shrink-0" aria-hidden />')
    // Always rendered, even with 1–2 items (D5): no condition on the count around the link.
    assert.notMatch(block, /items\.length\s*<\s*3/)
  })

  test('grille 3 colonnes dès md, 1 colonne en dessous (D2, D35)', ({ assert }) => {
    assert.include(block, 'grid grid-cols-1 gap-5 md:grid-cols-3')
  })
})

test.group('Accueil | blocs (12.2)', () => {
  test('props recent, mostViewed, mostDownloaded ; plus de Section', ({ assert }) => {
    assert.include(home, 'recent: ProductionCardData[]')
    assert.include(home, 'mostViewed: ProductionCardData[]')
    assert.include(home, 'mostDownloaded: ProductionCardData[]')
    assert.notInclude(home, 'function Section')
    assert.notInclude(home, 'home.sections')
    assert.notInclude(home, "t('home.empty')")
  })

  test('ordre FR9 sous la bannière, liens D28, sous-titre sur les blocs classés', ({ assert }) => {
    const banner = home.indexOf('<FeaturedBanner')
    const recent = home.indexOf("title={t('home.blocks.recent')}")
    const viewed = home.indexOf("title={t('home.blocks.most_viewed')}")
    const downloaded = home.indexOf("title={t('home.blocks.most_downloaded')}")
    assert.isTrue(banner < recent && recent < viewed && viewed < downloaded)
    assert.include(home, 'seeMoreHref="/productions?sort=date"')
    assert.include(home, 'seeMoreHref="/productions?sort=views"')
    assert.include(home, 'seeMoreHref="/productions?sort=downloads"')
    // `windowed` on the two ranked blocks only.
    assert.lengthOf(home.match(/\bwindowed\b/g) ?? [], 2)
    assert.notInclude(home.slice(recent, viewed), 'windowed')
  })

  test('cartes identiques au listing (ProductionCard, sans image, D37)', ({ assert }) => {
    assert.include(home, '<ProductionCard production={production} />')
    assert.notInclude(home, 'imageUrl')
  })

  test('i18n FR/EN home.blocks.* ; anciennes clés retirées (D-12.2-9)', ({ assert }) => {
    assert.deepEqual(fr.home.blocks, {
      recent: 'Récemment publiées',
      most_viewed: 'Les plus consultées',
      most_downloaded: 'Les plus téléchargées',
      window: 'sur les 12 derniers mois',
      see_more: 'Voir plus',
      see_more_named: 'Voir plus : {{title}}',
    })
    assert.deepEqual(en.home.blocks, {
      recent: 'Recently published',
      most_viewed: 'Most viewed',
      most_downloaded: 'Most downloaded',
      window: 'over the last 12 months',
      see_more: 'See more',
      see_more_named: 'See more: {{title}}',
    })
    for (const locale of [fr, en]) {
      assert.notProperty(locale.home, 'sections')
      assert.notProperty(locale.home, 'empty')
    }
  })
})
