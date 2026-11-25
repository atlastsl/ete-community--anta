import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/ProductionCard.tsx'),
  'utf-8'
)

test.group('ProductionCard | source analysis', () => {
  test('supporte les variantes grid et list', ({ assert }) => {
    assert.include(source, "variant?: 'grid' | 'list'")
    assert.include(source, "variant === 'list'")
  })

  test('affiche les champs FR16 (titre, auteurs, catégorie, résumé, compteurs)', ({ assert }) => {
    assert.include(source, 'title')
    assert.include(source, 'production_card.by') // auteurs
    assert.include(source, 'category')
    assert.include(source, 'summary')
    assert.include(source, 'production_card.views')
    assert.include(source, 'production_card.downloads')
  })

  test('résumé tronqué (line-clamp)', ({ assert }) => {
    assert.include(source, 'line-clamp-2') // variante list
    assert.include(source, 'line-clamp-3') // variante grid
  })

  test('titre lié à la page détail', ({ assert }) => {
    assert.include(source, '/productions/')
    assert.include(source, 'font-display')
  })

  test('compteurs : libellé complet en sr-only, jamais aria-label sur un span (Story 13.1)', ({
    assert,
  }) => {
    // axe `aria-prohibited-attr` : aria-label sur un élément générique est ignoré des AT.
    assert.notInclude(source, "aria-label={t('production_card.views'")
    assert.notInclude(source, "aria-label={t('production_card.downloads'")
    assert.include(source, '<span className="sr-only">{t(\'production_card.views\'')
    assert.include(source, '<span aria-hidden="true">{viewsCount}</span>')
  })
})
