import { test } from '@japa/runner'
import SeoService from '#services/seo_service'

test.group('SeoService | resolveLocale', () => {
  test('en → en', ({ assert }) => {
    assert.equal(SeoService.resolveLocale('en'), 'en')
  })

  test('fr / absent / invalide → fr', ({ assert }) => {
    assert.equal(SeoService.resolveLocale('fr'), 'fr')
    assert.equal(SeoService.resolveLocale(null), 'fr')
    assert.equal(SeoService.resolveLocale(undefined), 'fr')
    assert.equal(SeoService.resolveLocale('xx'), 'fr')
  })
})

test.group('SeoService | localeFromCookieHeader', () => {
  test('extrait en/fr du cookie i18n_lang', ({ assert }) => {
    assert.equal(SeoService.localeFromCookieHeader('i18n_lang=en'), 'en')
    assert.equal(SeoService.localeFromCookieHeader('i18n_lang=fr'), 'fr')
  })

  test('parmi plusieurs cookies', ({ assert }) => {
    assert.equal(SeoService.localeFromCookieHeader('XSRF-TOKEN=abc; i18n_lang=en; foo=bar'), 'en')
  })

  test('absent / vide / invalide → fr', ({ assert }) => {
    assert.equal(SeoService.localeFromCookieHeader(undefined), 'fr')
    assert.equal(SeoService.localeFromCookieHeader(''), 'fr')
    assert.equal(SeoService.localeFromCookieHeader('other=1'), 'fr')
    assert.equal(SeoService.localeFromCookieHeader('i18n_lang=de'), 'fr')
  })
})

test.group('SeoService | site', () => {
  test('meta site FR (website)', ({ assert }) => {
    const meta = SeoService.site('fr')
    assert.equal(meta.ogType, 'website')
    assert.equal(meta.locale, 'fr')
    assert.isNotEmpty(meta.title)
    assert.isNotEmpty(meta.description)
    assert.equal(meta.ogTitle, meta.title)
    assert.equal(meta.ogDescription, meta.description)
  })

  test('meta site EN diffère de FR', ({ assert }) => {
    const fr = SeoService.site('fr')
    const en = SeoService.site('en')
    assert.equal(en.locale, 'en')
    assert.notEqual(en.description, fr.description)
  })
})

test.group('SeoService | listing', () => {
  test('sans terme → titre listing générique, website', ({ assert }) => {
    const meta = SeoService.listing('fr')
    assert.equal(meta.ogType, 'website')
    assert.notInclude(meta.title, 'Recherche :')
  })

  test('avec terme → titre inclut le terme', ({ assert }) => {
    const meta = SeoService.listing('fr', 'topologie')
    assert.include(meta.title, 'topologie')
    const metaEn = SeoService.listing('en', 'topology')
    assert.include(metaEn.title, 'topology')
  })
})

test.group('SeoService | forProduction', () => {
  test('ogType article + titre/description issus de la production', ({ assert }) => {
    const meta = SeoService.forProduction('fr', {
      title: 'La Topologie Algébrique',
      summary: 'Un ouvrage de référence sur la topologie.',
      authors: ['Cheikh Anta Diop'],
    })
    assert.equal(meta.ogType, 'article')
    assert.include(meta.title, 'La Topologie Algébrique')
    assert.equal(meta.ogTitle, 'La Topologie Algébrique')
    assert.include(meta.description, 'Cheikh Anta Diop')
    assert.include(meta.description, 'topologie')
  })

  test('résumé long tronqué à ~160 caractères', ({ assert }) => {
    const meta = SeoService.forProduction('fr', {
      title: 'T',
      summary: 'x'.repeat(300),
      authors: [],
    })
    assert.isBelow(meta.description.length, 200)
  })

  test('sans résumé ni auteur → description de repli', ({ assert }) => {
    const meta = SeoService.forProduction('en', { title: 'T', summary: null, authors: [] })
    assert.isNotEmpty(meta.description)
    assert.equal(meta.locale, 'en')
  })

  test('avec slug + APP_URL → ogUrl canonique', ({ assert }) => {
    const meta = SeoService.forProduction(
      'fr',
      { title: 'Mon article', slug: 'mon-article' },
      'https://anta.example.com/'
    )
    assert.equal(meta.ogUrl, 'https://anta.example.com/productions/mon-article')
  })
})
