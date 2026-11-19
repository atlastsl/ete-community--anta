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
  'inertia/components/shared/SortSelect.tsx',
  'inertia/components/shared/Pagination.tsx',
]

/**
 * Shared files also rendered by the admin bundle (`inertia/admin.tsx`). `Avatar` (also shared)
 * has no `t()` call: its alt text comes from the caller.
 */
const ADMIN_RENDERED_FILES = [
  'inertia/pages/errors/not_found.tsx',
  'inertia/components/shared/Pagination.tsx',
]

/** Values of a `const NAME = [ 'a', 'b' ] as const` array declared in a source file. */
function constArray(path: string, name: string): string[] {
  const match = read(path).match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))
  if (!match) throw new Error(`${name} not found in ${path}`)
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

const PRIVACY_SECTIONS = constArray('inertia/pages/privacy-policy.tsx', 'SECTIONS').filter(
  (section) => section !== 'authors'
)

/**
 * Template keys (`t(`…${x}…`)`) of the epic's files, expanded with the value lists they iterate
 * over (read from the source, so a new value is checked too). Any template key not listed here
 * fails the coverage test below: extend the table when adding one.
 */
const TEMPLATE_KEYS: Record<string, string[]> = {
  'authors.list.sort.${value}': constArray(
    'inertia/lib/authors_list_query.ts',
    'AUTHORS_LIST_SORTS'
  ).map((v) => `authors.list.sort.${v}`),
  'authors.profile.sort.${value}': constArray(
    'inertia/lib/author_profile_query.ts',
    'PROFILE_SORTS'
  ).map((v) => `authors.profile.sort.${v}`),
  'privacy.${section}.heading': PRIVACY_SECTIONS.map((v) => `privacy.${v}.heading`),
  'privacy.${section}.body': PRIVACY_SECTIONS.map((v) => `privacy.${v}.body`),
  'privacy.authors.${item}': constArray('inertia/pages/privacy-policy.tsx', 'AUTHOR_ITEMS').map(
    (v) => `privacy.authors.${v}`
  ),
}

/** Template i18n keys used through `t(`…${…}…`)`, as written in the source. */
function templateKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*`([^`]*\$\{[^`]*)`/g)].map((m) => m[1])
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/**
 * i18n keys used through `t('…')`, `t("…")` or a template without placeholder, plus the
 * expansion of the known template keys (`TEMPLATE_KEYS`).
 */
function usedKeys(source: string): string[] {
  const literal = [...source.matchAll(/\bt\(\s*(['"`])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g)].map(
    (m) => m[2]
  )
  return [...literal, ...templateKeys(source).flatMap((key) => TEMPLATE_KEYS[key] ?? [])]
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

  test('chaque clé gabarit des fichiers de l’epic est dépliée par TEMPLATE_KEYS', ({ assert }) => {
    const found = new Set(PUBLIC_FILES.flatMap((file) => templateKeys(read(file))))
    assert.isAbove(found.size, 0)
    for (const key of found) assert.isTrue(key in TEMPLATE_KEYS, `gabarit non déplié : ${key}`)
    for (const values of Object.values(TEMPLATE_KEYS)) assert.isAbove(values.length, 0)
  })

  for (const file of PUBLIC_FILES) {
    test(`${file} : clés présentes en FR et EN (locales publiques)`, ({ assert }) => {
      const keys = usedKeys(read(file))
      assert.isAbove(keys.length, 0, `aucune clé trouvée dans ${file}`)
      for (const key of keys) {
        for (const [lang, dict] of Object.entries(locales.public)) {
          assert.isTrue(resolves(dict, key), `public/${lang}.json : ${key} (${file})`)
        }
      }
    })
  }

  for (const file of ADMIN_RENDERED_FILES) {
    test(`${file} : clés aussi présentes dans les locales admin`, ({ assert }) => {
      const keys = usedKeys(read(file))
      assert.isAbove(keys.length, 0, `aucune clé trouvée dans ${file}`)
      for (const key of keys) {
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
