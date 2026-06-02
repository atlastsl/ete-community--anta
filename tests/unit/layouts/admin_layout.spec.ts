import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const adminLayoutSource = readFileSync(
  resolve(process.cwd(), 'inertia/layouts/AdminLayout.tsx'),
  'utf-8'
)

test.group('AdminLayout | structure', () => {
  test("rend conditionnellement l'entrée Utilisateurs uniquement pour super_admin", ({
    assert,
  }) => {
    assert.match(
      adminLayoutSource,
      /superAdminOnly:\s*true/,
      "l'item Users doit être marqué superAdminOnly: true"
    )
    assert.match(
      adminLayoutSource,
      /isSuperAdmin\s*=\s*user\?.role\s*===\s*'super_admin'/,
      "doit calculer isSuperAdmin depuis le rôle de l'utilisateur"
    )
    assert.match(
      adminLayoutSource,
      /!item\.superAdminOnly\s*\|\|\s*isSuperAdmin/,
      'doit filtrer les items selon superAdminOnly et le rôle'
    )
  })

  test("affiche un message d'avertissement sur mobile (< lg)", ({ assert }) => {
    assert.include(adminLayoutSource, 'lg:hidden', 'doit avoir un bloc lg:hidden pour mobile')
    assert.include(
      adminLayoutSource,
      'hidden lg:flex',
      'doit avoir un bloc hidden lg:flex pour desktop'
    )
    assert.include(
      adminLayoutSource,
      "t('layout.mobile_warning')",
      'doit utiliser la clé i18n layout.mobile_warning'
    )
  })

  test('utilise le composant Badge shadcn pour le rôle', ({ assert }) => {
    assert.include(
      adminLayoutSource,
      "from '~/components/ui/badge'",
      'doit importer Badge depuis shadcn'
    )
    assert.include(adminLayoutSource, "t('role.admin')", 'doit utiliser la clé i18n role.admin')
    assert.include(
      adminLayoutSource,
      "t('role.super_admin')",
      'doit utiliser la clé i18n role.super_admin'
    )
  })

  test("détecte l'item actif via url.startsWith(href)", ({ assert }) => {
    assert.match(
      adminLayoutSource,
      /url\.startsWith\(item\.href\)/,
      "doit détecter l'item actif par préfixe URL"
    )
    assert.include(adminLayoutSource, 'bg-green-100', 'classe de fond active')
    assert.include(adminLayoutSource, 'text-green-700', 'classe de texte active')
    assert.include(adminLayoutSource, 'border-green-700', 'classe de bordure active')
  })

  test('utilise une déconnexion POST sécurisée (Inertia)', ({ assert }) => {
    assert.match(
      adminLayoutSource,
      /method=["']post["']/,
      'doit utiliser method="post" pour le logout'
    )
    assert.include(adminLayoutSource, '/admin/logout', 'doit cibler /admin/logout')
  })

  test("injecte <meta robots noindex,nofollow> via <Head> pour exclure de l'indexation (FR37)", ({
    assert,
  }) => {
    assert.match(
      adminLayoutSource,
      /<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']\s*\/?>/,
      'doit injecter la meta robots noindex,nofollow'
    )
    assert.match(
      adminLayoutSource,
      /import\s*\{[^}]*\bHead\b[^}]*\}\s*from\s*['"]@inertiajs\/react['"]/,
      'doit importer Head depuis @inertiajs/react'
    )
  })
})
