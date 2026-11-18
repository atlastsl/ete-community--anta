import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'

// Fictitious names only (public repository).

async function createProduction(authorNames: string[] = []): Promise<Production> {
  return Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'draft',
    authorNames,
    tags: [],
    licenseStatus: 'member',
  })
}

/** Runs `fn` in a savepoint so an expected constraint error does not abort the test transaction. */
async function expectDbError(fn: (trx: any) => Promise<unknown>): Promise<any> {
  try {
    await db.transaction(fn)
  } catch (error) {
    return error
  }
  return null
}

test.group('Production ↔ Author pivot (Story 9.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('authors relation ordered by pivot position, pivot_position exposed', async ({ assert }) => {
    const a1 = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const a2 = await Author.create({ firstNames: 'Jean Marc', lastNames: 'Exemple' })
    const production = await createProduction()

    await production.related('authors').attach({
      [a2.id]: { position: 1 },
      [a1.id]: { position: 2 },
    })
    await production.load('authors')

    assert.deepEqual(
      production.authors.map((a) => [a.lastNames, a.$extras.pivot_position]),
      [
        ['Exemple', 1],
        ['Fictive', 2],
      ]
    )

    await a1.load('productions')
    assert.deepEqual(
      a1.productions.map((p) => p.id),
      [production.id]
    )
  })

  test('authorNames still reads and writes the jsonb column `authors`', async ({ assert }) => {
    const production = await createProduction(['Éloïse Fictive', 'Jean Marc Exemple'])
    const row = await db.from('productions').where('id', production.id).select('authors').first()
    assert.deepEqual(row.authors, ['Éloïse Fictive', 'Jean Marc Exemple'])

    production.authorNames = ['Paul Inventé']
    await production.save()
    const reloaded = await Production.findOrFail(production.id)
    assert.deepEqual(reloaded.authorNames, ['Paul Inventé'])
  })

  test('deleting the production deletes its pivot rows (CASCADE)', async ({ assert }) => {
    const author = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const production = await createProduction()
    await production.related('authors').attach({ [author.id]: { position: 1 } })

    await production.delete()

    const rows = await db.from('production_authors').where('author_id', author.id)
    assert.lengthOf(rows, 0)
    assert.isNotNull(await Author.find(author.id))
  })

  test('deleting a linked author is refused by the FK (RESTRICT, 23503)', async ({ assert }) => {
    const author = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const production = await createProduction()
    await production.related('authors').attach({ [author.id]: { position: 1 } })

    const error = await expectDbError(async (trx) => {
      author.useTransaction(trx)
      await author.delete()
    })
    assert.equal(error?.code, '23503')
    assert.equal(error?.constraint, 'production_authors_author_id_foreign')
  })

  test('withCount / has on the ordered relations: no ORDER BY in the sub-query', async ({
    assert,
  }) => {
    const author = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    await author.related('affiliations').create({ position: 1, institution: 'Université Exemple' })
    const production = await createProduction()
    await production.related('authors').attach({ [author.id]: { position: 1 } })

    const productions = await Production.query()
      .where('id', production.id)
      .withCount('authors')
      .has('authors')
    assert.equal(productions[0].$extras.authors_count, 1)

    const authors = await Author.query()
      .where('id', author.id)
      .withCount('affiliations')
      .has('affiliations')
    assert.equal(authors[0].$extras.affiliations_count, 1)
  })

  test('duplicate position in one production → UNIQUE (production_id, position)', async ({
    assert,
  }) => {
    const a1 = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const a2 = await Author.create({ firstNames: 'Jean Marc', lastNames: 'Exemple' })
    const production = await createProduction()

    const error = await expectDbError((trx) =>
      trx.table('production_authors').multiInsert([
        { production_id: production.id, author_id: a1.id, position: 1 },
        { production_id: production.id, author_id: a2.id, position: 1 },
      ])
    )
    assert.equal(error?.code, '23505')
    assert.equal(error?.constraint, 'production_authors_production_id_position_unique')
  })

  test('position must be >= 1 (CHECK)', async ({ assert }) => {
    const author = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const production = await createProduction()

    const error = await expectDbError((trx) =>
      trx
        .table('production_authors')
        .insert({ production_id: production.id, author_id: author.id, position: 0 })
    )
    assert.equal(error?.code, '23514')
  })
})
