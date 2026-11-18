import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
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

    const ids = await db.transaction((trx) =>
      ProductionAuthorService.fullyAttachedProductionIds(card.id, trx)
    )
    assert.deepEqual(ids, [full.id])
    assert.notInclude(ids, other.id)
  })

  test('non-text values, non-array value or no usable name → never fully attached', async ({
    assert,
  }) => {
    const card = await Author.create({ firstNames: 'Moussa', lastNames: 'Fictif' })
    const mixed = await createProduction(['Moussa Fictif'])
    const scalar = await createProduction(['Moussa Fictif'])
    const empty = await createProduction(['  '])
    await db
      .from('productions')
      .where('id', mixed.id)
      .update({ authors: '["Moussa Fictif", {"x": 1}]' })
    await db
      .from('productions')
      .where('id', scalar.id)
      .update({ authors: '{"name": "Moussa Fictif"}' })
    for (const production of [mixed, scalar, empty]) await link(production, [card])

    const ids = await db.transaction((trx) =>
      ProductionAuthorService.fullyAttachedProductionIds(card.id, trx)
    )
    assert.deepEqual(ids, [])
  })

  test('candidate productions locked (FOR UPDATE, by id) before the attachment check', async ({
    assert,
  }) => {
    const card = await Author.create({ firstNames: 'Moussa', lastNames: 'Fictif' })
    const production = await createProduction(['Moussa Fictif'])
    await link(production, [card])

    const sql: string[] = []
    await db.transaction(async (trx) => {
      const spy = new Proxy(trx, {
        get(target, property) {
          if (property === 'rawQuery') {
            return (query: string, bindings?: any) => {
              sql.push(query)
              return target.rawQuery(query, bindings)
            }
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      }) as TransactionClientContract
      assert.deepEqual(await ProductionAuthorService.fullyAttachedProductionIds(card.id, spy), [
        production.id,
      ])
    })

    const lock = sql.findIndex((query) => /FROM productions[\s\S]*FOR UPDATE/.test(query))
    const read = sql.findIndex((query) => /p\.authors/.test(query))
    assert.isAtLeast(lock, 0)
    assert.match(sql[lock], /ORDER BY p\.id/)
    assert.isBelow(lock, read)
  })
})
