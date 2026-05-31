import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
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
          v !== null && typeof v === 'object' && !Array.isArray(v)
            ? flatten(v as JsonTree)
            : [v]
        )
      for (const value of flatten(file)) {
        assert.isString(value, `${name} contient une valeur non-string`)
        assert.isAbove((value as string).length, 0, `${name} contient une string vide`)
      }
    }
  })
})
