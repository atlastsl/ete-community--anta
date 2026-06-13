import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `inertia/lib/share.ts` n'est pas importable depuis un test serveur
 * (projet TS composite séparé — TS6305). On vérifie la source de la logique pure.
 */
const source = readFileSync(resolve(process.cwd(), 'inertia/lib/share.ts'), 'utf-8')

test.group('share | buildShareClipboardText', () => {
  test('concatène intro et URL', ({ assert }) => {
    assert.include(source, 'return `${intro}\\n${url}`')
  })
})

test.group('share | pickNativeShareData', () => {
  test('sépare intro et url quand url est présent', ({ assert }) => {
    assert.include(source, '{ title, text: intro, url }')
    assert.include(source, 'return { title, text: intro, url }')
  })

  test('réserve le corps texte+url au repli sans champ url', ({ assert }) => {
    assert.include(source, '{ title, text: body }')
    assert.notInclude(source, '{ title, text: body, url }')
  })
})
