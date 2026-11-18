import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import ProductionDemoSeeder, {
  SEED_AUTHOR_PREFIX,
} from '../../../database/seeders/production_demo_seeder.js'

// Noms fictifs uniquement (dépôt public). Base locale de test seulement.

async function runSeeder() {
  const log = console.log
  console.log = () => {}
  try {
    await new ProductionDemoSeeder(db.connection()).run()
  } finally {
    console.log = log
  }
}

async function demoProductionIds(): Promise<string[]> {
  const rows = await db.from('productions').where('institution', 'SEED_DEMO').select('id')
  return rows.map((row: { id: string }) => row.id)
}

test.group('ProductionDemoSeeder | auteurs de démo (Story 9.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })
  group.each.timeout(60_000)

  test('fiches seed-demo: fictives, affiliations, consentement partiel, pivot cohérent', async ({
    assert,
  }) => {
    await runSeeder()

    const authors = await Author.query()
      .whereLike('migration_key', `${SEED_AUTHOR_PREFIX}%`)
      .withCount('affiliations')
    assert.lengthOf(authors, 24)
    for (const author of authors) {
      const affiliations = Number(author.$extras.affiliations_count)
      assert.isAtLeast(affiliations, 1)
      assert.isAtMost(affiliations, 2)
      assert.isNull(author.createdById)
    }
    const publicCount = authors.filter((author) => author.consentConfirmedAt !== null).length
    assert.isAbove(publicCount, 0)
    assert.isBelow(publicCount, authors.length)

    const ids = await demoProductionIds()
    assert.lengthOf(ids, 300)
    // Chaque production : 1 à 3 liens, positions 1..n, colonne = noms du pivot dans l'ordre.
    const mismatches = await db.rawQuery(
      `SELECT p.id
         FROM productions p
         LEFT JOIN LATERAL (
           SELECT count(*) AS n, max(pa.position) AS maxpos,
                  COALESCE(jsonb_agg(btrim(a.first_names || ' ' || a.last_names) ORDER BY pa.position), '[]'::jsonb) AS names
             FROM production_authors pa JOIN authors a ON a.id = pa.author_id
            WHERE pa.production_id = p.id
         ) l ON true
        WHERE p.institution = 'SEED_DEMO'
          AND (l.n NOT BETWEEN 1 AND 3 OR l.maxpos <> l.n OR p.authors IS DISTINCT FROM l.names)`
    )
    assert.lengthOf(mismatches.rows, 0)
    const linkedElsewhere = await db
      .from('production_authors')
      .join('authors', 'authors.id', 'production_authors.author_id')
      .whereIn('production_authors.production_id', ids)
      .whereNot('authors.migration_key', 'like', `${SEED_AUTHOR_PREFIX}%`)
      .count('* as total')
      .first()
    assert.equal(Number(linkedElsewhere.total), 0)
  })

  test('nouveau passage : purge puis recrée, autres données intactes (idempotent)', async ({
    assert,
  }) => {
    const realAuthor = await Author.create({ firstNames: 'Réel', lastNames: 'Témoin' })
    const real = await Production.create({
      title: 'Production réelle de test',
      status: 'draft',
      authorNames: ['Réel Témoin'],
      tags: [],
      licenseStatus: 'member',
    })
    await db
      .table('production_authors')
      .insert({ production_id: real.id, author_id: realAuthor.id, position: 1 })

    await runSeeder()
    const firstIds = await demoProductionIds()
    await runSeeder()
    const secondIds = await demoProductionIds()

    assert.lengthOf(secondIds, 300)
    assert.notIncludeMembers(secondIds, firstIds)
    const seedAuthors = await Author.query().whereLike('migration_key', `${SEED_AUTHOR_PREFIX}%`)
    assert.lengthOf(seedAuthors, 24)

    await real.refresh()
    assert.deepEqual(real.authorNames, ['Réel Témoin'])
    assert.isNotNull(await Author.find(realAuthor.id))
    const realLinks = await db.from('production_authors').where('production_id', real.id)
    assert.lengthOf(realLinks, 1)
  })
})
