import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 11.7 — parité i18n consolidée de l'Epic 11 (vignettes et une). `translations.spec.ts`
// vérifie que fr et en ont les mêmes clés, pas que les clés utilisées existent : ici, chaque clé
// des fichiers de l'epic — appels `t('…')`, gabarits dépliés (`featured.state.${state}`,
// `productions.${kind}_modal.*`, `${key}_slot`, `activity.action.${type}`), chaînes passées à
// `t()` par variable (`settle(trace, 'thumbnail.uploaded')`, `labelKey`) et clés envoyées par
// le serveur (validateurs, `FeaturedErrorCode`, codes de `ThumbnailsController`, flash de la
// dépublication automatique) — existe en FR et en EN dans les locales qui la rendent.

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

/** Admin files of Epic 11 (rendered by `inertia/admin.tsx`). */
const ADMIN_FILES = [
  'inertia/components/admin/ThumbnailField.tsx',
  'inertia/components/admin/FeaturedSlot.tsx',
  'inertia/components/admin/ProductionPicker.tsx',
  'inertia/components/admin/BannerPreview.tsx',
  'inertia/components/admin/ProductionConfirmDialog.tsx',
  'inertia/pages/admin/Featured/Index.tsx',
  'inertia/pages/admin/ActivityLogs/Index.tsx',
]

/** Pure helper whose returned keys reach `t()` in the admin files (`thumbnailErrorKey`). */
const ADMIN_HELPERS = ['inertia/lib/thumbnail.ts']

/** Public files of Epic 11. The shared `FeaturedBanner` has no `t()` (texts come from the caller). */
const PUBLIC_FILES = ['inertia/components/public/FeaturedBanner.tsx', 'inertia/pages/home.tsx']

/** Members of a string literal union `type NAME = 'a' | 'b'` (or a `name: 'a' | 'b'` prop). */
function union(path: string, pattern: RegExp): string[] {
  const match = read(path).match(pattern)
  if (!match) throw new Error(`${pattern} not found in ${path}`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const ACTION_TYPES = [...read('app/enums/action_type.ts').matchAll(/:\s*'([a-z_]+)'/g)].map(
  (m) => m[1]
)
const FEATURED_ERROR_CODES = union(
  'app/services/featured_service.ts',
  /export type FeaturedErrorCode =([^\n]+)/
)
const IMAGE_STATES = union('inertia/lib/featured.ts', /export type FeaturedImageState =([^\n]+)/)
const CONFIRM_KINDS = union(
  'inertia/components/admin/ProductionConfirmDialog.tsx',
  /kind: ((?:'[a-z_]+'\s*\|?\s*)+)/
)
const CLIENT_THUMBNAIL_ERRORS = union(
  'inertia/lib/thumbnail.ts',
  /export type ThumbnailClientError =([^\n]+)/
)
/** Refusals that name their slot (`FeaturedController.update`: every code but `duplicate`). */
const SLOT_CODES = FEATURED_ERROR_CODES.filter((code) => code !== 'duplicate')

/**
 * Template keys of the epic's files, expanded from value lists read in the source (a new value
 * is checked too). Any template key not listed here fails the coverage test below.
 */
const TEMPLATE_KEYS: Record<string, string[]> = {
  'featured.state.${state}': IMAGE_STATES.map((v) => `featured.state.${v}`),
  'productions.${kind}_modal.title': CONFIRM_KINDS.map((v) => `productions.${v}_modal.title`),
  'productions.${kind}_modal.description': CONFIRM_KINDS.map(
    (v) => `productions.${v}_modal.description`
  ),
  'productions.${kind}_modal.confirm': CONFIRM_KINDS.map((v) => `productions.${v}_modal.confirm`),
  'thumbnail.errors.${invalid}': CLIENT_THUMBNAIL_ERRORS.map((v) => `thumbnail.errors.${v}`),
  '${key}_slot': SLOT_CODES.map((code) => `featured.errors.${code}_slot`),
  'activity.action.${type}': ACTION_TYPES.map((v) => `activity.action.${v}`),
  'activity.action.${log.actionType}': ACTION_TYPES.map((v) => `activity.action.${v}`),
}

/**
 * Template keys: inside `t(`…`)`, and template literals of the epic's namespaces handed to
 * `t()` through a variable (`setError(`thumbnail.errors.${invalid}`)`).
 */
function templateKeys(source: string): string[] {
  const inCall = [...source.matchAll(/\bt\(\s*`([^`]*\$\{[^`]*)`/g)].map((m) => m[1])
  const indirect = [...source.matchAll(/`((?:thumbnail|featured)\.[^`]*\$\{[^`]*)`/g)].map(
    (m) => m[1]
  )
  return [...new Set([...inCall, ...indirect])]
}

/**
 * Keys of a file: `t('…')` literals, expanded templates, and string literals of the epic's
 * namespaces handed to `t()` through a variable (`thumbnail.*`, `featured.*`, `labelKey`).
 */
function usedKeys(source: string): string[] {
  const literal = [...source.matchAll(/\bt\(\s*(['"`])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g)].map(
    (m) => m[2]
  )
  const indirect = [...source.matchAll(/'((?:thumbnail|featured)\.[a-z0-9_.]+)'/g)].map((m) => m[1])
  return [
    ...new Set([
      ...literal,
      ...indirect,
      ...templateKeys(source).flatMap((key) => TEMPLATE_KEYS[key] ?? []),
    ]),
  ]
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/** A key resolves to a non-empty string, directly or through its i18next plural forms. */
function resolves(dict: Record<string, any>, key: string): boolean {
  const direct = lookup(dict, key)
  if (typeof direct === 'string') return direct.trim() !== ''
  const one = lookup(dict, `${key}_one`)
  const other = lookup(dict, `${key}_other`)
  return typeof one === 'string' && typeof other === 'string' && one !== '' && other !== ''
}

function assertKeys(
  assert: any,
  scope: keyof typeof locales,
  keys: string[],
  origin: string
): void {
  assert.isAbove(keys.length, 0, `aucune clé trouvée : ${origin}`)
  for (const key of keys) {
    for (const [lang, dict] of Object.entries(locales[scope])) {
      assert.isTrue(resolves(dict, key), `${scope}/${lang}.json : ${key} (${origin})`)
    }
  }
}

/** Keys sent by the server to the admin pages (flash, field errors). */
function serverKeys(): Record<string, string[]> {
  const literals = (path: string, pattern: RegExp) =>
    [...read(path).matchAll(pattern)].map((m) => m[1])
  const errorLiteral = /'((?:featured|thumbnail)\.errors\.[a-z_]+)'/g
  const thumbnailCodes = union(
    'app/controllers/admin/thumbnails_controller.ts',
    /code: ((?:'[a-z_]+'\s*\|?\s*)+)/
  )
  const imageCodes = [
    ...read('app/controllers/admin/thumbnails_controller.ts').matchAll(/photo_\w+: '([a-z_]+)'/g),
  ].map((m) => m[1])
  return {
    'app/validators/admin/featured_validator.ts': literals(
      'app/validators/admin/featured_validator.ts',
      errorLiteral
    ),
    'app/validators/admin/thumbnail_validator.ts': literals(
      'app/validators/admin/thumbnail_validator.ts',
      errorLiteral
    ),
    'app/controllers/admin/featured_controller.ts': [
      ...literals('app/controllers/admin/featured_controller.ts', errorLiteral),
      ...FEATURED_ERROR_CODES.map((code) => `featured.errors.${code}`),
      ...SLOT_CODES.map((code) => `featured.errors.${code}_slot`),
    ],
    'app/controllers/admin/thumbnails_controller.ts': [...thumbnailCodes, ...imageCodes].map(
      (code) => `thumbnail.errors.${code}`
    ),
    'app/controllers/admin/productions_controller.ts': literals(
      'app/controllers/admin/productions_controller.ts',
      /'(productions\.auto_unpublished(?:_featured)?)'/g
    ),
    'app/enums/action_type.ts': ACTION_TYPES.map((type) => `activity.action.${type}`),
  }
}

test.group('i18n | clés de l’Epic 11 (Story 11.7)', () => {
  test('listes lues dans les sources : non vides et attendues', ({ assert }) => {
    assert.includeMembers(ACTION_TYPES, ['featured_update', 'featured_auto_remove'])
    assert.sameMembers(FEATURED_ERROR_CODES, [
      'not_found',
      'not_published',
      'thumbnail_required',
      'duplicate',
    ])
    assert.sameMembers(IMAGE_STATES, ['thumbnail', 'poster', 'missing'])
    assert.sameMembers(CONFIRM_KINDS, ['unpublish', 'delete'])
    assert.sameMembers(CLIENT_THUMBNAIL_ERRORS, ['invalid_type', 'too_large'])
  })

  test('chaque clé gabarit des fichiers de l’epic est dépliée par TEMPLATE_KEYS', ({ assert }) => {
    const found = new Set([...ADMIN_FILES, ...PUBLIC_FILES].flatMap((f) => templateKeys(read(f))))
    assert.isAbove(found.size, 0)
    for (const key of found) assert.isTrue(key in TEMPLATE_KEYS, `gabarit non déplié : ${key}`)
    for (const values of Object.values(TEMPLATE_KEYS)) assert.isAbove(values.length, 0)
  })

  for (const file of [...ADMIN_FILES, ...ADMIN_HELPERS]) {
    test(`${file} : clés présentes en FR et EN (locales admin)`, ({ assert }) => {
      assertKeys(assert, 'admin', usedKeys(read(file)), file)
    })
  }

  test('AdminLayout : entrée « À la une » (labelKey) en FR et EN', ({ assert }) => {
    const labels = [...read('inertia/layouts/AdminLayout.tsx').matchAll(/labelKey: '([^']+)'/g)]
    const keys = labels.map((m) => m[1])
    assert.include(keys, 'nav.featured')
    assertKeys(assert, 'admin', keys, 'AdminLayout')
  })

  for (const file of PUBLIC_FILES) {
    test(`${file} : clés présentes en FR et EN (locales publiques)`, ({ assert }) => {
      assertKeys(assert, 'public', usedKeys(read(file)), file)
    })
  }

  for (const [origin, keys] of Object.entries(serverKeys())) {
    test(`${origin} : clés envoyées par le serveur présentes en FR et EN (locales admin)`, ({
      assert,
    }) => {
      assertKeys(assert, 'admin', keys, origin)
    })
  }

  test('le rendu partagé de la bannière n’a aucune clé i18n (instances admin et public)', ({
    assert,
  }) => {
    const source = read('inertia/components/shared/FeaturedBanner.tsx')
    assert.notMatch(source, /\bt\(/)
    assert.notInclude(source, 'useTranslation')
  })
})
