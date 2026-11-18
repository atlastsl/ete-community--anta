import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `inertia/lib/author_form.ts` n'est pas importable depuis un test serveur (frontière TS
 * séparée, TS6305) : on vérifie sa SOURCE, et la parité de ses règles avec le validateur
 * serveur (mêmes clés i18n, mêmes limites).
 */
const clientSrc = readFileSync(resolve(process.cwd(), 'inertia/lib/author_form.ts'), 'utf-8')
const serverSrc = readFileSync(
  resolve(process.cwd(), 'app/validators/admin/author_validator.ts'),
  'utf-8'
)

const keysOf = (src: string) => new Set(src.match(/authors\.form\.errors\.[a-z_]+/g) ?? [])

test.group('author_form (client) | parité avec author_validator', () => {
  test('mêmes clés d’erreur que le serveur', ({ assert }) => {
    const server = keysOf(serverSrc)
    assert.isAbove(server.size, 8)
    assert.sameMembers([...keysOf(clientSrc)], [...server])
  })

  test('mêmes limites (120, 255, 500, 20 affiliations)', ({ assert }) => {
    for (const constant of [
      'AUTHOR_NAME_MAX = 120',
      'AFFILIATION_FIELD_MAX = 255',
      'SCHOLAR_URL_MAX = 500',
      'AFFILIATIONS_MAX = 20',
    ]) {
      assert.include(clientSrc, constant)
      assert.include(serverSrc, constant)
    }
  })

  test('erreurs indexées comme VineJS (affiliations.N.champ)', ({ assert }) => {
    assert.include(clientSrc, '`affiliations.${index}.institution`')
    assert.include(clientSrc, '`affiliations.${index}.department`')
  })

  test('URL Google Scholar : http(s) seulement', ({ assert }) => {
    assert.include(clientSrc, "url.protocol === 'http:' || url.protocol === 'https:'")
  })
})

test.group('author_form (client) | affichage et envoi', () => {
  test('« Prénom NOM » : capitales sur le nom à l’affichage seulement (D13, D34)', ({ assert }) => {
    assert.include(clientSrc, "`${firstNames} ${lastNames.toLocaleUpperCase('fr-FR')}`")
    assert.notInclude(clientSrc, 'firstNames.toLocaleUpperCase')
  })

  test('toAuthorPayload omet département et URL vides', ({ assert }) => {
    assert.include(clientSrc, '...(scholar ? { googleScholarUrl: scholar } : {})')
    assert.include(clientSrc, '? { institution: a.institution.trim(), department }')
  })
})
