import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 7.1 — ProductionStats (composant admin, `ssr: false` + frontière TS6305) :
 * vérification par lecture de SOURCE.
 */
const src = readFileSync(
  resolve(process.cwd(), 'inertia/components/admin/ProductionStats.tsx'),
  'utf-8'
)

test.group('ProductionStats | source', () => {
  test('état vide factuel quand aucune stat', ({ assert }) => {
    assert.include(src, 'productions.stats.empty')
    assert.include(src, 'stats.totalViews === 0 && stats.totalDownloads === 0')
  })

  test('4 indicateurs (vues, téléchargements, dates)', ({ assert }) => {
    assert.include(src, 'productions.stats.views')
    assert.include(src, 'productions.stats.downloads')
    assert.include(src, 'productions.stats.first_published')
    assert.include(src, 'productions.stats.last_modified')
  })

  test('graphique 30j + table accessible (sr-only)', ({ assert }) => {
    assert.include(src, 'productions.stats.evolution_30d')
    assert.include(src, 'viewsByDay.map')
    assert.include(src, 'sr-only')
    assert.include(src, '<table')
  })
})
