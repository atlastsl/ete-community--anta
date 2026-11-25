import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import { DateTime } from 'luxon'
import ProductionDemoSeeder, {
  SEED_AUTHOR_PREFIX,
  STATS_SPREAD_DAYS,
  assertLocalDatabase,
  randomStatDate,
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

  test('une fiche seed-demo: liée à une vraie production est conservée par la purge', async ({
    assert,
  }) => {
    await runSeeder()
    const seedCard = await Author.query()
      .where('migration_key', `${SEED_AUTHOR_PREFIX}1`)
      .firstOrFail()
    const real = await Production.create({
      title: 'Production réelle liée à une fiche de démo',
      status: 'draft',
      authorNames: [],
      tags: [],
      licenseStatus: 'member',
    })
    await db
      .table('production_authors')
      .insert({ production_id: real.id, author_id: seedCard.id, position: 1 })

    await runSeeder()

    assert.isNotNull(await Author.find(seedCard.id))
    const seedAuthors = await Author.query().whereLike('migration_key', `${SEED_AUTHOR_PREFIX}%`)
    // Réutilisée (même migration_key), pas de doublon.
    assert.lengthOf(seedAuthors, 24)
    const links = await db.from('production_authors').where('production_id', real.id)
    assert.lengthOf(links, 1)
  })
})

// Story 12.5 — statistiques datées sur 540 j et garde-fou de base locale.
test.group('ProductionDemoSeeder | stats datées et base locale (Story 12.5)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })
  group.each.timeout(60_000)

  test('vues et téléchargements sur 540 j, jamais avant la publication, une partie hors 365 j', async ({
    assert,
  }) => {
    await runSeeder()
    for (const [table, column] of [
      ['stats_views', 'recorded_at'],
      ['stats_downloads', 'downloaded_at'],
    ]) {
      const result = await db.rawQuery(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE s.${column} < now() - interval '365 days') AS outside,
                count(*) FILTER (WHERE s.${column} < clock_timestamp() - interval '${STATS_SPREAD_DAYS} days'
                                    OR s.${column} > clock_timestamp()) AS out_of_range,
                count(*) FILTER (WHERE s.${column} < p.anta_published_at) AS before_publication,
                count(*) FILTER (WHERE p.status <> 'published') AS not_published,
                count(DISTINCT date_trunc('day', s.${column})) AS days
           FROM ${table} s JOIN productions p ON p.id = s.production_id
          WHERE p.institution = 'SEED_DEMO'`
      )
      const row = result.rows[0]
      assert.isAbove(Number(row.total), 0, table)
      assert.isAbove(Number(row.outside), 0, `${table} : aucune stat hors fenêtre`)
      assert.isBelow(
        Number(row.outside),
        Number(row.total),
        `${table} : aucune stat dans la fenêtre`
      )
      assert.equal(Number(row.out_of_range), 0, table)
      assert.equal(Number(row.before_publication), 0, table)
      assert.equal(Number(row.not_published), 0, table)
      assert.isAbove(Number(row.days), 100, `${table} : dates non étalées`)
    }
  })

  test('randomStatDate : bornée par la publication et par 540 j, jamais dans le futur', ({
    assert,
  }) => {
    const now = DateTime.fromISO('2026-06-01T12:00:00Z')
    const floor = now.minus({ days: STATS_SPREAD_DAYS })
    const recent = now.minus({ days: 10 })
    for (let i = 0; i < 200; i++) {
      const old = randomStatDate(now.minus({ days: 700 }), now)
      assert.isTrue(old >= floor && old <= now)
      const undated = randomStatDate(null, now)
      assert.isTrue(undated >= floor && undated <= now)
      const fresh = randomStatDate(recent, now)
      assert.isTrue(fresh >= recent && fresh <= now)
    }
    // Published "in the future" (inconsistent data): never after now.
    assert.equal(randomStatDate(now.plus({ days: 3 }), now).toMillis(), now.toMillis())
  })

  test('assertLocalDatabase : boucle locale acceptée, tout autre hôte refusé', ({ assert }) => {
    for (const host of ['localhost', '127.0.0.1', '::1']) {
      assert.doesNotThrow(() => assertLocalDatabase(host))
    }
    for (const host of ['db.example.com', '10.0.0.5', 'postgres', '', undefined, null]) {
      assert.throws(() => assertLocalDatabase(host), /base non locale/)
    }
  })
})
