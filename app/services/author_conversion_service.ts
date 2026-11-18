import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { normalizeKey } from '#helpers/normalize'
import { AUTHOR_NAME_MAX } from '#validators/admin/author_validator'

/**
 * Conversion of the free-text author names (`productions.authors`) to author cards
 * (FR56, D19, architecture P2.2) — Story 9.5: proposal and validation only.
 *
 * Both steps are read-only: every query runs in a `READ ONLY` transaction that is
 * always rolled back. Writing (`authors:apply`) belongs to Story 9.6, which must reuse
 * `sourceKey` (CSV row ↔ jsonb name) and the "attached" rule of `collectUnattached`.
 */

/** Exact column order of the conversion CSV (P2.2). */
export const CSV_COLUMNS = [
  'source_name',
  'occurrences',
  'productions',
  'author_key',
  'first_names',
  'last_names',
  'existing_author_slug',
  'confidence',
  'note',
] as const

/** Columns `authors:validate` cannot work without; the others are informative. */
export const REQUIRED_COLUMNS = [
  'source_name',
  'author_key',
  'first_names',
  'last_names',
  'existing_author_slug',
] as const

export const CSV_DELIMITER = ';'
/** Similarity above which two groups are flagged (never merged). */
export const FUZZY_THRESHOLD = 0.6
/** `authors.migration_key` is a varchar(255). */
export const MIGRATION_KEY_MAX = 255

const BOM = '\uFEFF'
const LIST_SEPARATOR = ' | '
const APOSTROPHES = new RegExp('[\\u2019\\u02BC\\u2018\\u00B4`]', 'g')
const DASHES = new RegExp('[\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015-]', 'g')

export type Confidence = 'exact' | 'grouped' | 'fuzzy'

/** A distinct (canonical) source name still to attach. */
export type SourceName = {
  sourceName: string
  occurrences: number
  /** Production slugs, sorted. */
  productions: string[]
  productionIds: string[]
}

export type UnattachedNames = {
  sources: SourceName[]
  /** Blank strings found in the jsonb arrays (ignored). */
  blank: number
  /** Occurrences already attached through the pivot. */
  attached: number
}

export type ExistingAuthor = {
  id: string
  slug: string
  firstNames: string
  lastNames: string
  searchName: string
  migrationKey: string | null
}

export type NameSplit = { firstNames: string; lastNames: string; notes: string[] }

export type SourceGroup = {
  key: string
  authorKey: string
  representative: SourceName
  members: { source: SourceName; confidence: 'exact' | 'grouped' }[]
}

export type ProposalRow = {
  sourceName: string
  occurrences: number
  productions: string[]
  authorKey: string
  firstNames: string
  lastNames: string
  existingAuthorSlug: string
  confidence: Confidence
  note: string
}

export type ProposalSummary = {
  sourceNames: number
  groups: number
  exact: number
  grouped: number
  fuzzy: number
  existingAuthors: number
  blank: number
  attached: number
}

export type ParsedCsv = {
  header: string[]
  records: { line: number; values: Record<string, string> }[]
}

export type ValidationPlan = {
  /** Cards that `apply` would create (distinct `author_key`). */
  toCreate: number
  /** Existing cards that would receive links (slug or known `migration_key`). */
  toAttach: number
  /** Mapped source names still to attach. */
  sourceNames: number
  /** Pivot rows (production × card) that would be created. */
  links: number
  /** Productions that would receive at least one link. */
  productions: number
}

export type ValidationReport = { errors: string[]; warnings: string[]; plan: ValidationPlan }

export class CsvFormatError extends Error {}

function isAllCaps(token: string): boolean {
  const letters = token.match(/\p{L}/gu) ?? []
  return letters.length >= 2 && !/\p{Ll}/u.test(token) && /\p{Lu}/u.test(token)
}

function isAllLower(token: string): boolean {
  return /^\p{Ll}+$/u.test(token)
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function formatScore(score: number): string {
  return score.toFixed(2).replace('.', ',')
}

function quote(value: string): string {
  return /[;"\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export default class AuthorConversionService {
  /** Canonical source name: trimmed, inner whitespace collapsed; case and accents kept. */
  static sourceKey(name: string): string {
    return (name ?? '').replace(/\s+/g, ' ').trim()
  }

  /**
   * Grouping key of the proposal (`confidence=grouped`): `normalizeKey`, apostrophes
   * unified, dashes as spaces, tokens sorted. Deliberately more tolerant than
   * `normalizeKey`, which stays the key of `search_name` / `institution_key`.
   */
  static groupKey(name: string): string {
    return normalizeKey(name)
      .replace(APOSTROPHES, "'")
      .replace(DASHES, ' ')
      .split(' ')
      .filter(Boolean)
      .sort(compare)
      .join(' ')
  }

  /** Proposed `author_key` (future `authors.migration_key`): group key tokens joined by `-`. */
  static authorKeyOf(groupKey: string): string {
    return groupKey.split(' ').join('-')
  }

  /**
   * First/last names (P2.2, D36): all-caps tokens = last names; otherwise the last
   * word. Case kept as typed (D34).
   */
  static splitName(name: string): NameSplit {
    const tokens = this.sourceKey(name).split(' ').filter(Boolean)
    const notes: string[] = []
    if (tokens.length === 0) return { firstNames: '', lastNames: '', notes }
    if (tokens.length === 1) {
      notes.push('nom seul : prénom à compléter')
      return { firstNames: '', lastNames: tokens[0], notes }
    }

    const caps = tokens.filter(isAllCaps)
    let first: string[]
    let last: string[]
    if (caps.length > 0 && caps.length < tokens.length) {
      last = caps
      first = tokens.filter((token) => !isAllCaps(token))
    } else {
      if (caps.length === tokens.length) notes.push('tout en capitales : découpage au dernier mot')
      last = tokens.slice(-1)
      first = tokens.slice(0, -1)
    }
    if (first.length >= 2 && isAllLower(first[first.length - 1]) && !isAllLower(first[0])) {
      notes.push('particule possible : vérifier le nom')
    }
    return { firstNames: first.join(' '), lastNames: last.join(' '), notes }
  }

  /** Groups the source names by `groupKey`; the representative carries the identity. */
  static groupSources(sources: SourceName[]): SourceGroup[] {
    const byKey = new Map<string, SourceName[]>()
    for (const source of sources) {
      const key = this.groupKey(source.sourceName)
      if (!key) continue
      byKey.set(key, [...(byKey.get(key) ?? []), source])
    }

    const hasCaps = (s: SourceName) => (s.sourceName.split(' ').some(isAllCaps) ? 1 : 0)
    return [...byKey.entries()].map(([key, members]) => {
      const ordered = [...members].sort(
        (a, b) =>
          b.occurrences - a.occurrences ||
          hasCaps(b) - hasCaps(a) ||
          compare(a.sourceName, b.sourceName)
      )
      const representative = ordered[0]
      const repKey = normalizeKey(representative.sourceName)
      return {
        key,
        authorKey: this.authorKeyOf(key),
        representative,
        members: ordered.map((source) => ({
          source,
          confidence: normalizeKey(source.sourceName) === repKey ? 'exact' : 'grouped',
        })),
      }
    })
  }

  /** Runs `fn` in a read-only transaction that is always rolled back. */
  static async readOnly<T>(fn: (trx: TransactionClientContract) => Promise<T>): Promise<T> {
    const trx = await db.transaction()
    try {
      await trx.rawQuery('SET TRANSACTION READ ONLY')
      return await fn(trx)
    } finally {
      await trx.rollback()
    }
  }

  /**
   * Names of `productions.authors` (all statuses) not attached yet. An occurrence
   * (production, name) is attached when the production is linked in the pivot to an
   * author whose `search_name` equals `normalizeKey(name)` (after 9.6, the jsonb is
   * rewritten from the pivot, so converted names are recognised).
   */
  static async collectUnattached(trx: TransactionClientContract): Promise<UnattachedNames> {
    const names = await trx.rawQuery(
      `SELECT p.id, p.slug, e.name
         FROM productions p
         CROSS JOIN LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(p.authors) = 'array' THEN p.authors ELSE '[]'::jsonb END
         ) AS e(name)`
    )
    const links = await trx.rawQuery(
      `SELECT pa.production_id, a.search_name
         FROM production_authors pa
         JOIN authors a ON a.id = pa.author_id`
    )

    const linked = new Map<string, Set<string>>()
    for (const row of links.rows as { production_id: string; search_name: string }[]) {
      const set = linked.get(row.production_id) ?? new Set<string>()
      set.add(row.search_name)
      linked.set(row.production_id, set)
    }

    let blank = 0
    let attached = 0
    const bySource = new Map<
      string,
      { occurrences: number; slugs: Set<string>; ids: Set<string> }
    >()
    for (const row of names.rows as { id: string; slug: string; name: string | null }[]) {
      const sourceName = this.sourceKey(row.name ?? '')
      if (!sourceName) {
        blank++
        continue
      }
      if (linked.get(row.id)?.has(normalizeKey(sourceName))) {
        attached++
        continue
      }
      const entry = bySource.get(sourceName) ?? { occurrences: 0, slugs: new Set(), ids: new Set() }
      entry.occurrences++
      entry.slugs.add(row.slug)
      entry.ids.add(row.id)
      bySource.set(sourceName, entry)
    }

    const sources = [...bySource.entries()]
      .map(([sourceName, entry]) => ({
        sourceName,
        occurrences: entry.occurrences,
        productions: [...entry.slugs].sort(compare),
        productionIds: [...entry.ids],
      }))
      .sort((a, b) => compare(a.sourceName, b.sourceName))
    return { sources, blank, attached }
  }

  static async existingAuthors(trx: TransactionClientContract): Promise<ExistingAuthor[]> {
    const result = await trx.rawQuery(
      `SELECT id, slug, first_names, last_names, search_name, migration_key FROM authors ORDER BY slug`
    )
    return (result.rows as any[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      firstNames: row.first_names,
      lastNames: row.last_names,
      searchName: row.search_name,
      migrationKey: row.migration_key,
    }))
  }

  /**
   * `pg_trgm` similarity (explicit `similarity()`, not the GUC-dependent `%`) above
   * `FUZZY_THRESHOLD`. Without `others`: pairs within `keys` (i < j); with `others`:
   * every (keys[i], others[j]). Indexes are 0-based.
   */
  static async similarPairs(
    trx: TransactionClientContract,
    keys: string[],
    others?: string[]
  ): Promise<{ a: number; b: number; score: number }[]> {
    if (keys.length === 0 || (others && others.length === 0)) return []
    const result = await trx.rawQuery(
      `SELECT a.i AS a, b.i AS b, similarity(a.k, b.k) AS score
         FROM jsonb_array_elements_text(?::jsonb) WITH ORDINALITY AS a(k, i)
         JOIN jsonb_array_elements_text(?::jsonb) WITH ORDINALITY AS b(k, i)
           ON ${others ? 'a.k <> b.k' : 'a.i < b.i'}
        WHERE similarity(a.k, b.k) > ?`,
      [JSON.stringify(keys), JSON.stringify(others ?? keys), FUZZY_THRESHOLD]
    )
    return (result.rows as any[]).map((row) => ({
      a: Number(row.a) - 1,
      b: Number(row.b) - 1,
      score: Number(row.score),
    }))
  }

  /** Builds the proposal (read-only). */
  static async propose(): Promise<{ rows: ProposalRow[]; summary: ProposalSummary }> {
    return this.readOnly(async (trx) => {
      const unattached = await this.collectUnattached(trx)
      const authors = await this.existingAuthors(trx)
      const groups = this.groupSources(unattached.sources)
      const keys = groups.map((group) => group.key)
      const authorKeys = authors.map((author) => this.groupKey(author.searchName))

      const fuzzy = new Map<number, string[]>()
      const addFuzzy = (index: number, text: string) =>
        fuzzy.set(index, [...(fuzzy.get(index) ?? []), text])
      for (const pair of await this.similarPairs(trx, keys)) {
        const score = formatScore(pair.score)
        addFuzzy(
          pair.a,
          `proche de « ${groups[pair.b].representative.sourceName} » (${score}) : non fusionné`
        )
        addFuzzy(
          pair.b,
          `proche de « ${groups[pair.a].representative.sourceName} » (${score}) : non fusionné`
        )
      }

      const nearAuthors = new Map<number, string[]>()
      for (const pair of await this.similarPairs(trx, keys, authorKeys)) {
        const text = `proche de la fiche existante « ${authors[pair.b].slug} » (${formatScore(pair.score)})`
        nearAuthors.set(pair.a, [...(nearAuthors.get(pair.a) ?? []), text])
      }

      const authorsByKey = new Map<string, ExistingAuthor[]>()
      authors.forEach((author, index) => {
        authorsByKey.set(authorKeys[index], [
          ...(authorsByKey.get(authorKeys[index]) ?? []),
          author,
        ])
      })

      const summary: ProposalSummary = {
        sourceNames: unattached.sources.length,
        groups: groups.length,
        exact: 0,
        grouped: 0,
        fuzzy: 0,
        existingAuthors: 0,
        blank: unattached.blank,
        attached: unattached.attached,
      }

      const rows: ProposalRow[] = []
      groups.forEach((group, index) => {
        const matches = authorsByKey.get(group.key) ?? []
        const existing = matches.length === 1 ? matches[0] : null
        const split = this.splitName(group.representative.sourceName)
        const identity = existing
          ? { firstNames: existing.firstNames, lastNames: existing.lastNames }
          : split
        const groupNotes: string[] = []
        if (existing) {
          groupNotes.push('fiche existante')
          summary.existingAuthors++
        } else {
          groupNotes.push(...split.notes)
          if (matches.length > 1) {
            groupNotes.push(
              `plusieurs fiches existantes : ${matches.map((m) => m.slug).join(', ')}`
            )
          }
        }
        groupNotes.push(...(nearAuthors.get(index) ?? []))
        const fuzzyNotes = fuzzy.get(index) ?? []

        for (const member of group.members) {
          const notes: string[] = []
          if (member.confidence === 'grouped') {
            notes.push(`regroupé avec « ${group.representative.sourceName} »`)
          }
          notes.push(...fuzzyNotes, ...groupNotes)
          const confidence: Confidence = fuzzyNotes.length > 0 ? 'fuzzy' : member.confidence
          summary[confidence]++
          rows.push({
            sourceName: member.source.sourceName,
            occurrences: member.source.occurrences,
            productions: member.source.productions,
            authorKey: group.authorKey,
            firstNames: identity.firstNames,
            lastNames: identity.lastNames,
            existingAuthorSlug: existing?.slug ?? '',
            confidence,
            note: notes.join(LIST_SEPARATOR),
          })
        }
      })

      rows.sort(
        (a, b) =>
          compare(normalizeKey(a.lastNames), normalizeKey(b.lastNames)) ||
          compare(normalizeKey(a.firstNames), normalizeKey(b.firstNames)) ||
          compare(a.authorKey, b.authorKey) ||
          b.occurrences - a.occurrences ||
          compare(a.sourceName, b.sourceName)
      )
      return { rows, summary }
    })
  }

  /** CSV of the proposal: UTF-8 BOM, `;`, CRLF, RFC 4180 quoting. */
  static toCsv(rows: ProposalRow[]): string {
    const lines = [CSV_COLUMNS.join(CSV_DELIMITER)]
    for (const row of rows) {
      lines.push(
        [
          row.sourceName,
          String(row.occurrences),
          row.productions.join(LIST_SEPARATOR),
          row.authorKey,
          row.firstNames,
          row.lastNames,
          row.existingAuthorSlug,
          row.confidence,
          row.note,
        ]
          .map(quote)
          .join(CSV_DELIMITER)
      )
    }
    return `${BOM}${lines.join('\r\n')}\r\n`
  }

  /**
   * Parses a `;` CSV (BOM optional, CRLF or LF, quoted fields with `;`, `""` or line
   * breaks). Fully empty records are skipped. `line` = spreadsheet row number.
   */
  static parseCsv(text: string): ParsedCsv {
    const input = text.startsWith(BOM) ? text.slice(1) : text
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false
    let i = 0
    while (i < input.length) {
      const char = input[i]
      if (inQuotes) {
        if (char === '"') {
          if (input[i + 1] === '"') {
            field += '"'
            i += 2
            continue
          }
          inQuotes = false
        } else {
          field += char
        }
        i++
        continue
      }
      if (char === '"' && field === '') {
        inQuotes = true
      } else if (char === CSV_DELIMITER) {
        row.push(field)
        field = ''
      } else if (char === '\n' || char === '\r') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        if (char === '\r' && input[i + 1] === '\n') i++
      } else {
        field += char
      }
      i++
    }
    if (inQuotes) throw new CsvFormatError('guillemet non fermé dans le CSV')
    if (field !== '' || row.length > 0) {
      row.push(field)
      rows.push(row)
    }

    const headerRow = rows.shift()
    if (!headerRow || headerRow.every((cell) => cell.trim() === '')) {
      throw new CsvFormatError('CSV vide : en-tête absent')
    }
    if (headerRow.length < 2) {
      throw new CsvFormatError(`séparateur attendu « ${CSV_DELIMITER} » dans l'en-tête`)
    }
    const header = headerRow.map((cell) => cell.trim())
    const records: ParsedCsv['records'] = []
    rows.forEach((cells, index) => {
      if (cells.every((cell) => cell.trim() === '')) return
      const values: Record<string, string> = {}
      header.forEach((column, position) => {
        values[column] = (cells[position] ?? '').trim()
      })
      records.push({ line: index + 2, values })
    })
    return { header, records }
  }

  /** Checks an edited CSV against the database (read-only) and computes the plan. */
  static async validate(text: string): Promise<ValidationReport> {
    const errors: string[] = []
    const warnings: string[] = []
    const plan: ValidationPlan = {
      toCreate: 0,
      toAttach: 0,
      sourceNames: 0,
      links: 0,
      productions: 0,
    }

    let parsed: ParsedCsv
    try {
      parsed = this.parseCsv(text)
    } catch (error) {
      if (error instanceof CsvFormatError) return { errors: [error.message], warnings, plan }
      throw error
    }
    const missing = REQUIRED_COLUMNS.filter((column) => !parsed.header.includes(column))
    if (missing.length > 0) {
      return { errors: [`colonnes requises absentes : ${missing.join(', ')}`], warnings, plan }
    }

    const { unattached, authors } = await this.readOnly(async (trx) => ({
      unattached: await this.collectUnattached(trx),
      authors: await this.existingAuthors(trx),
    }))
    const authorsBySlug = new Map(authors.map((author) => [author.slug, author]))
    const authorsByMigrationKey = new Map(
      authors.filter((a) => a.migrationKey).map((a) => [a.migrationKey as string, a])
    )
    const pending = new Map(unattached.sources.map((source) => [source.sourceName, source]))

    const seen = new Map<string, number>()
    const identities = new Map<string, { identity: string; line: number }>()
    const keysByName = new Map<string, Set<string>>()
    const warnedMigrationKeys = new Set<string>()
    const mapped: { source: SourceName; target: string }[] = []

    for (const { line, values } of parsed.records) {
      const sourceName = this.sourceKey(values.source_name)
      const authorKey = values.author_key
      const slug = values.existing_author_slug
      const firstNames = values.first_names
      const lastNames = values.last_names

      if (!sourceName) {
        errors.push(`ligne ${line} : source_name vide`)
        continue
      }
      const label = `ligne ${line} (« ${sourceName} »)`
      const previous = seen.get(sourceName)
      if (previous !== undefined) {
        errors.push(`${label} : nom source en double (déjà ligne ${previous})`)
        continue
      }
      seen.set(sourceName, line)

      if (!authorKey && !slug) {
        errors.push(`${label} : non mappé (ni author_key ni existing_author_slug)`)
        continue
      }

      let valid = true
      if (authorKey.length > MIGRATION_KEY_MAX) {
        errors.push(`${label} : author_key de plus de ${MIGRATION_KEY_MAX} caractères`)
        valid = false
      }
      if (slug) {
        if (!authorsBySlug.has(slug)) {
          errors.push(`${label} : existing_author_slug « ${slug} » introuvable`)
          valid = false
        }
      } else {
        if (!lastNames) {
          errors.push(`${label} : last_names vide`)
          valid = false
        } else if (!firstNames) {
          warnings.push(`${label} : first_names vide (fiche à compléter)`)
        }
        if (firstNames.length > AUTHOR_NAME_MAX || lastNames.length > AUTHOR_NAME_MAX) {
          errors.push(`${label} : prénoms ou noms de plus de ${AUTHOR_NAME_MAX} caractères`)
          valid = false
        }
      }

      if (authorKey) {
        const identity = [slug, firstNames, lastNames].join('\u0000')
        const known = identities.get(authorKey)
        if (!known) {
          identities.set(authorKey, { identity, line })
        } else if (known.identity !== identity) {
          errors.push(
            `${label} : author_key « ${authorKey} » porte plusieurs identités (voir ligne ${known.line})`
          )
          valid = false
        }
        if (!slug) {
          const nameKey = normalizeKey(`${firstNames} ${lastNames}`)
          keysByName.set(nameKey, (keysByName.get(nameKey) ?? new Set()).add(authorKey))
        }
        const migrated = authorsByMigrationKey.get(authorKey)
        if (migrated && !slug && !warnedMigrationKeys.has(authorKey)) {
          warnedMigrationKeys.add(authorKey)
          warnings.push(
            `author_key « ${authorKey} » : fiche existante « ${migrated.slug} » (migration_key), rattachement`
          )
        }
      }

      const source = pending.get(sourceName)
      if (!source) {
        warnings.push(`${label} : n'est plus à rattacher (ignorée)`)
        continue
      }
      if (!valid) continue
      const migrated = authorKey ? authorsByMigrationKey.get(authorKey) : undefined
      const target = slug ? `slug:${slug}` : migrated ? `slug:${migrated.slug}` : `key:${authorKey}`
      mapped.push({ source, target })
    }

    for (const source of unattached.sources) {
      if (!seen.has(source.sourceName)) {
        errors.push(
          `nom à rattacher absent du CSV : « ${source.sourceName} » (${source.occurrences} occurrence(s))`
        )
      }
    }
    for (const keys of keysByName.values()) {
      if (keys.size > 1) {
        warnings.push(`homonymes : ${[...keys].sort(compare).join(', ')} → fiches distinctes`)
      }
    }

    const targets = new Set(mapped.map((entry) => entry.target))
    const byProduction = new Map<string, Set<string>>()
    for (const { source, target } of mapped) {
      for (const id of source.productionIds) {
        byProduction.set(id, (byProduction.get(id) ?? new Set()).add(target))
      }
    }
    plan.toCreate = [...targets].filter((t) => t.startsWith('key:')).length
    plan.toAttach = targets.size - plan.toCreate
    plan.sourceNames = mapped.length
    plan.productions = byProduction.size
    plan.links = [...byProduction.values()].reduce((sum, set) => sum + set.size, 0)

    return { errors, warnings, plan }
  }
}
