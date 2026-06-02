import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Garde-fou du câblage des deux entry points Inertia (régression historique) :
 * les pages `/admin/*` DOIVENT charger `inertia/admin.tsx` (adminI18n) via
 * `admin_layout.edge`, sinon elles tombent sur `app.tsx`/publicI18n et les clés
 * i18n admin (locales/admin/*) ne sont jamais chargées → clés brutes dans le panel.
 */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

test.group('Admin entry wiring', () => {
  test('admin_layout.edge charge inertia/admin.tsx', ({ assert }) => {
    const edge = read('resources/views/admin_layout.edge')
    assert.include(edge, "@vite(['inertia/admin.tsx'])")
    assert.include(edge, 'noindex')
  })

  test('config/inertia.ts route /admin vers admin_layout', ({ assert }) => {
    const config = read('config/inertia.ts')
    assert.include(config, 'rootView')
    assert.include(config, "startsWith('/admin')")
    assert.include(config, 'admin_layout')
    assert.include(config, 'inertia_layout')
  })

  test('admin.tsx utilise adminI18n et ne double pas le préfixe admin/', ({ assert }) => {
    const adminEntry = read('inertia/admin.tsx')
    assert.include(adminEntry, 'adminI18n')
    assert.include(adminEntry, '`./pages/${name}.tsx`')
    assert.notInclude(adminEntry, '`./pages/admin/${name}.tsx`')
  })

  test('inertia_layout.edge (public) charge toujours inertia/app.tsx', ({ assert }) => {
    const edge = read('resources/views/inertia_layout.edge')
    assert.include(edge, "@vite(['inertia/app.tsx'])")
  })
})
