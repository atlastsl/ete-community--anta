import { test } from '@japa/runner'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const r = (p: string) => resolve(process.cwd(), p)

test.group('Design system | assets', () => {
  test('logo principal présent dans public/images/', ({ assert }) => {
    assert.isTrue(existsSync(r('public/images/logo_anta.png')))
    assert.isAbove(statSync(r('public/images/logo_anta.png')).size, 0)
  })

  test('favicon présent à la racine de public/', ({ assert }) => {
    assert.isTrue(existsSync(r('public/favicon.png')))
    assert.isAbove(statSync(r('public/favicon.png')).size, 0)
  })
})

test.group('Design system | Tailwind v4 CSS', () => {
  const css = readFileSync(r('inertia/css/app.css'), 'utf-8')

  test('app.css importe Tailwind v4 via @import', ({ assert }) => {
    assert.include(css, '@import "tailwindcss"')
  })

  test('app.css définit le bloc @theme avec les 4 tokens Anta', ({ assert }) => {
    assert.include(css, '@theme')
    assert.include(css, '--color-primary')
    assert.include(css, '--color-accent')
    assert.include(css, '--color-background')
    assert.include(css, '--color-text-secondary')
  })

  test('app.css applique Playfair Display à h1/h2 et Inter au body', ({ assert }) => {
    assert.include(css, 'Playfair Display')
    assert.include(css, 'Inter')
    assert.include(css, '@layer base')
  })

  test('app.css documente l’accessibilité (WCAG) et applique un focus visible', ({ assert }) => {
    assert.include(css, 'WCAG')
    assert.include(css, ':focus-visible')
  })
})

test.group('Design system | shadcn/ui', () => {
  test('cn() helper exporté depuis lib/utils', async ({ assert }) => {
    const mod = await import('../../../inertia/lib/utils.js')
    assert.isFunction(mod.cn)
    assert.equal(mod.cn('a', 'b'), 'a b')
    // tailwind-merge dédupique les classes conflictuelles
    assert.equal(mod.cn('p-2', 'p-4'), 'p-4')
  })

  test('components.json existe et est configuré pour Tailwind v4', ({ assert }) => {
    const config = JSON.parse(readFileSync(r('components.json'), 'utf-8'))
    assert.equal(config.tailwind.config, '', 'Tailwind v4 = config CSS, pas de fichier JS')
    assert.equal(config.tailwind.css, 'inertia/css/app.css')
    assert.equal(config.aliases.utils, '~/lib/utils')
    assert.equal(config.aliases.ui, '~/components/ui')
  })

  test('5 composants shadcn générés dans inertia/components/ui/', ({ assert }) => {
    for (const name of ['button', 'input', 'select', 'dialog', 'badge']) {
      assert.isTrue(
        existsSync(r(`inertia/components/ui/${name}.tsx`)),
        `composant ${name}.tsx manquant`
      )
    }
  })
})

test.group('Design system | Edge layout', () => {
  const edge = readFileSync(r('resources/views/inertia_layout.edge'), 'utf-8')

  test('html a un attribut lang dynamique avec fallback fr (SEO Story 5.5)', ({ assert }) => {
    assert.include(edge, '<html lang="{{')
    assert.include(edge, "'fr'")
  })

  test('favicon référencé', ({ assert }) => {
    assert.include(edge, '/favicon.png')
  })

  test('Google Fonts avec display=swap et preconnect', ({ assert }) => {
    assert.include(edge, 'fonts.googleapis.com')
    assert.include(edge, 'fonts.gstatic.com')
    assert.include(edge, 'display=swap')
    assert.include(edge, 'Inter')
    assert.include(edge, 'Playfair+Display')
    assert.include(edge, 'rel="preconnect"')
  })
})

test.group('Design system | layouts React', () => {
  test('PublicLayout.tsx existe et référence le logo h-10', ({ assert }) => {
    const content = readFileSync(r('inertia/layouts/PublicLayout.tsx'), 'utf-8')
    assert.include(content, '/images/logo_anta.png')
    assert.include(content, 'h-10')
  })

  test('AdminLayout.tsx existe et référence le logo h-8', ({ assert }) => {
    const content = readFileSync(r('inertia/layouts/AdminLayout.tsx'), 'utf-8')
    assert.include(content, '/images/logo_anta.png')
    assert.include(content, 'h-8')
  })

  test('legacy default.tsx supprimé', ({ assert }) => {
    assert.isFalse(existsSync(r('inertia/layouts/default.tsx')))
  })
})
