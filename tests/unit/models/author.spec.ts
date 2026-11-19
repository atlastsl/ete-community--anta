import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'

test.group('Author model | hooks', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('search_name = « prénoms noms » normalisé, réécrit à chaque enregistrement', async ({
    assert,
  }) => {
    const author = await Author.create({ firstNames: 'Éloïse  Marie', lastNames: 'NGUÉMA' })
    assert.equal(author.searchName, 'eloise marie nguema')

    author.lastNames = 'Ndongo'
    await author.save()
    await author.refresh()
    assert.equal(author.searchName, 'eloise marie ndongo')
  })

  test('slug prenom-nom généré à la création, suffixe en cas de collision', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aïcha', lastNames: 'Testa' })
    const b = await Author.create({ firstNames: 'Aicha', lastNames: 'TESTA' })
    const c = await Author.create({ firstNames: 'aïcha', lastNames: 'testa' })
    assert.equal(a.slug, 'aicha-testa')
    assert.equal(b.slug, 'aicha-testa-2')
    assert.equal(c.slug, 'aicha-testa-3')
  })

  test('repli « auteur » si rien de translittérable', async ({ assert }) => {
    const author = await Author.create({ firstNames: '—', lastNames: '…' })
    assert.equal(author.slug, 'auteur')
  })

  test('slug figé : un renommage ne le modifie pas (D28)', async ({ assert }) => {
    const author = await Author.create({ firstNames: 'Paul', lastNames: 'Exemple' })
    author.firstNames = 'Pierre'
    author.lastNames = 'Autre'
    await author.save()
    await author.refresh()
    assert.equal(author.slug, 'paul-exemple')
  })

  test('affiliation : institution_key normalisée, affiliations triées par position', async ({
    assert,
  }) => {
    const author = await Author.create({ firstNames: 'Jean', lastNames: 'Fictif' })
    await AuthorAffiliation.createMany([
      { authorId: author.id, position: 2, institution: 'École  Normale', department: null },
      {
        authorId: author.id,
        position: 1,
        institution: 'Université de Yaoundé I',
        department: 'Maths',
      },
    ])
    await author.load('affiliations')
    assert.deepEqual(
      author.affiliations.map((a) => [a.position, a.institutionKey]),
      [
        [1, 'universite de yaounde i'],
        [2, 'ecole normale'],
      ]
    )
  })
})
