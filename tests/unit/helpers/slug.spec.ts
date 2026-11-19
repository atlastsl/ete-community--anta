import { test } from '@japa/runner'
import { slugify } from '#helpers/slug'

test.group('Helpers | slugify', () => {
  test('translittère et sépare par des tirets', ({ assert }) => {
    assert.equal(slugify('Aïcha Mbarga'), 'aicha-mbarga')
    assert.equal(slugify('  Jean-Paul   N’Diaye  '), 'jean-paul-n-diaye')
  })

  test('tronque à 80 caractères sans tiret final', ({ assert }) => {
    const slug = slugify(`${'a'.repeat(79)} bcd`)
    assert.equal(slug, 'a'.repeat(79))
    assert.isAtMost(slugify('x'.repeat(200)).length, 80)
  })

  test('longueur maximale paramétrable', ({ assert }) => {
    assert.equal(slugify('abc def', 3), 'abc')
  })

  test('rien de translittérable → chaîne vide (le repli appartient à l’appelant)', ({ assert }) => {
    assert.equal(slugify(''), '')
    assert.equal(slugify('!!! ???'), '')
  })
})
