import { test } from '@japa/runner'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

type JsonTree = Record<string, unknown>

function loadJson(path: string): JsonTree {
  const absolute = resolve(process.cwd(), path)
  return JSON.parse(readFileSync(absolute, 'utf-8'))
}

function collectKeys(obj: JsonTree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return collectKeys(v as JsonTree, path)
    }
    return [path]
  })
}

const frPublic = loadJson('inertia/locales/public/fr.json')
const enPublic = loadJson('inertia/locales/public/en.json')
const frAdmin = loadJson('inertia/locales/admin/fr.json')
const enAdmin = loadJson('inertia/locales/admin/en.json')

test.group('Translations | structure', () => {
  test('chaque fichier locale contient au moins 3 namespaces top-level', ({ assert }) => {
    assert.isAtLeast(Object.keys(frPublic).length, 3, 'public/fr.json')
    assert.isAtLeast(Object.keys(enPublic).length, 3, 'public/en.json')
    assert.isAtLeast(Object.keys(frAdmin).length, 3, 'admin/fr.json')
    assert.isAtLeast(Object.keys(enAdmin).length, 3, 'admin/en.json')
  })
})

test.group('Translations | key parity', () => {
  test('public — fr et en ont exactement les mêmes clés', ({ assert }) => {
    const frKeys = collectKeys(frPublic).sort()
    const enKeys = collectKeys(enPublic).sort()
    assert.deepEqual(frKeys, enKeys, 'Clés orphelines détectées entre public/fr et public/en')
  })

  test('admin — fr et en ont exactement les mêmes clés', ({ assert }) => {
    const frKeys = collectKeys(frAdmin).sort()
    const enKeys = collectKeys(enAdmin).sort()
    assert.deepEqual(frKeys, enKeys, 'Clés orphelines détectées entre admin/fr et admin/en')
  })
})

test.group('Translations | content', () => {
  test('toutes les valeurs sont des strings non vides', ({ assert }) => {
    const allFiles = { frPublic, enPublic, frAdmin, enAdmin }
    for (const [name, file] of Object.entries(allFiles)) {
      const flatten = (obj: JsonTree): unknown[] =>
        Object.values(obj).flatMap((v) =>
          v !== null && typeof v === 'object' && !Array.isArray(v) ? flatten(v as JsonTree) : [v]
        )
      for (const value of flatten(file)) {
        assert.isString(value, `${name} contient une valeur non-string`)
        assert.isAbove((value as string).length, 0, `${name} contient une string vide`)
      }
    }
  })
})

/*
 * Story 13.4 — generic usage check (complements the per-epic specs `public_authors_keys` (10.8)
 * and `featured_keys` (11.7)): every literal key `t('a.b')` of every source file of a bundle
 * exists in the FR and EN locales of that bundle, so a Phase 2 key (Epic 12 blocks, suggestions,
 * sorts; Epic 13 headings, logo…) or any later one cannot be forgotten in one language. Keys passed
 * as data or props (`labelKey: 'nav.x'`, `saveLabelKey="a.b"`) are scanned too. A template key
 * `t(`a.${x}.b`)` is turned into a pattern (`^a\.[^.]+\.b$`) that must match at least one key in
 * each locale. Out of reach of a source reading: `t(variable)`, templates starting with a
 * placeholder (`t(`${key}_slot`)`) and keys sent by the server (covered by `featured_keys`).
 */

/** Source files (`.ts`, `.tsx`) under a directory, recursively, as repository-relative paths. */
function sourcesUnder(dir: string): string[] {
  const absolute = resolve(process.cwd(), dir)
  return readdirSync(absolute, { recursive: true, encoding: 'utf-8' })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${dir}/${file}`.replaceAll('\\', '/'))
}

/** Files rendered by the public entry point (`inertia/app.tsx`). */
const PUBLIC_SOURCES = [
  'inertia/app.tsx',
  'inertia/layouts/PublicLayout.tsx',
  ...readdirSync(resolve(process.cwd(), 'inertia/pages'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => `inertia/pages/${file}`),
  ...sourcesUnder('inertia/pages/errors'),
  ...sourcesUnder('inertia/components/public'),
  ...sourcesUnder('inertia/components/shared'),
]

const ADMIN_OWN_SOURCES = [
  'inertia/layouts/AdminLayout.tsx',
  'inertia/layouts/AdminAuthLayout.tsx',
  ...sourcesUnder('inertia/pages/admin'),
  ...sourcesUnder('inertia/pages/auth'),
  ...sourcesUnder('inertia/components/admin'),
]

/**
 * Shared components imported by the admin sources (Pagination, Avatar, FeaturedBanner via
 * BannerPreview…), read from their imports so a new one is checked too.
 */
const ADMIN_SHARED_SOURCES = [
  ...new Set(
    ADMIN_OWN_SOURCES.flatMap((file) =>
      [...sourceOf(file).matchAll(/from '~\/components\/shared\/(\w+)'/g)].map(
        (m) => `inertia/components/shared/${m[1]}.tsx`
      )
    )
  ),
]

/** Files rendered by the admin entry point (`inertia/admin.tsx`), 404 of `/admin/*` included. */
const ADMIN_SOURCES = [
  ...ADMIN_OWN_SOURCES,
  ...ADMIN_SHARED_SOURCES,
  'inertia/pages/errors/not_found.tsx',
]

function sourceOf(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

/** Literal keys: `t('a.b')`, `t("a.b")`, `t(`a.b`)` (no placeholder). */
function literalKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*(['"`])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g)].map(
    (m) => m[2]
  )
}

/** Keys passed as data or props: `labelKey: 'a.b'`, `saveLabelKey="a.b"`, `successKey={'a.b'}`. */
function dataKeys(source: string): string[] {
  return [
    ...source.matchAll(/\b\w*Key\s*[:=]\s*\{?\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g),
  ].map((m) => m[2])
}

/** Template keys `t(`…${x}…`)` as written, when they start with a static part. */
function templateKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*`([^`]*\$\{[^`]*)`/g)]
    .map((m) => m[1])
    .filter((key) => !key.startsWith('${'))
}

/** Template → anchored pattern: each `${…}` stands for one key segment (`[^.]+`). */
function templatePattern(template: string): RegExp {
  const parts = template.split(/\$\{[^}]*\}/)
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('[^.]+')}(?:_one|_other)?$`)
}

/** A key resolves to a non-empty string, directly or through its i18next plural forms. */
function resolvesIn(keys: Set<string>, key: string): boolean {
  return keys.has(key) || (keys.has(`${key}_one`) && keys.has(`${key}_other`))
}

const bundles = [
  { name: 'public', sources: PUBLIC_SOURCES, fr: frPublic, en: enPublic, minKeys: 100 },
  { name: 'admin', sources: ADMIN_SOURCES, fr: frAdmin, en: enAdmin, minKeys: 200 },
] as const

test.group('Translations | clés utilisées par les sources (Story 13.4)', () => {
  test('périmètre lu : fichiers des deux bundles, composants partagés de l’admin', ({ assert }) => {
    assert.isAtLeast(PUBLIC_SOURCES.length, 25)
    assert.isAtLeast(ADMIN_OWN_SOURCES.length, 30)
    for (const name of ['Avatar', 'FeaturedBanner', 'Pagination']) {
      assert.include(ADMIN_SHARED_SOURCES, `inertia/components/shared/${name}.tsx`)
    }
  })

  for (const bundle of bundles) {
    test(`${bundle.name} — chaque clé littérale des sources existe en FR et en EN`, ({
      assert,
    }) => {
      const used = new Map<string, string>()
      for (const file of bundle.sources) {
        const source = sourceOf(file)
        for (const key of [...literalKeys(source), ...dataKeys(source)]) {
          if (!used.has(key)) used.set(key, file)
        }
      }
      // Guard: the scan really reads the bundle (a moved folder must not empty it silently).
      assert.isAtLeast(used.size, bundle.minKeys, `${bundle.name} : trop peu de clés trouvées`)
      for (const [lang, dict] of [
        ['fr', bundle.fr],
        ['en', bundle.en],
      ] as const) {
        const keys = new Set(collectKeys(dict))
        const missing = [...used].filter(([key]) => !resolvesIn(keys, key))
        assert.deepEqual(
          missing.map(([key, file]) => `${key} (${file})`),
          [],
          `${bundle.name}/${lang}.json : clés manquantes`
        )
      }
    })

    test(`${bundle.name} — chaque clé gabarit correspond à au moins une clé (motif)`, ({
      assert,
    }) => {
      const templates = new Set(bundle.sources.flatMap((file) => templateKeys(sourceOf(file))))
      assert.isAbove(templates.size, 0, `${bundle.name} : aucune clé gabarit trouvée`)
      for (const [lang, dict] of [
        ['fr', bundle.fr],
        ['en', bundle.en],
      ] as const) {
        const keys = collectKeys(dict)
        for (const template of templates) {
          const pattern = templatePattern(template)
          assert.isTrue(
            keys.some((key) => pattern.test(key)),
            `${bundle.name}/${lang}.json : aucune clé ne correspond à « ${template} »`
          )
        }
      }
    })
  }

  test('détecte une clé absente (contrôle du détecteur)', ({ assert }) => {
    const keys = new Set(collectKeys(frPublic))
    assert.deepEqual(literalKeys("t('home.inexistante') t(`a.b`) t(x) t('mot')"), [
      'home.inexistante',
      'a.b',
    ])
    assert.isFalse(resolvesIn(keys, 'home.inexistante'))
    assert.deepEqual(templateKeys('t(`listing.sort.${v}`) t(`${k}_slot`)'), ['listing.sort.${v}'])
    assert.deepEqual(dataKeys(`labelKey: 'nav.home', saveLabelKey="a.b" x={'c'}`), [
      'nav.home',
      'a.b',
    ])
  })

  test('motif des clés gabarits : un segment par placeholder, points littéraux', ({ assert }) => {
    const pattern = templatePattern('privacy.${section}.heading')
    assert.isTrue(pattern.test('privacy.authors.heading'))
    assert.isFalse(
      pattern.test('privacy.authors.body'),
      'le suffixe compte, pas seulement le préfixe'
    )
    assert.isFalse(pattern.test('privacy.a.b.heading'), 'un placeholder = un seul segment')
    assert.isFalse(pattern.test('privacyXauthorsXheading'), 'les points sont littéraux')
    assert.isTrue(templatePattern('a.${n}_modal.title').test('a.publish_modal.title'))
    assert.isTrue(templatePattern('list.${n}').test('list.count_one'), 'formes plurielles')
  })
})
