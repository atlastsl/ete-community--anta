import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import ProductionAuthorService from '#services/production_author_service'

// Fictitious names only (public repository).

async function createProduction(authorNames: string[]): Promise<Production> {
  return Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'published',
    authorNames,
    tags: [],
    licenseStatus: 'member',
  })
}

async function link(production: Production, authors: Author[]) {
  await db.table('production_authors').multiInsert(
    authors.map((author, index) => ({
      production_id: production.id,
      author_id: author.id,
      position: index + 1,
    }))
  )
}

async function namesOf(production: Production): Promise<string[]> {
  const row = await db.from('productions').where('id', production.id).select('authors').first()
  return row.authors
}

test.group('ProductionAuthorService | refreshDenormalizedNames (Story 9.6)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('rewrites the jsonb from the pivot, in position order', async ({ assert }) => {
    const first = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const second = await Author.create({ firstNames: 'Jean-Paul', lastNames: 'Exemplaire' })
    const production = await createProduction(['J.-P. Exemplaire', 'A. Fictiva'])
    await link(production, [second, first])

    const updated = await ProductionAuthorService.refreshDenormalizedNames([production.id])

    assert.equal(updated, 1)
    assert.deepEqual(await namesOf(production), ['Jean-Paul Exemplaire', 'Aminata FICTIVA'])
    // Valeur identique → aucune ligne réécrite.
    assert.equal(await ProductionAuthorService.refreshDenormalizedNames([production.id]), 0)
  })

  test('empty pivot → [] (NOT NULL column); empty id list → nothing', async ({ assert }) => {
    const production = await createProduction(['Nom Libre'])
    assert.equal(await ProductionAuthorService.refreshDenormalizedNames([]), 0)
    assert.deepEqual(await namesOf(production), ['Nom Libre'])

    await ProductionAuthorService.refreshDenormalizedNames([production.id])
    assert.deepEqual(await namesOf(production), [])
  })

  test('card without first names → no leading space; updated_at untouched', async ({ assert }) => {
    const card = await Author.create({ firstNames: '', lastNames: 'FICTIVUS' })
    const production = await createProduction(['Fictivus'])
    await link(production, [card])
    const before = await db.from('productions').where('id', production.id).first()

    await ProductionAuthorService.refreshDenormalizedNames([production.id])

    const after = await db.from('productions').where('id', production.id).first()
    assert.deepEqual(after.authors, ['FICTIVUS'])
    assert.equal(String(after.updated_at), String(before.updated_at))
  })

  test('full-text search still finds the author under the refreshed name', async ({ assert }) => {
    const card = await Author.create({ firstNames: 'Zéphyrin', lastNames: 'Imaginaire' })
    const production = await createProduction(['Z. Imag.'])
    await link(production, [card])
    const search = (term: string) =>
      db
        .from('productions')
        .whereRaw("search_vector @@ websearch_to_tsquery('simple', ?)", [term])
        .where('id', production.id)

    assert.lengthOf(await search('imaginaire'), 0)
    await ProductionAuthorService.refreshDenormalizedNames([production.id])
    assert.lengthOf(await search('imaginaire'), 1)
  })
})

test.group('ProductionAuthorService | fullyAttachedProductionIds (Story 9.6)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('only productions whose names are all attached (matchKey)', async ({ assert }) => {
    const card = await Author.create({ firstNames: 'Moussa', lastNames: 'Fictif' })
    const full = await createProduction(['FICTIF Moussa'])
    const partial = await createProduction(['Moussa Fictif', 'Nom Libre'])
    const other = await createProduction(['Moussa Fictif'])
    await link(full, [card])
    await link(partial, [card])

    const ids = await ProductionAuthorService.fullyAttachedProductionIds(card.id)
    assert.deepEqual(ids, [full.id])
    assert.notInclude(ids, other.id)
  })
})
