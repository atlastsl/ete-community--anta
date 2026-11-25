import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Production from '#models/production'
import ProductionCardTransformer from '#transformers/production_card_transformer'

// Story 10.3 — transformer unique des cartes (accueil, listing, profil).
// Story 10.4 — `authors` : `{ name, slug | null }[]` calculés par `PublicBylineService` ($extras.byline).
test.group('ProductionCardTransformer', () => {
  function production() {
    const p = new Production()
    p.id = '7c6f1d3e-3f7a-4c55-9a51-0d2a3b4c5d6e'
    p.slug = 'oeuvre-test'
    p.title = 'Oeuvre test'
    p.authorNames = ['Jeanne Exemple', 'Paul Fictif']
    p.category = 'Livre'
    p.domain = 'Informatique'
    p.summary = 'Résumé.'
    p.language = 'en'
    p.antaPublishedAt = DateTime.fromISO('2026-01-02T03:04:05.000Z', { zone: 'utc' })
    p.$extras = {
      viewsCount: '4',
      downloadsCount: 2,
      byline: [
        { name: 'Jeanne EXEMPLE', slug: 'jeanne-exemple' },
        { name: 'Paul Fictif', slug: null },
      ],
    }
    return p
  }

  test('forme exacte des cartes', ({ assert }) => {
    assert.deepEqual(new ProductionCardTransformer(production()).toObject(), {
      id: '7c6f1d3e-3f7a-4c55-9a51-0d2a3b4c5d6e',
      slug: 'oeuvre-test',
      title: 'Oeuvre test',
      authors: [
        { name: 'Jeanne EXEMPLE', slug: 'jeanne-exemple' },
        { name: 'Paul Fictif', slug: null },
      ],
      category: 'Livre',
      domain: 'Informatique',
      summary: 'Résumé.',
      // Story 13.2: `lang` of the title / summary when it differs from the UI.
      language: 'en',
      viewsCount: 4,
      downloadsCount: 2,
      publishedAt: '2026-01-02T03:04:05.000Z',
    })
  })

  test('vignette posée : forme exacte inchangée, aucune image (11.2, D37)', ({ assert }) => {
    const p = production()
    p.thumbnailKey = `thumbnails/${p.id}/AbCdEfGhIjKlMnOp_-12`
    const card = new ProductionCardTransformer(p).toObject()
    assert.deepEqual(Object.keys(card).sort(), [
      'authors',
      'category',
      'domain',
      'downloadsCount',
      'id',
      'language',
      'publishedAt',
      'slug',
      'summary',
      'title',
      'viewsCount',
    ])
    assert.notInclude(JSON.stringify(card), 'thumbnails/')
  })

  test('agrégats absents → 0 ; date et auteurs absents', ({ assert }) => {
    const p = production()
    p.$extras = {}
    p.antaPublishedAt = null
    ;(p as any).authorNames = null
    const card = new ProductionCardTransformer(p).toObject()
    assert.equal(card.viewsCount, 0)
    assert.equal(card.downloadsCount, 0)
    assert.isNull(card.publishedAt)
    assert.deepEqual(card.authors, [])
  })

  test('byline non calculée → noms jsonb sans lien (jamais de slug)', ({ assert }) => {
    const p = production()
    p.$extras = {}
    p.authorNames = ['Jeanne Exemple', ' ', 'Paul Fictif']
    assert.deepEqual(new ProductionCardTransformer(p).toObject().authors, [
      { name: 'Jeanne Exemple', slug: null },
      { name: 'Paul Fictif', slug: null },
    ])
  })
})
