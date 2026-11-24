import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import AuthorsPropose from '../../../commands/authors_propose.js'
import AuthorsValidate from '../../../commands/authors_validate.js'
import AuthorsApply from '../../../commands/authors_apply.js'
import AuthorsVerify from '../../../commands/authors_verify.js'
import AuthorConversionService, { CSV_COLUMNS } from '#services/author_conversion_service'
import RankingService from '#services/ranking_service'

// Fictitious names only (public repository). Les CSV vont dans un sous-dossier
// unique de tmp/ (ignoré par git), supprimé à la fin de chaque test.

async function createProduction(authorNames: string[]): Promise<Production> {
  return Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'published',
    authorNames,
    tags: [],
    licenseStatus: 'member',
  })
}

/** Comptages et empreintes du contenu qui ne doivent jamais changer (lecture seule). */
async function snapshot() {
  const [authors] = await db.from('authors').count('* as total')
  const [links] = await db.from('production_authors').count('* as total')
  const digests = await db.rawQuery(
    `SELECT
       (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(migration_key, '') || '|' ||
          updated_at::text, ',' ORDER BY id), '')) FROM authors) AS authors,
       (SELECT md5(coalesce(string_agg(id::text || '|' || authors::text || '|' ||
          updated_at::text, ',' ORDER BY id), '')) FROM productions) AS productions,
       (SELECT md5(coalesce(string_agg(production_id::text || '|' || author_id::text || '|' ||
          position::text, ',' ORDER BY production_id, author_id), '')) FROM production_authors) AS links`
  )
  return { authors: authors.total, links: links.total, ...digests.rows[0] }
}

test.group('authors:propose / authors:validate (Story 9.5)', (group) => {
  let dir: string

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    dir = `tmp/authors-conversion-test-${randomUUID()}`
    ace.ui.switchMode('raw')
    return async () => {
      ace.ui.switchMode('normal')
      await rm(app.makePath(dir), { recursive: true, force: true })
      await db.rollbackGlobalTransaction()
    }
  })

  test('propose writes the CSV under tmp/ and writes nothing in the database', async ({
    assert,
  }) => {
    const card = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const linked = await createProduction(['Éloïse Fictive'])
    await db.table('production_authors').insert({
      production_id: linked.id,
      author_id: card.id,
      position: 1,
    })
    await createProduction(['FICTIVA Aminata', 'Aminata Fictiva', 'Jean-Paul Exemplaire'])
    const before = await snapshot()

    const command = await ace.create(AuthorsPropose, ['--out', `${dir}/proposal.csv`])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/Proposition écrite/)
    assert.deepEqual(await snapshot(), before)
    const text = await readFile(app.makePath(dir, 'proposal.csv'), 'utf8')
    const info = await stat(app.makePath(dir, 'proposal.csv'))
    assert.equal(info.mode & 0o777, 0o600)
    assert.isTrue(text.startsWith('\uFEFF' + CSV_COLUMNS.join(';') + '\r\n'))
    assert.include(text, 'Aminata Fictiva;1;')
    assert.notInclude(text, 'Éloïse Fictive') // déjà rattaché
  })

  test('propose refuses a path outside tmp/ and never overwrites without --force', async ({
    assert,
  }) => {
    const outside = await ace.create(AuthorsPropose, ['--out', 'database/proposal.csv'])
    await outside.exec()
    outside.assertFailed()
    outside.assertLogMatches(/sous tmp\//)
    assert.isFalse(existsSync(app.makePath('database/proposal.csv')))

    const escape = await ace.create(AuthorsPropose, ['--out', 'tmp/../proposal.csv'])
    await escape.exec()
    escape.assertFailed()

    await mkdir(app.makePath(dir), { recursive: true })
    await writeFile(app.makePath(dir, 'edited.csv'), 'édité')
    const again = await ace.create(AuthorsPropose, ['--out', `${dir}/edited.csv`])
    await again.exec()
    again.assertFailed()
    assert.equal(await readFile(app.makePath(dir, 'edited.csv'), 'utf8'), 'édité')

    const forced = await ace.create(AuthorsPropose, ['--out', `${dir}/edited.csv`, '--force'])
    await forced.exec()
    forced.assertSucceeded()

    await mkdir(app.makePath(dir, 'folder.csv'))
    const folder = await ace.create(AuthorsPropose, ['--out', `${dir}/folder.csv`, '--force'])
    await folder.exec()
    folder.assertFailed()
    folder.assertLogMatches(/est un dossier/)
  })

  test('validate: exit 0 on the raw proposal, read-only', async ({ assert }) => {
    await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    const propose = await ace.create(AuthorsPropose, ['--out', `${dir}/p.csv`])
    await propose.exec()
    const before = await snapshot()

    const command = await ace.create(AuthorsValidate, ['--file', `${dir}/p.csv`])
    await command.exec()

    command.assertSucceeded()
    command.assertLogMatches(/2 fiche\(s\) à créer/)
    command.assertLogMatches(/CSV valide/)
    assert.deepEqual(await snapshot(), before)
  })

  test('validate: exit ≠ 0 on an invalid CSV or a missing file', async () => {
    await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    await mkdir(app.makePath(dir), { recursive: true })
    await writeFile(
      app.makePath(dir, 'bad.csv'),
      `${CSV_COLUMNS.join(';')}\r\nFICTIVA Aminata;1;;fictiva-aminata;Aminata;FICTIVA;;exact;\r\n`
    )

    const command = await ace.create(AuthorsValidate, ['--file', `${dir}/bad.csv`])
    await command.exec()
    command.assertFailed()
    command.assertLogMatches(/absent du CSV : « Jean-Paul Exemplaire »/)

    const missing = await ace.create(AuthorsValidate, ['--file', `${dir}/missing.csv`])
    await missing.exec()
    missing.assertFailed()
    missing.assertLogMatches(/introuvable/)
  })
})

/** Ligne CSV : source_name ; occurrences ; productions ; author_key ; first ; last ; slug ; confidence ; note. */
function row(source: string, key: string, first: string, last: string, slug = ''): string {
  return [source, '1', '', key, first, last, slug, 'exact', ''].join(';')
}

function csv(rows: string[]): string {
  return `\uFEFF${CSV_COLUMNS.join(';')}\r\n${rows.join('\r\n')}\r\n`
}

/** Liens d'une production dans l'ordre : slug de la fiche et position. */
async function linksOf(production: Production) {
  const rows = await db
    .from('production_authors')
    .join('authors', 'authors.id', 'production_authors.author_id')
    .where('production_id', production.id)
    .orderBy('position')
    .select('authors.slug', 'production_authors.position')
  return rows.map((r) => `${r.position}:${r.slug}`)
}

async function namesOf(production: Production): Promise<string[]> {
  const record = await db.from('productions').where('id', production.id).first()
  return record.authors
}

test.group('authors:apply / authors:verify (Story 9.6)', (group) => {
  let dir: string

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    // verify est global : on part d'une base vide (annulé avec la transaction).
    await db.from('production_authors').delete()
    await db.from('productions').delete()
    await db.from('authors').delete()
    dir = `tmp/authors-conversion-test-${randomUUID()}`
    await mkdir(app.makePath(dir), { recursive: true })
    ace.ui.switchMode('raw')
    return async () => {
      ace.ui.switchMode('normal')
      await rm(app.makePath(dir), { recursive: true, force: true })
      await db.rollbackGlobalTransaction()
    }
  })

  async function writeCsv(name: string, rows: string[]) {
    await writeFile(app.makePath(dir, name), csv(rows))
    return `${dir}/${name}`
  }

  async function apply(file: string, ...extra: string[]) {
    const command = await ace.create(AuthorsApply, ['--file', file, ...extra])
    await command.exec()
    return command
  }

  async function verify() {
    const command = await ace.create(AuthorsVerify, [])
    await command.exec()
    return command
  }

  async function verifySucceeds() {
    const command = await verify()
    command.assertSucceeded()
  }

  test('apply: order kept, merge by author_key, existing card, non-public cards to complete', async ({
    assert,
  }) => {
    const existing = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const first = await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire', 'E. Fictive'])
    const second = await createProduction(['Aminata Fictiva'])
    const [logs] = await db.from('admin_activity_logs').count('* as total')
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Aminata Fictiva', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Jean-Paul Exemplaire', 'exemplaire-jean-paul', 'Jean-Paul', 'Exemplaire'),
      row('E. Fictive', '', '', '', 'eloise-fictive'),
    ])

    const command = await apply(file, '--report', `${dir}/report.txt`)

    command.assertSucceeded()
    command.assertLogMatches(
      /Fiches créées : 2 · fiches existantes utilisées : 1 · liens créés : 4/
    )
    assert.deepEqual(await linksOf(first), [
      '1:aminata-fictiva',
      '2:jean-paul-exemplaire',
      '3:eloise-fictive',
    ])
    assert.deepEqual(await linksOf(second), ['1:aminata-fictiva'])
    assert.deepEqual(await namesOf(first), [
      'Aminata FICTIVA',
      'Jean-Paul Exemplaire',
      'Éloïse Fictive',
    ])
    assert.deepEqual(await namesOf(second), ['Aminata FICTIVA'])

    const created = await Author.query()
      .whereNotNull('migration_key')
      .withCount('affiliations')
      .orderBy('slug')
    assert.deepEqual(
      created.map((a) => a.migrationKey),
      ['fictiva-aminata', 'exemplaire-jean-paul']
    )
    for (const card of created) {
      assert.isNull(card.consentConfirmedAt)
      assert.isNull(card.createdById)
      assert.equal(Number(card.$extras.affiliations_count), 0) // « À compléter »
    }
    // Fiche existante : ni noms ni migration_key écrits.
    await existing.refresh()
    assert.isNull(existing.migrationKey)
    assert.equal(`${existing.firstNames} ${existing.lastNames}`, 'Éloïse Fictive')
    // Aucun journal d'activité.
    const [logsAfter] = await db.from('admin_activity_logs').count('* as total')
    assert.equal(logsAfter.total, logs.total)
    // Rapport sous tmp/, propriétaire seul.
    const report = await readFile(app.makePath(dir, 'report.txt'), 'utf8')
    assert.include(report, 'APPLICATION')
    assert.include(report, 'Fiches créées : 2')
    assert.include(report, '- eloise-fictive (par existing_author_slug)')
    const info = await stat(app.makePath(dir, 'report.txt'))
    assert.equal(info.mode & 0o777, 0o600)
    await verifySucceeds()
  })

  test('apply: same card twice in a production → one link at its first occurrence, 1..n', async ({
    assert,
  }) => {
    const existing = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const merged = await createProduction(['Moussa Fictif', 'Awa Exemple', 'M. FICTIF'])
    const bySlug = await createProduction(['Éloïse Fictive', 'Awa Exemple', 'E. FICTIVE'])
    const file = await writeCsv('dup.csv', [
      row('Moussa Fictif', 'fictif-moussa', 'Moussa', 'Fictif'),
      row('M. FICTIF', 'fictif-moussa', 'Moussa', 'Fictif'),
      row('Awa Exemple', 'exemple-awa', 'Awa', 'Exemple'),
      row('Éloïse Fictive', '', '', '', existing.slug),
      row('E. FICTIVE', '', '', '', existing.slug),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    assert.deepEqual(await linksOf(merged), ['1:moussa-fictif', '2:awa-exemple'])
    assert.deepEqual(await namesOf(merged), ['Moussa Fictif', 'Awa Exemple'])
    assert.deepEqual(await linksOf(bySlug), ['1:eloise-fictive', '2:awa-exemple'])
    assert.deepEqual(await namesOf(bySlug), ['Éloïse Fictive', 'Awa Exemple'])
    await verifySucceeds()
  })

  test('apply: card of the same migration_key reused, its names never overwritten', async ({
    assert,
  }) => {
    const card = await Author.create({
      firstNames: 'Aminata',
      lastNames: 'FICTIVA-DIOP',
      migrationKey: 'fictiva-aminata',
    })
    const production = await createProduction(['A. Fictiva'])
    const file = await writeCsv('mk.csv', [
      row('A. Fictiva', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    await card.refresh()
    assert.equal(card.lastNames, 'FICTIVA-DIOP')
    assert.deepEqual(await linksOf(production), [`1:${card.slug}`])
    assert.deepEqual(await namesOf(production), ['Aminata FICTIVA-DIOP'])
    const [authors] = await db.from('authors').count('* as total')
    assert.equal(Number(authors.total), 1)
    const report = await readFile(app.makePath(dir, 'r.txt'), 'utf8')
    assert.include(report, 'noms du CSV ignorés « Aminata FICTIVA », fiche conservée')
  })

  test('apply --dry-run: same report, nothing written', async ({ assert }) => {
    await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Jean-Paul Exemplaire', 'exemplaire-jean-paul', 'Jean-Paul', 'Exemplaire'),
    ])
    const before = await snapshot()

    const command = await apply(file, '--dry-run', '--report', `${dir}/dry.txt`)

    command.assertSucceeded()
    command.assertLogMatches(/Simulation terminée/)
    assert.deepEqual(await snapshot(), before)
    const report = await readFile(app.makePath(dir, 'dry.txt'), 'utf8')
    assert.include(report, 'SIMULATION')
    assert.include(report, 'Fiches créées : 2')
    assert.include(report, 'Liens créés : 2')
  })

  // Story 12.2 (P2.3): the pivot is written outside `sync` → home rankings invalidated after
  // the commit (this process only, D-12.2-4); a dry run rolls back and keeps them.
  test('apply invalidates the home rankings; --dry-run keeps them (Story 12.2)', async ({
    assert,
  }) => {
    await createProduction(['FICTIVA Aminata'])
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
    ])
    await RankingService.mostViewedIds()

    const dry = await apply(file, '--dry-run', '--report', `${dir}/ranking-dry.txt`)
    dry.assertSucceeded()
    assert.include(RankingService.cachedKeys(), 'mostViewed')

    const command = await apply(file, '--report', `${dir}/ranking.txt`)
    command.assertSucceeded()
    assert.deepEqual(RankingService.cachedKeys(), [])
  })

  test('apply twice = same state; completed CSV → only the new names attached', async ({
    assert,
  }) => {
    const first = await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    const rows = [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Jean-Paul Exemplaire', 'exemplaire-jean-paul', 'Jean-Paul', 'Exemplaire'),
    ]
    const file = await writeCsv('ok.csv', rows)
    const once1 = await apply(file, '--report', `${dir}/1.txt`)
    once1.assertSucceeded()
    const once = await snapshot()

    const again = await apply(file, '--report', `${dir}/2.txt`)
    again.assertSucceeded()
    again.assertLogMatches(/liens créés : 0/)
    again.assertLogMatches(/ignorées \(déjà rattachées\) : 1/)
    assert.deepEqual(await snapshot(), once)

    // Nouvelle production saisie entre-temps (ancien formulaire).
    const added = await createProduction(['Nouveau Fictif', 'FICTIVA Aminata'])
    const completed = await writeCsv('completed.csv', [
      ...rows,
      row('Nouveau Fictif', 'fictif-nouveau', 'Nouveau', 'Fictif'),
    ])
    const linksBefore = await linksOf(first)
    const third = await apply(completed, '--report', `${dir}/3.txt`)

    third.assertSucceeded()
    third.assertLogMatches(/Fiches créées : 1 · fiches existantes utilisées : 1 · liens créés : 2/)
    third.assertLogMatches(/« Jean-Paul Exemplaire ».*n'est plus à rattacher \(ignorée\)/)
    const thirdReport = await readFile(app.makePath(dir, '3.txt'), 'utf8')
    assert.match(thirdReport, /## Avertissements du contrôle/)
    assert.match(thirdReport, /« Jean-Paul Exemplaire ».*n'est plus à rattacher \(ignorée\)/)
    assert.deepEqual(await linksOf(first), linksBefore)
    assert.deepEqual(await linksOf(added), ['1:nouveau-fictif', '2:aminata-fictiva'])
    const [authors] = await db.from('authors').count('* as total')
    assert.equal(Number(authors.total), 3)
    await verifySucceeds()
  })

  test('apply: invalid CSV → exit 1, nothing written, no report', async ({ assert }) => {
    await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    const file = await writeCsv('bad.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
    ])
    const before = await snapshot()

    const command = await apply(file, '--report', `${dir}/bad.txt`)

    command.assertFailed()
    command.assertLogMatches(/absent du CSV : « Jean-Paul Exemplaire »/)
    command.assertLogMatches(/aucune écriture en base/)
    assert.deepEqual(await snapshot(), before)
    assert.isFalse(existsSync(app.makePath(dir, 'bad.txt')))
  })

  test('apply: report outside tmp/ or already existing → refused', async ({ assert }) => {
    await createProduction(['FICTIVA Aminata'])
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
    ])
    const before = await snapshot()

    const outside = await apply(file, '--report', 'database/report.txt')
    outside.assertFailed()
    outside.assertLogMatches(/sous tmp\//)
    assert.isFalse(existsSync(app.makePath('database/report.txt')))

    await writeFile(app.makePath(dir, 'taken.txt'), 'x')
    const taken = await apply(file, '--report', `${dir}/taken.txt`)
    taken.assertFailed()
    assert.deepEqual(await snapshot(), before)
  })

  test('verify: exit 0 with nothing to attach, ≠ 0 below 100 % or on bad positions', async () => {
    await verifySucceeds()

    const card = await Author.create({ firstNames: 'Moussa', lastNames: 'Fictif' })
    const production = await createProduction(['Moussa Fictif', 'Nom Libre'])
    await db
      .table('production_authors')
      .insert({ production_id: production.id, author_id: card.id, position: 1 })
    const partial = await verify()
    partial.assertFailed()
    partial.assertLogMatches(/non rattaché\(s\) « Nom Libre »/)
    partial.assertLogMatches(/rattachés : 1 \(50 %\)/)

    await db.from('productions').where('id', production.id).update({ authors: '["Moussa Fictif"]' })
    await verifySucceeds()

    await db
      .from('production_authors')
      .where('production_id', production.id)
      .update({ position: 2 })
    const positions = await verify()
    positions.assertFailed()
    positions.assertLogMatches(/positions incohérentes \(2\)/)
  })

  /** Rapport sans la ligne de libellé ni la date (seules différences permises). */
  async function reportBody(name: string): Promise<string> {
    const text = await readFile(app.makePath(dir, name), 'utf8')
    return text
      .split('\n')
      .filter(
        (line) => !line.startsWith('Conversion des auteurs — ') && !line.startsWith('Date : ')
      )
      .join('\n')
  }

  test('apply --dry-run: report identical to the real run except the label', async ({ assert }) => {
    await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    await createProduction(['FICTIVA Aminata', 'E. Fictive', 'Aminata Fictiva'])
    await createProduction([])
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Aminata Fictiva', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('E. Fictive', '', '', '', 'eloise-fictive'),
      row('Ancien Nom', 'ancien-nom', 'Ancien', 'Nom'),
    ])

    const dry = await apply(file, '--dry-run', '--report', `${dir}/dry.txt`)
    dry.assertSucceeded()
    const real = await apply(file, '--report', `${dir}/real.txt`)
    real.assertSucceeded()

    assert.match(
      await readFile(app.makePath(dir, 'dry.txt'), 'utf8'),
      /^Conversion des auteurs — SIMULATION/
    )
    assert.match(
      await readFile(app.makePath(dir, 'real.txt'), 'utf8'),
      /^Conversion des auteurs — APPLICATION/
    )
    assert.equal(await reportBody('dry.txt'), await reportBody('real.txt'))
    assert.include(await reportBody('real.txt'), "n'est plus à rattacher")
  })

  test('apply: non-text values kept, never refreshed, reported; verify lists them, exit ≠ 0', async ({
    assert,
  }) => {
    const mixed = await createProduction(['Moussa Fictif'])
    const scalar = await createProduction(['Nom Libre'])
    await db.from('productions').where('id', mixed.id).update({ authors: '["Moussa Fictif", 42]' })
    await db.from('productions').where('id', scalar.id).update({ authors: '"Nom Libre"' })
    const file = await writeCsv('nt.csv', [
      row('Moussa Fictif', 'fictif-moussa', 'Moussa', 'Fictif'),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    command.assertLogMatches(/valeurs non textuelles conservées : 2 .*authors:verify/)
    assert.deepEqual(await linksOf(mixed), ['1:moussa-fictif'])
    assert.deepEqual(await namesOf(mixed), ['Moussa Fictif', 42] as any)
    assert.deepEqual(await namesOf(scalar), 'Nom Libre' as any)
    const report = await readFile(app.makePath(dir, 'r.txt'), 'utf8')
    assert.include(report, `- ${mixed.slug} : 1 élément(s) non textuel(s)`)
    assert.include(report, `- ${scalar.slug} : valeur non tableau`)
    assert.include(report, 'productions.authors réécrits : 0')

    const check = await verify()
    check.assertFailed()
    check.assertLogMatches(new RegExp(`${mixed.slug} : valeurs non textuelles conservées`))
    check.assertLogMatches(new RegExp(`${scalar.slug} : valeurs non textuelles conservées`))
  })

  test('apply: linked card absent from the jsonb → production untouched, reported désynchronisée', async ({
    assert,
  }) => {
    const stray = await Author.create({ firstNames: 'Awa', lastNames: 'Exemple' })
    const production = await createProduction(['Moussa Fictif'])
    await db
      .table('production_authors')
      .insert({ production_id: production.id, author_id: stray.id, position: 1 })
    const file = await writeCsv('ds.csv', [
      row('Moussa Fictif', 'fictif-moussa', 'Moussa', 'Fictif'),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    command.assertLogMatches(
      /Fiches créées : 0 · fiches existantes utilisées : 0 · liens créés : 0/
    )
    command.assertLogMatches(/désynchronisées : 1 .*authors:verify/)
    assert.deepEqual(await linksOf(production), ['1:awa-exemple'])
    assert.deepEqual(await namesOf(production), ['Moussa Fictif'])
    const report = await readFile(app.makePath(dir, 'r.txt'), 'utf8')
    assert.include(report, `- ${production.slug} : awa-exemple`)
  })

  test('apply re-validates inside its transaction: stale validation → errors, rollback, no throw', async ({
    assert,
    cleanup,
  }) => {
    await createProduction(['E. Fictive', 'Nom Ajouté'])
    const file = await writeCsv('stale.csv', [row('E. Fictive', '', '', '', 'eloise-fictive')])
    // Validation antérieure périmée (carte supprimée, nom ajouté depuis) : seul le contrôle
    // dans la transaction d'apply peut les voir.
    const original = AuthorConversionService.validate
    AuthorConversionService.validate = async () => ({
      errors: [],
      warnings: [],
      plan: { toCreate: 0, toAttach: 0, sourceNames: 0, links: 0, productions: 0 },
    })
    cleanup(() => {
      AuthorConversionService.validate = original
    })
    const before = await snapshot()

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertFailed()
    command.assertLogMatches(/existing_author_slug « eloise-fictive » introuvable/)
    command.assertLogMatches(/absent du CSV : « Nom Ajouté »/)
    command.assertLogMatches(/aucune écriture en base/)
    assert.deepEqual(await snapshot(), before)
    assert.isFalse(existsSync(app.makePath(dir, 'r.txt')))
  })

  test('apply: report that cannot be written → rollback, exit 1', async ({ assert }) => {
    await createProduction(['FICTIVA Aminata'])
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
    ])
    await writeFile(app.makePath(dir, 'blocker'), 'x') // un fichier là où le dossier est attendu
    const before = await snapshot()

    const command = await apply(file, '--report', `${dir}/blocker/report.txt`)

    command.assertFailed()
    command.assertLogMatches(/rapport non écrit .*aucune écriture en base/)
    assert.deepEqual(await snapshot(), before)
  })

  test('apply: links not all inserted (ON CONFLICT DO NOTHING) → anomaly, no refresh', async ({
    assert,
  }) => {
    const production = await createProduction(['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    // Trigger de test (annulé avec la transaction) : la 2e ligne n'est pas insérée.
    await db.rawQuery(
      `CREATE FUNCTION test_skip_second_link() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.position = 2 THEN RETURN NULL; END IF; RETURN NEW; END $$`
    )
    await db.rawQuery(
      `CREATE TRIGGER test_skip_second_link BEFORE INSERT ON production_authors
       FOR EACH ROW EXECUTE FUNCTION test_skip_second_link()`
    )
    const file = await writeCsv('ok.csv', [
      row('FICTIVA Aminata', 'fictiva-aminata', 'Aminata', 'FICTIVA'),
      row('Jean-Paul Exemplaire', 'exemplaire-jean-paul', 'Jean-Paul', 'Exemplaire'),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    command.assertLogMatches(/liens créés : 1/)
    command.assertLogMatches(/anomalies : 1/)
    assert.deepEqual(await namesOf(production), ['FICTIVA Aminata', 'Jean-Paul Exemplaire'])
    const report = await readFile(app.makePath(dir, 'r.txt'), 'utf8')
    assert.include(report, `- ${production.slug} : 1 lien(s) inséré(s) sur 2 attendu(s)`)
  })

  test('apply: fully attached production with gaps or another order → recompacted', async ({
    assert,
  }) => {
    const moussa = await Author.create({ firstNames: 'Moussa', lastNames: 'Fictif' })
    const awa = await Author.create({ firstNames: 'Awa', lastNames: 'Exemple' })
    const gaps = await createProduction(['FICTIF Moussa'])
    const swapped = await createProduction(['Awa Exemple', 'Moussa Fictif'])
    await db.table('production_authors').multiInsert([
      { production_id: gaps.id, author_id: moussa.id, position: 3 },
      { production_id: swapped.id, author_id: moussa.id, position: 1 },
      { production_id: swapped.id, author_id: awa.id, position: 2 },
    ])
    const ordering = await verify()
    ordering.assertFailed()
    ordering.assertLogMatches(/positions incohérentes \(3\)/)
    ordering.assertLogMatches(
      new RegExp(
        `${swapped.slug} : ordre incohérent \\(pivot moussa-fictif, awa-exemple ; attendu awa-exemple, moussa-fictif\\)`
      )
    )
    // Aucun nom à rattacher : un CSV sans ligne utile suffit.
    const file = await writeCsv('none.csv', [row('Ancien Nom', 'ancien-nom', 'Ancien', 'Nom')])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    command.assertLogMatches(/réordonnées : 2/)
    assert.deepEqual(await linksOf(gaps), ['1:moussa-fictif'])
    assert.deepEqual(await linksOf(swapped), ['1:awa-exemple', '2:moussa-fictif'])
    assert.deepEqual(await namesOf(gaps), ['Moussa Fictif'])
    await verifySucceeds()
  })

  test('apply report: empty productions bucketed, totals add up, card listed once', async ({
    assert,
  }) => {
    const card = await Author.create({
      firstNames: 'Moussa',
      lastNames: 'Fictif',
      migrationKey: 'fictif-moussa',
    })
    await createProduction(['Moussa Fictif'])
    await createProduction(['M. FICTIF'])
    await createProduction([])
    await createProduction(['  '])
    const file = await writeCsv('both.csv', [
      row('Moussa Fictif', '', '', '', card.slug),
      row('M. FICTIF', 'fictif-moussa', 'Moussa', 'Fictif'),
    ])

    const command = await apply(file, '--report', `${dir}/r.txt`)

    command.assertSucceeded()
    command.assertLogMatches(/fiches existantes utilisées : 1 · liens créés : 2/)
    const report = await readFile(app.makePath(dir, 'r.txt'), 'utf8')
    assert.include(report, `- ${card.slug} (par existing_author_slug, migration_key)`)
    assert.include(report, '- ignorées (aucun nom exploitable) : 2')
    const total = Number(/Productions examinées : (\d+)/.exec(report)![1])
    const buckets = [...report.matchAll(/^- [^:\n]+ : (\d+)$/gm)].map((m) => Number(m[1]))
    assert.equal(total, 4)
    assert.equal(
      buckets.reduce((sum, n) => sum + n, 0),
      total
    )
  })
})
