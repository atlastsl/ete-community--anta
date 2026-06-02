import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const adminAuthLayoutSource = readFileSync(
  resolve(process.cwd(), 'inertia/layouts/AdminAuthLayout.tsx'),
  'utf-8'
)

test.group('AdminAuthLayout | structure', () => {
  test('injecte <meta robots noindex,nofollow> via <Head> (FR37)', ({ assert }) => {
    assert.match(
      adminAuthLayoutSource,
      /<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']\s*\/?>/,
      'doit injecter la meta robots noindex,nofollow'
    )
    assert.match(
      adminAuthLayoutSource,
      /import\s*\{[^}]*\bHead\b[^}]*\}\s*from\s*['"]@inertiajs\/react['"]/,
      'doit importer Head depuis @inertiajs/react'
    )
  })

  test('affiche les flash messages via Sonner Toaster', ({ assert }) => {
    assert.include(adminAuthLayoutSource, "from 'sonner'", 'doit importer sonner')
    assert.include(adminAuthLayoutSource, 'toast.success', 'doit déclencher un toast success')
    assert.include(adminAuthLayoutSource, '<Toaster', 'doit rendre le composant Toaster')
  })
})

test.group('PublicLayout | absence de noindex (anti-régression)', () => {
  const publicLayoutSource = readFileSync(
    resolve(process.cwd(), 'inertia/layouts/PublicLayout.tsx'),
    'utf-8'
  )

  test('ne contient PAS de meta robots noindex (pages publiques indexables)', ({ assert }) => {
    assert.notMatch(
      publicLayoutSource,
      /name=["']robots["']\s+content=["']noindex/,
      'PublicLayout ne doit JAMAIS contenir noindex — les pages publiques doivent rester indexables'
    )
  })
})
