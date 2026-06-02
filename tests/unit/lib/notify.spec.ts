import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Le code `inertia/` n'appartient pas au build serveur (projet TS séparé,
 * piloté par Vite). Comme les autres tests touchant l'UI (admin_layout.spec,
 * translations.spec), on vérifie la SOURCE via fs plutôt que d'importer le
 * module (l'import cross-projet casse le typecheck — TS6305 — et sonner est
 * une dépendance DOM). La logique étant un mapping pur de constantes, la
 * vérification de source est fiable. Le rendu visuel relève de la suite browser.
 */
const notifyOptionsSource = readFileSync(
  resolve(process.cwd(), 'inertia/lib/notify_options.ts'),
  'utf-8'
)
const notifySource = readFileSync(resolve(process.cwd(), 'inertia/lib/notify.ts'), 'utf-8')
const adminLayoutSource = readFileSync(
  resolve(process.cwd(), 'inertia/layouts/AdminLayout.tsx'),
  'utf-8'
)

test.group('notify | options (UX-DR13)', () => {
  test('error → persistant (durée infinie) + bouton fermer', ({ assert }) => {
    // La branche error retourne Infinity + closeButton: true
    assert.match(
      notifyOptionsSource,
      /type\s*===\s*['"]error['"][\s\S]*?Number\.POSITIVE_INFINITY[\s\S]*?closeButton:\s*true/,
      'error doit être persistant (Infinity) avec closeButton: true'
    )
  })

  test('success / info → durée 3000 ms', ({ assert }) => {
    assert.match(
      notifyOptionsSource,
      /return\s*\{\s*duration:\s*3000\s*\}/,
      'success/info doivent durer 3000 ms'
    )
  })

  test('notify expose success / error / info au-dessus de sonner', ({ assert }) => {
    assert.match(notifySource, /from\s*['"]sonner['"]/)
    assert.match(notifySource, /toastOptionsFor/, 'doit réutiliser toastOptionsFor')
    assert.match(notifySource, /success:\s*\(message: string\)\s*=>/)
    assert.match(notifySource, /error:\s*\(message: string\)\s*=>/)
    assert.match(notifySource, /info:\s*\(message: string\)\s*=>/)
  })
})

test.group('notify | Toaster config (UX-DR13 / UX-DR20)', () => {
  test('Toaster positionné en bas à droite', ({ assert }) => {
    assert.match(
      adminLayoutSource,
      /position=["']bottom-right["']/,
      'position bottom-right requise'
    )
  })

  test('Toaster limite à 3 toasts simultanés', ({ assert }) => {
    assert.match(adminLayoutSource, /visibleToasts=\{3\}/, 'max 3 toasts simultanés')
  })

  test('Toaster expose un bouton de fermeture (closeButton)', ({ assert }) => {
    assert.match(adminLayoutSource, /<Toaster[^>]*\bcloseButton\b/, 'closeButton requis')
  })

  test('AdminLayout route les flash via le helper notify', ({ assert }) => {
    assert.match(adminLayoutSource, /notify\.success\(/, 'flash.success → notify.success')
    assert.match(adminLayoutSource, /notify\.error\(/, 'flash.error → notify.error')
  })
})
