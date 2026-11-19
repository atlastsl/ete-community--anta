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

async function pivotOf(production: Production): Promise<[string, number][]> {
  const rows = await db
    .from('production_authors')
    .where('production_id', production.id)
    .orderBy('position', 'asc')
    .select('author_id', 'position')
  return rows.map((row: { author_id: string; position: number }) => [row.author_id, row.position])
}

test.group('ProductionAuthorService | sync (Story 9.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('replaces the pivot (positions 1..n) and refreshes the jsonb', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const b = await Author.create({ firstNames: 'Jean-Paul', lastNames: 'Exemplaire' })
    const c = await Author.create({ firstNames: 'Zoé', lastNames: 'Imaginaire' })
    const production = await createProduction([])
    await link(production, [a, b])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [c.id, a.id], trx)
    )

    assert.deepEqual(result, { protected: false, changed: true })
    assert.deepEqual(await pivotOf(production), [
      [c.id, 1],
      [a.id, 2],
    ])
    assert.deepEqual(await namesOf(production), ['Zoé Imaginaire', 'Aminata FICTIVA'])
    assert.equal(await ProductionAuthorService.count(production.id), 2)
  })

  test('same order → no pivot rewrite, the jsonb is still resynchronized', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    // Nom rattaché (même matchKey) mais graphie différente : la colonne est réalignée.
    const production = await createProduction(['FICTIVA  aminata'])
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [a.id], trx)
    )

    assert.deepEqual(result, { protected: false, changed: false })
    assert.deepEqual(await namesOf(production), ['Aminata FICTIVA'])
  })

  test('unconverted production (names, no link) + empty selection → nothing written', async ({
    assert,
  }) => {
    const production = await createProduction(['Nom Libre', 'Autre Nom'])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [], trx)
    )

    assert.deepEqual(result, { protected: true, changed: false })
    assert.deepEqual(await namesOf(production), ['Nom Libre', 'Autre Nom'])
    assert.equal(await ProductionAuthorService.count(production.id), 0)
  })

  test('converted production emptied → pivot deleted, jsonb []', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction(['Aminata FICTIVA'])
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [], trx)
    )

    assert.deepEqual(result, { protected: false, changed: true })
    assert.deepEqual(await pivotOf(production), [])
    assert.deepEqual(await namesOf(production), [])
  })

  test('unknown author id → validation error on authorIds, nothing written', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction(['Aminata FICTIVA'])
    await link(production, [a])

    let error: any = null
    try {
      await db.transaction((trx) =>
        ProductionAuthorService.sync(
          production.id,
          [a.id, '00000000-0000-4000-8000-000000000000'],
          trx
        )
      )
    } catch (e) {
      error = e
    }

    assert.equal(error?.code, 'E_VALIDATION_ERROR')
    assert.equal(error.messages[0].field, 'authorIds')
    assert.deepEqual(await pivotOf(production), [[a.id, 1]])
  })

  test('production row locked (FOR UPDATE) before the decision', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction([])
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
      await ProductionAuthorService.sync(production.id, [a.id], spy)
    })
    const lock = sql.findIndex((query) => /FROM productions[\s\S]*FOR UPDATE/.test(query))
    const write = sql.findIndex((query) => /INSERT INTO production_authors/.test(query))
    assert.isAtLeast(lock, 0)
    assert.isAbove(write, lock)
  })
})

test.group('ProductionAuthorService | sync — rattachement partiel (revue 9.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sélection inchangée + nom libre non rattaché → rien n’est réécrit (protected)', async ({
    assert,
  }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction(['Aminata FICTIVA', 'Nom Libre'])
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [a.id], trx)
    )

    assert.deepEqual(result, { protected: true, changed: false })
    assert.deepEqual(await namesOf(production), ['Aminata FICTIVA', 'Nom Libre'])
  })

  test('sélection inchangée + valeur non textuelle → rien n’est réécrit', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction([])
    await db
      .from('productions')
      .where('id', production.id)
      .update({
        authors: db.raw(`'["Aminata FICTIVA", 42]'::jsonb`),
      })
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [a.id], trx)
    )

    assert.isTrue(result.protected)
    assert.deepEqual(await namesOf(production), ['Aminata FICTIVA', 42] as any)
  })

  test('sélection modifiée → réécriture voulue depuis le pivot (D-9.7-k)', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const b = await Author.create({ firstNames: 'Zoé', lastNames: 'Imaginaire' })
    const production = await createProduction(['Aminata FICTIVA', 'Nom Libre'])
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [a.id, b.id], trx)
    )

    assert.deepEqual(result, { protected: false, changed: true })
    assert.deepEqual(await namesOf(production), ['Aminata FICTIVA', 'Zoé Imaginaire'])
  })

  test('identifiants en majuscules : comparés sans tenir compte de la casse', async ({
    assert,
  }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction(['Aminata FICTIVA'])
    await link(production, [a])

    const result = await db.transaction((trx) =>
      ProductionAuthorService.sync(production.id, [a.id.toUpperCase()], trx)
    )

    assert.isFalse(result.changed)
    assert.deepEqual(await pivotOf(production), [[a.id, 1]])
  })

  test('legacyState : noms non rattachés et valeurs non textuelles', async ({ assert }) => {
    const a = await Author.create({ firstNames: 'Aminata', lastNames: 'FICTIVA' })
    const production = await createProduction(['aminata fictiva', 'Nom Libre', ' '])
    await link(production, [a])

    assert.deepEqual(await ProductionAuthorService.legacyState(production.id), {
      unlinkedNames: ['Nom Libre'],
      nonText: false,
    })
  })
})

test.group(
  'ProductionAuthorService | ordre des verrous (revue 9.7, pas d’interblocage)',
  (group) => {
    let author: Author
    let production: Production
    group.each.setup(async () => {
      // Données validées (hors transaction globale) : deux connexions doivent les voir.
      author = await Author.create({ firstNames: 'Verrou', lastNames: 'FICTIF' })
      production = await createProduction([])
      return async () => {
        await db.from('production_authors').where('production_id', production.id).delete()
        await db.from('productions').where('id', production.id).delete()
        await db.from('author_affiliations').where('author_id', author.id).delete()
        await db.from('authors').where('id', author.id).delete()
      }
    })

    test('sync n’attend pas le verrou FOR NO KEY UPDATE d’un renommage en cours', async ({
      assert,
    }) => {
      const holder = await db.transaction()
      try {
        // Verrou pris par AuthorService.update sur la fiche avant de verrouiller ses productions.
        await holder.rawQuery('SELECT id FROM authors WHERE id = ? FOR NO KEY UPDATE', [author.id])
        const trx = await db.transaction()
        try {
          await trx.rawQuery(`SET LOCAL lock_timeout = '2s'`)
          const result = await ProductionAuthorService.sync(production.id, [author.id], trx)
          assert.isTrue(result.changed)
        } finally {
          await trx.rollback()
        }
      } finally {
        await holder.rollback()
      }
    }).timeout(10_000)

    test('AuthorService.update n’attend pas le verrou FOR KEY SHARE d’un sync en cours', async ({
      assert,
    }) => {
      const { default: AuthorService } = await import('#services/author_service')
      const holder = await db.transaction()
      try {
        // Verrou pris par sync (et par toute insertion de pivot, FK) sur la fiche.
        await holder.rawQuery('SELECT id FROM authors WHERE id = ? FOR KEY SHARE', [author.id])
        const outcome = await Promise.race([
          AuthorService.update(author, {
            lastNames: 'FICTIF',
            firstNames: 'Verrou',
            affiliations: [],
            googleScholarUrl: 'https://scholar.google.com/citations?user=fictif',
          }).then(() => 'done'),
          new Promise((resolve) => setTimeout(() => resolve('blocked'), 3000)),
        ])
        assert.equal(outcome, 'done')
      } finally {
        await holder.rollback()
      }
    }).timeout(10_000)
  }
)
