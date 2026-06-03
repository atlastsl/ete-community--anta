import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 7.3 — page logs d'activité (composant client, `ssr: false` + TS6305) :
 * vérification par lecture de SOURCE.
 */
const src = readFileSync(
  resolve(process.cwd(), 'inertia/pages/admin/ActivityLogs/Index.tsx'),
  'utf-8'
)

test.group('Activity logs page | source', () => {
  test('filtres admin + type d’action', ({ assert }) => {
    assert.include(src, 'activity.filter_admin')
    assert.include(src, 'activity.filter_action')
    assert.include(src, "selectValue(v, 'adminId')")
    assert.include(src, "selectValue(v, 'actionType')")
  })

  test('table (colonnes) + état vide + pagination', ({ assert }) => {
    assert.include(src, 'activity.col_admin')
    assert.include(src, 'activity.col_action')
    assert.include(src, 'activity.col_resource')
    assert.include(src, 'activity.col_date')
    assert.include(src, 'activity.empty')
    assert.include(src, 'Pagination')
  })

  test('libellés des types d’action via i18n', ({ assert }) => {
    assert.include(src, 'activity.action.${')
  })
})
