import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `inertia/lib/production_completion.ts` n'est pas importable depuis un test serveur
 * (frontière TS séparée, TS6305 — cf. notify.spec.ts). On vérifie la SOURCE de la
 * logique pure `isAttachmentSatisfied` (AC5 Story 4.5).
 */
const source = readFileSync(resolve(process.cwd(), 'inertia/lib/production_completion.ts'), 'utf-8')

test.group('production_completion | isAttachmentSatisfied (AC5)', () => {
  test('external_link exige un lien (le fichier seul ne suffit pas)', ({ assert }) => {
    assert.match(
      source,
      /licenseStatus\s*===\s*['"]external_link['"]\s*\)\s*return\s+hasLink/,
      'external_link doit retourner hasLink'
    )
  })

  test('les autres licences acceptent fichier OU lien', ({ assert }) => {
    assert.match(source, /return\s+hasFile\s*\|\|\s*hasLink/, 'sinon hasFile || hasLink')
  })
})
