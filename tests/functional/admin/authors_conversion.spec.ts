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
import { CSV_COLUMNS } from '#services/author_conversion_service'

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
})
