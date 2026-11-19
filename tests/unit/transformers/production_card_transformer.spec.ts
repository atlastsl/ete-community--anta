import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Production from '#models/production'
import ProductionCardTransformer from '#transformers/production_card_transformer'

// Story 10.3 — transformer unique des cartes (accueil, listing, profil) ; props inchangées.
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
    p.antaPublishedAt = DateTime.fromISO('2026-01-02T03:04:05.000Z', { zone: 'utc' })
    p.$extras = { viewsCount: '4', downloadsCount: 2 }
    return p
  }

  test('forme exacte des cartes', ({ assert }) => {
    assert.deepEqual(new ProductionCardTransformer(production()).toObject(), {
      id: '7c6f1d3e-3f7a-4c55-9a51-0d2a3b4c5d6e',
      slug: 'oeuvre-test',
      title: 'Oeuvre test',
      authors: ['Jeanne Exemple', 'Paul Fictif'],
      category: 'Livre',
      domain: 'Informatique',
      summary: 'Résumé.',
      viewsCount: 4,
      downloadsCount: 2,
      publishedAt: '2026-01-02T03:04:05.000Z',
    })
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
})
