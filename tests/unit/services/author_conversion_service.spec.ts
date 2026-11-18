import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import AuthorConversionService, {
  CSV_COLUMNS,
  CsvFormatError,
  type ProposalRow,
  type SourceName,
} from '#services/author_conversion_service'

// Fictitious names only (public repository).

const S = AuthorConversionService

function source(sourceName: string, occurrences = 1): SourceName {
  return { sourceName, occurrences, productions: [], productionIds: [] }
}

async function createProduction(
  authorNames: string[],
  status: 'draft' | 'published' = 'draft'
): Promise<Production> {
  return Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status,
    authorNames,
    tags: [],
    licenseStatus: 'member',
  })
}

async function link(production: Production, author: Author, position = 1) {
  await db.table('production_authors').insert({
    production_id: production.id,
    author_id: author.id,
    position,
  })
}

function rowOf(rows: ProposalRow[], sourceName: string): ProposalRow {
  const row = rows.find((r) => r.sourceName === sourceName)
  if (!row) throw new Error(`row ${sourceName} missing`)
  return row
}

const HEADER = CSV_COLUMNS.join(';')

/** CSV minimal (colonnes de la proposition) à partir de lignes partielles. */
function csv(rows: Partial<Record<(typeof CSV_COLUMNS)[number], string>>[]): string {
  return [HEADER, ...rows.map((r) => CSV_COLUMNS.map((c) => r[c] ?? '').join(';'))].join('\r\n')
}

test.group('AuthorConversionService | keys', () => {
  test('sourceKey: trim and inner spaces collapsed, case and accents kept', ({ assert }) => {
    assert.equal(S.sourceKey('  Éloïse   FICTIVE '), 'Éloïse FICTIVE')
  })

  test('groupKey: accents, case and token order ignored', ({ assert }) => {
    assert.equal(S.groupKey('Aminata FICTIVA'), S.groupKey('fictiva aminata'))
    assert.equal(S.groupKey('Éloïse Fictive'), 'eloise fictive')
  })

  test('groupKey: typographic apostrophes and dashes unified (normalizeKey unchanged)', ({
    assert,
  }) => {
    assert.equal(S.groupKey('Anne d’Exemplaire'), S.groupKey("Anne d'Exemplaire"))
    assert.equal(S.groupKey('Anne dʼExemplaire'), S.groupKey("Anne d'Exemplaire"))
    assert.equal(S.groupKey('Jean-Paul Exemplaire'), S.groupKey('Jean Paul Exemplaire'))
    assert.equal(S.groupKey('Jean–Paul Exemplaire'), S.groupKey('Jean Paul Exemplaire'))
    assert.equal(S.authorKeyOf(S.groupKey('Jean-Paul Exemplaire')), 'exemplaire-jean-paul')
  })
})

test.group('AuthorConversionService | splitName', () => {
  test('« NOM Prénom » and « Prénom NOM »: the all-caps token is the last name', ({ assert }) => {
    assert.deepInclude(S.splitName('FICTIVA Aminata'), {
      firstNames: 'Aminata',
      lastNames: 'FICTIVA',
    })
    assert.deepInclude(S.splitName('Aminata FICTIVA'), {
      firstNames: 'Aminata',
      lastNames: 'FICTIVA',
    })
    assert.deepInclude(S.splitName('Jean Paul FICTIF EXEMPLE'), {
      firstNames: 'Jean Paul',
      lastNames: 'FICTIF EXEMPLE',
    })
  })

  test('no all-caps token: last word is the last name', ({ assert }) => {
    assert.deepEqual(S.splitName('Jean Paul Exemplaire'), {
      firstNames: 'Jean Paul',
      lastNames: 'Exemplaire',
      notes: [],
    })
    // Une initiale (1 lettre) n'est pas un nom en capitales.
    assert.deepInclude(S.splitName('Jean A. Fictif'), {
      firstNames: 'Jean A.',
      lastNames: 'Fictif',
    })
  })

  test('all tokens in capitals: last word rule, noted', ({ assert }) => {
    const split = S.splitName('JEAN FICTIF')
    assert.deepInclude(split, { firstNames: 'JEAN', lastNames: 'FICTIF' })
    assert.lengthOf(split.notes, 1)
  })

  test('single word: last name only, first names to complete', ({ assert }) => {
    const split = S.splitName('Imaginaire')
    assert.deepInclude(split, { firstNames: '', lastNames: 'Imaginaire' })
    assert.match(split.notes[0], /prénom à compléter/)
  })

  test('possible particle noted without changing the split', ({ assert }) => {
    const split = S.splitName('Jean de Fictif')
    assert.deepInclude(split, { firstNames: 'Jean de', lastNames: 'Fictif' })
    assert.match(split.notes.join(), /particule/)
  })
})

test.group('AuthorConversionService | groupSources', () => {
  test('inverted tokens grouped, representative = most frequent spelling', ({ assert }) => {
    const groups = S.groupSources([source('Fictiva Aminata', 1), source('Aminata Fictiva', 3)])
    assert.lengthOf(groups, 1)
    assert.equal(groups[0].representative.sourceName, 'Aminata Fictiva')
    assert.deepEqual(
      groups[0].members.map((m) => [m.source.sourceName, m.confidence]),
      [
        ['Aminata Fictiva', 'exact'],
        ['Fictiva Aminata', 'grouped'],
      ]
    )
  })

  test('same normalizeKey (case, accents) = exact', ({ assert }) => {
    const groups = S.groupSources([source('Éloïse Fictive', 2), source('eloise FICTIVE')])
    assert.lengthOf(groups, 1)
    assert.deepEqual(
      groups[0].members.map((m) => m.confidence),
      ['exact', 'exact']
    )
  })

  test('partial homonyms (same last name, other first name) stay apart', ({ assert }) => {
    const groups = S.groupSources([source('Aminata Fictiva'), source('Awa Fictiva')])
    assert.lengthOf(groups, 2)
  })

  test('tie: the spelling with an all-caps token wins', ({ assert }) => {
    const groups = S.groupSources([source('Aminata Fictiva'), source('FICTIVA Aminata')])
    assert.equal(groups[0].representative.sourceName, 'FICTIVA Aminata')
  })
})

test.group('AuthorConversionService | CSV', () => {
  const row: ProposalRow = {
    sourceName: 'Jean "Le Fictif"; Exemple',
    occurrences: 2,
    productions: ['prod-a', 'prod-b'],
    authorKey: 'exemple-jean',
    firstNames: 'Jean',
    lastNames: 'Exemple',
    existingAuthorSlug: '',
    confidence: 'grouped',
    note: 'ligne 1\nligne 2',
  }

  test('BOM, exact header, CRLF, quoting', ({ assert }) => {
    const text = S.toCsv([row])
    assert.isTrue(text.startsWith('\uFEFF' + HEADER + '\r\n'))
    assert.include(
      text,
      '"Jean ""Le Fictif""; Exemple";2;prod-a | prod-b;exemple-jean;Jean;Exemple;;grouped;"ligne 1\nligne 2"'
    )
    assert.isTrue(text.endsWith('\r\n'))
  })

  test('round trip (quotes, ;, line breaks), LF accepted, empty lines skipped', ({ assert }) => {
    const parsed = S.parseCsv(S.toCsv([row]) + '\r\n;;;;;;;;\r\n')
    assert.deepEqual(parsed.header, [...CSV_COLUMNS])
    assert.lengthOf(parsed.records, 1)
    assert.equal(parsed.records[0].values.source_name, row.sourceName)
    assert.equal(parsed.records[0].values.note, row.note)
    assert.equal(parsed.records[0].line, 2)

    const lf = S.parseCsv('source_name;author_key\nA Fictif;fictif-a\n')
    assert.equal(lf.records[0].values.author_key, 'fictif-a')
  })

  test('unclosed quote and missing ; separator are format errors', ({ assert }) => {
    assert.throws(() => S.parseCsv(`${HEADER}\r\n"Jean;x`), CsvFormatError as any)
    assert.throws(() => S.parseCsv('source_name,author_key\r\nA,b'), /séparateur/)
  })
})

test.group('AuthorConversionService | propose', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('only unattached names, all statuses; attached occurrences and blanks skipped', async ({
    assert,
  }) => {
    const converted = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    const partial = await createProduction(['Éloïse Fictive', 'Jean Paul Exemplaire'], 'published')
    await link(partial, converted)
    await createProduction(['FICTIVA Aminata', '  ', 'Éloïse Fictive'])
    await createProduction(['Aminata  Fictiva'], 'published')

    const { rows, summary } = await S.propose()

    assert.sameMembers(
      rows.map((r) => r.sourceName),
      ['Jean Paul Exemplaire', 'FICTIVA Aminata', 'Aminata Fictiva', 'Éloïse Fictive']
    )
    // La production partiellement rattachée ne propose que son nom restant.
    assert.deepEqual(rowOf(rows, 'Éloïse Fictive').productions.length, 1)
    assert.equal(summary.attached, 1)
    assert.equal(summary.blank, 1)
    const aminata = rowOf(rows, 'Aminata Fictiva')
    assert.deepInclude(aminata, {
      authorKey: 'aminata-fictiva',
      firstNames: 'Aminata',
      lastNames: 'FICTIVA',
      confidence: 'grouped',
    })
    assert.equal(rowOf(rows, 'FICTIVA Aminata').confidence, 'exact')
  })

  test('similar names (pg_trgm > 0.6) flagged fuzzy in the note, never merged', async ({
    assert,
  }) => {
    await createProduction(['Aminata Fictiva', 'Aminatta Fictiva', 'Awa Imaginaire'])

    const { rows, summary } = await S.propose()

    const a = rowOf(rows, 'Aminata Fictiva')
    const b = rowOf(rows, 'Aminatta Fictiva')
    assert.notEqual(a.authorKey, b.authorKey)
    assert.equal(a.confidence, 'fuzzy')
    assert.equal(b.confidence, 'fuzzy')
    assert.match(a.note, /proche de « Aminatta Fictiva » \(0,\d\d\) : non fusionné/)
    assert.equal(rowOf(rows, 'Awa Imaginaire').confidence, 'exact')
    assert.equal(summary.fuzzy, 2)
  })

  test('existing card: unique → slug and names of the card; several → listed in the note', async ({
    assert,
  }) => {
    const card = await Author.create({ firstNames: 'Jean Paul', lastNames: 'EXEMPLAIRE' })
    await Author.create({ firstNames: 'Awa', lastNames: 'Imaginaire' })
    await Author.create({ firstNames: 'Awa', lastNames: 'Imaginaire' })
    await createProduction(['Jean-Paul Exemplaire', 'Imaginaire Awa'])

    const { rows, summary } = await S.propose()

    assert.deepInclude(rowOf(rows, 'Jean-Paul Exemplaire'), {
      existingAuthorSlug: card.slug,
      firstNames: 'Jean Paul',
      lastNames: 'EXEMPLAIRE',
    })
    const awa = rowOf(rows, 'Imaginaire Awa')
    assert.equal(awa.existingAuthorSlug, '')
    assert.match(awa.note, /plusieurs fiches existantes : awa-imaginaire, awa-imaginaire-2/)
    assert.equal(summary.existingAuthors, 1)
  })

  test('read-only: no write possible inside, nothing leaks after', async ({ assert }) => {
    await assert.rejects(
      () =>
        S.readOnly((trx) =>
          trx
            .table('authors')
            .insert({ slug: 'x', first_names: 'X', last_names: 'Y', search_name: 'x y' })
        ),
      /read-only/
    )
    await S.propose()
    // La transaction englobante reste en écriture après la proposition.
    const author = await Author.create({ firstNames: 'Jean', lastNames: 'Fictif' })
    assert.exists(author.id)
  })
})

test.group('AuthorConversionService | validate', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('the raw proposal is valid; plan counts cards, links and productions', async ({
    assert,
  }) => {
    const card = await Author.create({ firstNames: 'Éloïse', lastNames: 'Fictive' })
    await createProduction(['Aminata FICTIVA', 'Fictiva Aminata', 'Éloïse Fictive'])
    await createProduction(['Imaginaire'])
    const { rows } = await S.propose()

    const report = await S.validate(S.toCsv(rows))

    assert.deepEqual(report.errors, [])
    assert.lengthOf(report.warnings, 1) // « Imaginaire » : first_names vide
    // Deux noms d'une même production vers la même fiche = un seul lien.
    assert.deepEqual(report.plan, {
      toCreate: 2,
      toAttach: 1,
      sourceNames: 4,
      links: 3,
      productions: 2,
    })
    assert.equal(rowOf(rows, 'Éloïse Fictive').existingAuthorSlug, card.slug)
  })

  test('missing required columns → single structural error', async ({ assert }) => {
    const report = await S.validate('source_name;author_key\r\nA Fictif;fictif-a')
    assert.lengthOf(report.errors, 1)
    assert.match(
      report.errors[0],
      /colonnes requises absentes : first_names, last_names, existing_author_slug/
    )
  })

  test('row errors: unmapped, duplicate, several identities, unknown slug, empty last name, too long', async ({
    assert,
  }) => {
    await createProduction(['A Fictif', 'B Fictif', 'C Fictif', 'D Fictif', 'E Fictif', 'F Fictif'])
    const report = await S.validate(
      csv([
        { source_name: 'A Fictif' },
        { source_name: 'B Fictif', author_key: 'k', first_names: 'B', last_names: 'Fictif' },
        { source_name: 'B Fictif', author_key: 'k', first_names: 'B', last_names: 'Fictif' },
        { source_name: 'C Fictif', author_key: 'k', first_names: 'C', last_names: 'Fictif' },
        { source_name: 'D Fictif', author_key: 'd', existing_author_slug: 'inconnu' },
        { source_name: 'E Fictif', author_key: 'e', first_names: 'E' },
        {
          source_name: 'F Fictif',
          author_key: 'x'.repeat(256),
          first_names: 'F',
          last_names: 'Fictif',
        },
        { author_key: 'vide' },
      ])
    )
    const all = report.errors.join('\n')
    assert.match(all, /ligne 2 \(« A Fictif »\) : non mappé/)
    assert.match(all, /ligne 4 \(« B Fictif »\) : nom source en double \(déjà ligne 3\)/)
    assert.match(
      all,
      /ligne 5 \(« C Fictif »\) : author_key « k » porte plusieurs identités \(voir ligne 3\)/
    )
    assert.match(all, /existing_author_slug « inconnu » introuvable/)
    assert.match(all, /« E Fictif »\) : last_names vide/)
    assert.match(all, /« F Fictif »\) : author_key de plus de 255 caractères/)
    assert.match(all, /ligne 9 : source_name vide/)
  })

  test('name to attach missing from the CSV → error; name no longer pending → warning', async ({
    assert,
  }) => {
    await createProduction(['A Fictif', 'B Fictif'])
    const report = await S.validate(
      csv([
        { source_name: 'A Fictif', author_key: 'a', first_names: 'A', last_names: 'Fictif' },
        { source_name: 'Z Fictif', author_key: 'z', first_names: 'Z', last_names: 'Fictif' },
      ])
    )
    assert.deepEqual(report.errors, [
      'nom à rattacher absent du CSV : « B Fictif » (1 occurrence(s))',
    ])
    assert.match(report.warnings.join(), /« Z Fictif »\) : n'est plus à rattacher/)
  })

  test('warnings: homonyms, known migration_key (attach), empty first names', async ({
    assert,
  }) => {
    const migrated = await Author.create({
      firstNames: 'Awa',
      lastNames: 'Imaginaire',
      migrationKey: 'awa-imaginaire',
    })
    await createProduction(['A Fictif', 'A. Fictif', 'Awa Imaginaire', 'Seul'])
    const report = await S.validate(
      csv([
        { source_name: 'A Fictif', author_key: 'a-1', first_names: 'A', last_names: 'Fictif' },
        { source_name: 'A. Fictif', author_key: 'a-2', first_names: 'A', last_names: 'Fictif' },
        {
          source_name: 'Awa Imaginaire',
          author_key: 'awa-imaginaire',
          first_names: 'Awa',
          last_names: 'Imaginaire',
        },
        { source_name: 'Seul', author_key: 'seul', last_names: 'Seul' },
      ])
    )
    assert.deepEqual(report.errors, [])
    const all = report.warnings.join('\n')
    assert.match(all, /homonymes : a-1, a-2/)
    assert.match(all, new RegExp(`fiche existante « ${migrated.slug} » \\(migration_key\\)`))
    assert.match(all, /« Seul »\) : first_names vide/)
    assert.deepInclude(report.plan, { toCreate: 3, toAttach: 1, links: 4, productions: 1 })
  })

  test('empty CSV while names remain → errors', async ({ assert }) => {
    await createProduction(['A Fictif'])
    const report = await S.validate(HEADER)
    assert.lengthOf(report.errors, 1)
    assert.match(report.errors[0], /absent du CSV/)
  })
})
