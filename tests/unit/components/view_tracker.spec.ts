import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 6.4 — ViewTracker (composant client, `ssr: false` + frontière TS6305) :
 * vérification par lecture de SOURCE (pattern Node-pur du repo).
 */
const viewTracker = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/ViewTracker.tsx'),
  'utf-8'
)

test.group('ViewTracker | beacon de vue', () => {
  test('timer de 10s qui POST /stats/view', ({ assert }) => {
    assert.include(viewTracker, 'setTimeout')
    assert.include(viewTracker, '10_000')
    assert.include(viewTracker, "'/stats/view'")
    assert.include(viewTracker, "method: 'POST'")
    assert.include(viewTracker, 'productionId')
  })

  test('nettoyage du timer au démontage (clearTimeout)', ({ assert }) => {
    assert.include(viewTracker, 'clearTimeout')
    assert.include(viewTracker, 'return () =>')
  })

  test('échec silencieux + incrément optimiste', ({ assert }) => {
    assert.include(viewTracker, '.catch(')
    assert.include(viewTracker, 'onRecorded')
  })
})
