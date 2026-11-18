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
