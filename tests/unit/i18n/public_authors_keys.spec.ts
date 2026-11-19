import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 10.8 — parité i18n consolidée de l'Epic 10 : chaque clé littérale `t('…')` des fichiers
// publics de l'epic existe en FR et en EN dans les locales publiques ; les composants partagés
// aussi rendus par le bundle admin (Avatar, Pagination, NotFoundPage d'une URL /admin/*)
// trouvent également leurs clés dans les locales admin. Les specs de composants 10.x vérifient
// leurs propres fichiers ; celle-ci couvre l'ensemble, y compris Pagination, la 404 et le layout.

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

const locales = {
  public: {
    fr: JSON.parse(read('inertia/locales/public/fr.json')),
    en: JSON.parse(read('inertia/locales/public/en.json')),
  },
  admin: {
    fr: JSON.parse(read('inertia/locales/admin/fr.json')),
    en: JSON.parse(read('inertia/locales/admin/en.json')),
  },
}

/** Public files of Epic 10 (pages, components, layout). */
const PUBLIC_FILES = [
  'inertia/pages/author.tsx',
  'inertia/pages/authors.tsx',
  'inertia/pages/privacy-policy.tsx',
  'inertia/pages/errors/not_found.tsx',
  'inertia/layouts/PublicLayout.tsx',
  'inertia/components/public/AuthorByline.tsx',
  'inertia/components/public/AuthorCard.tsx',
  'inertia/components/public/AuthorFilters.tsx',
  'inertia/components/public/AuthorProfileHeader.tsx',
  'inertia/components/shared/Avatar.tsx',
  'inertia/components/shared/SortSelect.tsx',
  'inertia/components/shared/Pagination.tsx',
]

/** Shared files also rendered by the admin bundle (`inertia/admin.tsx`). */
const ADMIN_RENDERED_FILES = [
  'inertia/pages/errors/not_found.tsx',
  'inertia/components/shared/Avatar.tsx',
  'inertia/components/shared/Pagination.tsx',
]

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/** Literal i18n keys used through `t('…')` (dynamic template keys are out of reach). */
function usedKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*['`]([a-z_]+(?:\.[a-z_]+)+)['`]/g)].map((m) => m[1])
}

/** A key resolves to a non-empty string, directly or through its i18next plural forms. */
function resolves(dict: Record<string, any>, key: string): boolean {
  const direct = lookup(dict, key)
  if (typeof direct === 'string') return direct.trim() !== ''
  const one = lookup(dict, `${key}_one`)
  const other = lookup(dict, `${key}_other`)
  return typeof one === 'string' && typeof other === 'string' && one !== '' && other !== ''
}

test.group('i18n | clés de l’Epic 10 (Story 10.8)', () => {
  test('chaque fichier public de l’epic existe et la liste des clés est non vide', ({ assert }) => {
    const keys = PUBLIC_FILES.flatMap((file) => usedKeys(read(file)))
    assert.isAbove(new Set(keys).size, 40)
  })

  for (const file of PUBLIC_FILES) {
    test(`${file} : clés présentes en FR et EN (locales publiques)`, ({ assert }) => {
      for (const key of usedKeys(read(file))) {
        for (const [lang, dict] of Object.entries(locales.public)) {
          assert.isTrue(resolves(dict, key), `public/${lang}.json : ${key} (${file})`)
        }
      }
    })
  }

  for (const file of ADMIN_RENDERED_FILES) {
    test(`${file} : clés aussi présentes dans les locales admin`, ({ assert }) => {
      for (const key of usedKeys(read(file))) {
        for (const [lang, dict] of Object.entries(locales.admin)) {
          assert.isTrue(resolves(dict, key), `admin/${lang}.json : ${key} (${file})`)
        }
      }
    })
  }

  test('formes plurielles : _one et _other présentes ensemble, en FR comme en EN', ({ assert }) => {
    const plurals = (dict: Record<string, any>, prefix = ''): string[] =>
      Object.entries(dict).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? plurals(value, `${prefix}${key}.`)
          : /_(one|other)$/.test(key)
            ? [`${prefix}${key.replace(/_(one|other)$/, '')}`]
            : []
      )
    for (const namespace of ['authors', 'author', 'not_found', 'privacy'] as const) {
      for (const [lang, dict] of Object.entries(locales.public)) {
        if (!dict[namespace]) continue
        for (const base of new Set(plurals(dict[namespace], `${namespace}.`))) {
          assert.isString(lookup(dict, `${base}_one`), `public/${lang}.json : ${base}_one`)
          assert.isString(lookup(dict, `${base}_other`), `public/${lang}.json : ${base}_other`)
        }
      }
    }
  })
})
