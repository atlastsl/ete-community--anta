import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 7.2 — page agrégée /admin/stats (composant client, `ssr: false` + TS6305) :
 * vérification par lecture de SOURCE.
 */
const src = readFileSync(resolve(process.cwd(), 'inertia/pages/admin/Stats/Index.tsx'), 'utf-8')

test.group('Admin Stats page | source', () => {
  test('état vide quand aucune production publiée', ({ assert }) => {
    assert.include(src, 'stats.empty')
    assert.include(src, 'stats.totalPublished === 0')
  })

  test('3 métriques globales', ({ assert }) => {
    assert.include(src, 'stats.total_published')
    assert.include(src, 'stats.total_views')
    assert.include(src, 'stats.total_downloads')
  })

  test('2 tables top-10 + évolution 30j', ({ assert }) => {
    assert.include(src, 'stats.top_viewed')
    assert.include(src, 'stats.top_downloaded')
    assert.include(src, 'stats.evolution_30d')
    assert.include(src, '/productions/${') // lien vers la page publique
  })
})
