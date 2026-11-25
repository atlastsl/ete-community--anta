import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import SitemapService, {
  absoluteUrl,
  escapeXml,
  truncate,
  w3cDate,
} from '#services/sitemap_service'

// Story 13.3 — rendu du plan du site et de robots.txt, sans base de données.

test.group('SitemapService | helpers', () => {
  test('escapeXml échappe les cinq caractères spéciaux', ({ assert }) => {
    assert.equal(escapeXml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f')
    assert.equal(escapeXml('&amp;'), '&amp;amp;')
  })

  test('w3cDate : UTC à la seconde, suffixe Z ; null si absente ou invalide', ({ assert }) => {
    const date = DateTime.fromISO('2026-11-25T11:30:45.123+01:00', { setZone: true })
    assert.equal(w3cDate(date), '2026-11-25T10:30:45Z')
    assert.isNull(w3cDate(null))
    assert.isNull(w3cDate(DateTime.invalid('test')))
  })

  test('absoluteUrl retire les barres obliques finales de APP_URL', ({ assert }) => {
    assert.equal(absoluteUrl('https://anta.example/', '/authors'), 'https://anta.example/authors')
    assert.equal(absoluteUrl(' https://anta.example// ', '/'), 'https://anta.example/')
  })
})

test.group('SitemapService | truncate (limite de 50 000 URL)', () => {
  test('garde les premières entrées dans l’ordre et signale la troncature', ({ assert }) => {
    const entries = ['/', '/productions', '/authors', '/productions/a', '/authors/b']
    assert.deepEqual(truncate(entries, 4), {
      entries: ['/', '/productions', '/authors', '/productions/a'],
      truncated: true,
    })
    assert.deepEqual(truncate(entries, 5), { entries, truncated: false })
    assert.deepEqual(truncate(entries, 50_000), { entries, truncated: false })
  })

  test('limite nulle, négative ou fractionnaire', ({ assert }) => {
    assert.deepEqual(truncate(['a', 'b'], 0), { entries: [], truncated: true })
    assert.deepEqual(truncate(['a', 'b'], -3), { entries: [], truncated: true })
    assert.deepEqual(truncate(['a', 'b'], 1.9), { entries: ['a'], truncated: true })
    assert.deepEqual(truncate([], 0), { entries: [], truncated: false })
  })
})

test.group('SitemapService | render', () => {
  test('urlset 0.9, loc échappée, lastmod présente seulement si connue', ({ assert }) => {
    const xml = SitemapService.render([
      { loc: 'https://anta.example/?a=1&b=2', lastmod: DateTime.fromISO('2026-01-02T03:04:05Z') },
      { loc: 'https://anta.example/authors', lastmod: null },
    ])
    assert.isTrue(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'))
    assert.include(xml, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    assert.include(
      xml,
      '<url>\n    <loc>https://anta.example/?a=1&amp;b=2</loc>\n    <lastmod>2026-01-02T03:04:05Z</lastmod>\n  </url>'
    )
    assert.include(xml, '<url>\n    <loc>https://anta.example/authors</loc>\n  </url>')
    assert.equal(xml.match(/<lastmod>/g)?.length, 1)
    assert.isTrue(xml.trimEnd().endsWith('</urlset>'))
  })

  test('liste vide : urlset vide et bien formé', ({ assert }) => {
    assert.equal(
      SitemapService.render([]),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n'
    )
  })
})

test.group('SitemapService | robots', () => {
  test('exclut /admin/ et déclare le plan du site en URL absolue', ({ assert }) => {
    const body = SitemapService.robots('https://anta.example/')
    assert.include(body, 'User-agent: *\nDisallow: /admin/')
    assert.include(body, 'Allow: /')
    assert.include(body, '\nSitemap: https://anta.example/sitemap.xml\n')
    assert.notInclude(body, 'Disallow: /\n')
  })

  test('disallowAll (staging) : tout le site exclu, aucune ligne Sitemap', ({ assert }) => {
    const body = SitemapService.robots('https://anta.example/', { disallowAll: true })
    assert.include(body, 'User-agent: *\nDisallow: /\n')
    assert.notInclude(body, 'Sitemap:')
    assert.notInclude(body, 'Allow: /')
    assert.equal(
      SitemapService.robots('https://anta.example', { disallowAll: false }),
      SitemapService.robots('https://anta.example')
    )
  })
})
