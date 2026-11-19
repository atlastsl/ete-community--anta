import { test } from '@japa/runner'
import { normalizeKey } from '#helpers/normalize'

test.group('Helpers | normalizeKey', () => {
  test('retire les accents et passe en minuscules', ({ assert }) => {
    assert.equal(normalizeKey('Éloïse NʼGUÉMA'), 'eloise nʼguema')
    assert.equal(normalizeKey('Université de Yaoundé I'), 'universite de yaounde i')
  })

  test('compacte les espaces et trim', ({ assert }) => {
    assert.equal(normalizeKey("  Jean-Paul   \t N'DIAYE \n"), "jean-paul n'diaye")
  })

  test('chaîne vide → chaîne vide', ({ assert }) => {
    assert.equal(normalizeKey(''), '')
    assert.equal(normalizeKey('   '), '')
  })
})
