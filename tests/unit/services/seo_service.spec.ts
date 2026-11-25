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

test.group('SeoService | authorsList', () => {
  test('titre « Auteurs — Anta », description = introduction de la liste, website', ({
    assert,
  }) => {
    const fr = SeoService.authorsList('fr')
    assert.equal(fr.title, 'Auteurs — Anta')
    assert.equal(fr.ogTitle, fr.title)
    assert.equal(fr.description, 'Les auteurs des productions publiées sur Anta.')
    assert.equal(fr.ogType, 'website')
    assert.equal(fr.locale, 'fr')
    const en = SeoService.authorsList('en')
    assert.equal(en.title, 'Authors — Anta')
    assert.equal(en.description, 'The authors of the productions published on Anta.')
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

// Story 10.1 — titres dédiés de la politique de confidentialité et de la NotFoundPage.
test.group('SeoService | privacy', () => {
  test('titre traduit FR / EN', ({ assert }) => {
    assert.equal(SeoService.privacy('fr').title, 'Politique de confidentialité — Anta')
    assert.equal(SeoService.privacy('en').title, 'Privacy policy — Anta')
    assert.equal(SeoService.privacy('en').ogTitle, 'Privacy policy — Anta')
    assert.equal(SeoService.privacy('en').locale, 'en')
    assert.equal(SeoService.privacy('fr').ogType, 'website')
  })
})

test.group('SeoService | notFound', () => {
  test('titre traduit FR / EN', ({ assert }) => {
    assert.equal(SeoService.notFound('fr').title, 'Page introuvable — Anta')
    assert.equal(SeoService.notFound('en').title, 'Page not found — Anta')
    assert.equal(SeoService.notFound('en').locale, 'en')
    assert.equal(
      SeoService.notFound('fr').description,
      "Cette page n'existe pas ou n'est plus disponible."
    )
    assert.equal(
      SeoService.notFound('en').description,
      'This page does not exist or is no longer available.'
    )
  })
})

// Story 10.3 — forme minimale de SeoService.forAuthor (ogImage en Story 10.7).
test.group('SeoService | forAuthor', () => {
  const author = {
    firstNames: 'Awa Marie',
    lastNames: 'Fictive',
    slug: 'awa-marie-fictive',
    primaryInstitution: 'Université Exemple',
    publishedCount: 3,
  }

  test('FR : titre « Prénom NOM — Anta », description, profile, og:url absolue', ({ assert }) => {
    const meta = SeoService.forAuthor('fr', author, 'https://anta.example.org/')
    assert.equal(meta.title, 'Awa Marie FICTIVE — Anta')
    assert.equal(meta.ogTitle, 'Awa Marie FICTIVE')
    assert.equal(meta.description, 'Université Exemple — 3 productions publiées sur Anta')
    assert.equal(meta.ogDescription, meta.description)
    assert.equal(meta.ogType, 'profile')
    assert.equal(meta.ogUrl, 'https://anta.example.org/authors/awa-marie-fictive')
    assert.equal(meta.locale, 'fr')
  })

  test('EN et singulier', ({ assert }) => {
    const meta = SeoService.forAuthor('en', { ...author, publishedCount: 1 }, null)
    assert.equal(meta.description, 'Université Exemple — 1 production published on Anta')
    assert.isUndefined(meta.ogUrl)
    assert.equal(
      SeoService.forAuthor('fr', { ...author, publishedCount: 1 }).description,
      'Université Exemple — 1 production publiée sur Anta'
    )
  })

  test('sans affiliation : affiliation omise', ({ assert }) => {
    const meta = SeoService.forAuthor('fr', { ...author, primaryInstitution: null })
    assert.equal(meta.description, '3 productions publiées sur Anta')
  })
})

// Story 10.7 — og:image des profils (variante og.jpg de la photo publique), og:url de la liste.
test.group('SeoService | forAuthor ogImage / authorsList ogUrl', () => {
  const author = {
    firstNames: 'Awa Marie',
    lastNames: 'Fictive',
    slug: 'awa-marie-fictive',
    primaryInstitution: 'Université Exemple',
    publishedCount: 3,
  }
  const photoBase = '/media/authors/0b7e1a52-6c55-4a8e-9a3e-2f1d1c0b9a77/AbCdEfGhIjKlMnOp_-12'

  test('photo publique + APP_URL → og:image absolue og.jpg (slash final toléré)', ({ assert }) => {
    for (const appUrl of ['https://anta.example.org', 'https://anta.example.org/']) {
      const meta = SeoService.forAuthor('fr', { ...author, photoBase }, appUrl)
      assert.equal(meta.ogImage, `https://anta.example.org${photoBase}/og.jpg`)
      assert.equal(meta.ogType, 'profile')
    }
  })

  test('sans photo, sans APP_URL ou base hors /media/authors/ → pas d’og:image', ({ assert }) => {
    const appUrl = 'https://anta.example.org'
    assert.isUndefined(SeoService.forAuthor('fr', author, appUrl).ogImage)
    assert.isUndefined(SeoService.forAuthor('fr', { ...author, photoBase: null }, appUrl).ogImage)
    assert.isUndefined(SeoService.forAuthor('fr', { ...author, photoBase }, null).ogImage)
    assert.isUndefined(SeoService.forAuthor('fr', { ...author, photoBase }).ogImage)
    for (const bad of ['/media/thumbnails/x/y', 'https://evil.example.org/a', '/media/authors']) {
      assert.isUndefined(
        SeoService.forAuthor('fr', { ...author, photoBase: bad }, appUrl).ogImage,
        bad
      )
    }
  })

  test('authorsList : og:url absolue /authors avec APP_URL, jamais d’og:image', ({ assert }) => {
    const fr = SeoService.authorsList('fr', 'https://anta.example.org/')
    assert.equal(fr.ogUrl, 'https://anta.example.org/authors')
    assert.isUndefined(fr.ogImage)
    assert.equal(SeoService.authorsList('en', 'https://anta.example.org').title, 'Authors — Anta')
    assert.isUndefined(SeoService.authorsList('fr').ogUrl)
    assert.isUndefined(SeoService.authorsList('fr', null).ogUrl)
  })

  test('aucune og:image hors profil (production D37, site, listing)', ({ assert }) => {
    const appUrl = 'https://anta.example.org'
    assert.isUndefined(
      SeoService.forProduction('fr', { title: 'T', slug: 't', authors: ['A B'] }, appUrl).ogImage
    )
    assert.isUndefined(SeoService.site('fr').ogImage)
    assert.isUndefined(SeoService.listing('fr', 'q').ogImage)
    assert.isUndefined(SeoService.notFound('fr').ogImage)
    assert.isUndefined(SeoService.privacy('fr').ogImage)
  })
})
