import path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { normalizeKey } from '#helpers/normalize'
import Author from '#models/author'
import ProductionAuthorService from '#services/production_author_service'
import { AUTHOR_NAME_MAX } from '#validators/admin/author_validator'

/**
 * Conversion of the free-text author names (`productions.authors`) to author cards
 * (FR56, D19, architecture P2.2).
 *
 * Story 9.5: proposal and validation; Story 9.6: application and verification. Proposal,
 * validation and verification are read-only: every query runs in a `REPEATABLE READ,
 * READ ONLY` transaction that is always rolled back. `apply` writes in one transaction.
 * Every step shares `sourceKey` (CSV row ↔ jsonb name) and `matchKey` (the "attached"
 * rule, see `matchKey`).
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
/** Allowed shape of an `author_key` (future `authors.migration_key`). */
export const AUTHOR_KEY_PATTERN = /^[a-z0-9][a-z0-9'-]*$/
/** Length of a generated `author_key` before its uniqueness suffix (`-2`, `-3`…). */
export const GENERATED_KEY_MAX = 191
/** `author_key` of a group whose name has no ASCII letter or digit. */
const FALLBACK_AUTHOR_KEY = 'auteur'

const BOM = '\uFEFF'
const LIST_SEPARATOR = ' | '
const APOSTROPHES = new RegExp('[\\u2019\\u02BC\\u2018\\u00B4`]', 'g')
const DASHES = new RegExp('[\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015-]', 'g')
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g')
/** Cells a spreadsheet would run as a formula (CSV injection). */
const FORMULA_START = /^'*[=+\-@\t\r]/
/** Roman numerals I–XXXIX (generational suffixes), never last names. */
const ROMAN_NUMERAL = /^(?=[XVI])X{0,3}(IX|IV|V?I{0,3})$/
const SEVERAL_AUTHORS = /\s(et|and)\s|&|;/i

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
  /** Non-string jsonb elements (numbers, objects, null…), ignored. */
  nonString: number
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
  /** The name has no letter or digit: `key` falls back to `normalizeKey` / the name. */
  fallbackKey: boolean
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
  nonString: number
  attached: number
}

export type ParsedCsv = {
  header: string[]
  /** `cells` = number of cells of the record (must equal `header.length`). */
  records: { line: number; cells: number; values: Record<string, string> }[]
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

/** A CSV row as used by `apply`, keyed by the `sourceKey` of its `source_name`. */
type MappingRow = { authorKey: string; slug: string; firstNames: string; lastNames: string }

export type ApplyResult = {
  dryRun: boolean
  /** Cards created (`migration_key = author_key`, non-public, without affiliation). */
  created: { slug: string; migrationKey: string; firstNames: string; lastNames: string }[]
  /** Existing cards that received links: by `existing_author_slug` or `migration_key`. */
  reused: { slug: string; via: 'slug' | 'migration_key'; ignoredNames: string | null }[]
  /** Pivot rows actually created (production slug → author slug, final position). */
  links: { production: string; author: string; position: number }[]
  /** Productions whose names are now all attached (pivot rewritten, jsonb refreshed). */
  converted: string[]
  /** Productions already fully attached: untouched. */
  skipped: string[]
  /** Productions keeping names without CSV row: links written, jsonb NOT refreshed. */
  partial: { production: string; names: string[] }[]
  /** Rows of `productions` whose jsonb changed. */
  refreshed: number
}

export type ApplyOutcome = { errors: string[]; warnings: string[]; result: ApplyResult | null }

export type VerifyReport = {
  productions: number
  /** Non-blank string names of `productions.authors`. */
  occurrences: number
  attached: number
  /** Floored percentage, `100` only when every occurrence is attached. */
  rate: number
  unattached: { production: string; names: string[] }[]
  /** Positions that are not exactly 1..n. */
  positions: { production: string; positions: number[] }[]
  /** Linked authors whose name is absent from `productions.authors`. */
  desync: { production: string; authors: string[] }[]
  /** Cards without production: from the conversion (listed) or the panel (counted). */
  orphans: { migrated: string[]; panel: number }
  blank: number
  nonString: number
  complete: boolean
}

export class CsvFormatError extends Error {}

function isAllCaps(token: string): boolean {
  const letters = token.match(/\p{L}/gu) ?? []
  return letters.length >= 2 && !/\p{Ll}/u.test(token) && /\p{Lu}/u.test(token)
}

/** All-caps last name: ≥ 2 letters, no lower case, no '.', not a Roman numeral. */
function isCapsLastName(token: string): boolean {
  return isAllCaps(token) && !token.includes('.') && !ROMAN_NUMERAL.test(token)
}

function collapse(value: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
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

/** Neutralises a formula cell with a leading `'` (undone by `unescapeFormula`). */
function escapeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

function unescapeFormula(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value
}

function quote(value: string): string {
  return /[;"\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export default class AuthorConversionService {
  /**
   * Canonical source name: NFC, zero-width characters (U+200B–U+200D, U+FEFF) removed,
   * inner whitespace collapsed, trimmed; case and accents kept. A name made only of
   * such characters is blank.
   */
  static sourceKey(name: string): string {
    return collapse((name ?? '').normalize('NFC').replace(ZERO_WIDTH, ''))
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

  /**
   * Matching key of a name, never empty for a non-blank name: `groupKey`, or
   * `normalizeKey` / the trimmed name when `groupKey` is empty (names such as « - »).
   *
   * Single rule shared by the grouping of the proposal, the existing-card match and the
   * "already attached" test (D-9.5-b, reused by Story 9.6): an occurrence (production,
   * name) is attached when the production is linked in `production_authors` to an author
   * with `matchKey(search_name) === matchKey(name)` — so word order, hyphen and
   * apostrophe variants of an already-linked card count as attached.
   */
  static matchKey(name: string): string {
    return this.groupKey(name) || normalizeKey(name) || this.sourceKey(name)
  }

  /**
   * Proposed `author_key` (future `authors.migration_key`): group key tokens joined by
   * `-`, reduced to `AUTHOR_KEY_PATTERN` (other characters become `-`) and truncated to
   * `GENERATED_KEY_MAX`; `auteur` when nothing is left. Uniqueness: `groupSources`.
   */
  static authorKeyOf(groupKey: string): string {
    const key = groupKey
      .split(' ')
      .join('-')
      .replace(/[^a-z0-9'-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[^a-z0-9]+/, '')
      .slice(0, GENERATED_KEY_MAX)
      .replace(/[-']+$/, '')
    return key || FALLBACK_AUTHOR_KEY
  }

  /**
   * First/last names (P2.2, D36): « LAST, First » (single comma) splits at the comma;
   * otherwise all-caps tokens (≥ 2 letters, no '.', not a Roman numeral) = last names,
   * else the last word. Case kept as typed (D34).
   */
  static splitName(name: string): NameSplit {
    const canonical = this.sourceKey(name)
    const notes: string[] = []
    if (SEVERAL_AUTHORS.test(canonical)) notes.push('plusieurs auteurs ?')
    const commas = canonical.split(',')
    if (commas.length === 2 && commas[0].trim() && commas[1].trim()) {
      return { firstNames: commas[1].trim(), lastNames: commas[0].trim(), notes }
    }

    const tokens = canonical.split(' ').filter(Boolean)
    if (tokens.length === 0) return { firstNames: '', lastNames: '', notes }
    if (tokens.length === 1) {
      notes.push('nom seul : prénom à compléter')
      return { firstNames: '', lastNames: tokens[0], notes }
    }

    const capsAt = tokens.flatMap((token, index) => (isCapsLastName(token) ? [index] : []))
    let first: string[]
    let last: string[]
    if (capsAt.length > 0 && capsAt.length < tokens.length) {
      last = capsAt.map((index) => tokens[index])
      first = tokens.filter((_, index) => !capsAt.includes(index))
      if (capsAt[capsAt.length - 1] - capsAt[0] + 1 !== capsAt.length) {
        notes.push('découpage incertain')
      }
    } else {
      if (capsAt.length === tokens.length)
        notes.push('tout en capitales : découpage au dernier mot')
      last = tokens.slice(-1)
      first = tokens.slice(0, -1)
    }
    if (first.length >= 2 && isAllLower(first[first.length - 1]) && !isAllLower(first[0])) {
      notes.push('particule possible : vérifier le nom')
    }
    return { firstNames: first.join(' '), lastNames: last.join(' '), notes }
  }

  /**
   * Groups the source names by `matchKey` (never drops a source); the representative
   * carries the identity. `authorKey` is unique across groups (`-2`, `-3`… suffix).
   */
  static groupSources(sources: SourceName[]): SourceGroup[] {
    const byKey = new Map<string, SourceName[]>()
    for (const source of sources) {
      const key = this.matchKey(source.sourceName)
      byKey.set(key, [...(byKey.get(key) ?? []), source])
    }

    const hasCaps = (s: SourceName) => (s.sourceName.split(' ').some(isCapsLastName) ? 1 : 0)
    const usedKeys = new Set<string>()
    return [...byKey.entries()].map(([key, members]) => {
      const ordered = [...members].sort(
        (a, b) =>
          b.occurrences - a.occurrences ||
          hasCaps(b) - hasCaps(a) ||
          compare(a.sourceName, b.sourceName)
      )
      const representative = ordered[0]
      const repKey = normalizeKey(representative.sourceName)
      const base = this.authorKeyOf(key)
      let authorKey = base
      for (let n = 2; usedKeys.has(authorKey); n++) authorKey = `${base}-${n}`
      usedKeys.add(authorKey)
      return {
        key,
        authorKey,
        representative,
        members: ordered.map((source) => ({
          source,
          confidence: normalizeKey(source.sourceName) === repKey ? 'exact' : 'grouped',
        })),
        fallbackKey: !this.groupKey(representative.sourceName),
      }
    })
  }

  /**
   * Runs `fn` in a `REPEATABLE READ, READ ONLY` transaction (one snapshot for every
   * query) that is always rolled back.
   */
  static async readOnly<T>(fn: (trx: TransactionClientContract) => Promise<T>): Promise<T> {
    // Under a global transaction (tests), `transaction()` opens a savepoint, where
    // Postgres refuses to change the isolation level: READ ONLY only.
    const client = db.connection()
    const nested = client.isTransaction
    const trx = await client.transaction()
    try {
      await trx.rawQuery(
        nested
          ? 'SET TRANSACTION READ ONLY'
          : 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'
      )
      return await fn(trx)
    } finally {
      await trx.rollback()
    }
  }

  /**
   * Names of `productions.authors` (all statuses) not attached yet (rule: `matchKey`;
   * after 9.6, the jsonb is rewritten from the pivot, so converted names are
   * recognised). Only jsonb strings are names; other elements are counted.
   */
  static async collectUnattached(trx: TransactionClientContract): Promise<UnattachedNames> {
    const names = await trx.rawQuery(
      `SELECT p.id, p.slug, jsonb_typeof(e.value) = 'string' AS is_string, e.value #>> '{}' AS name
         FROM productions p
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(p.authors) = 'array' THEN p.authors ELSE '[]'::jsonb END
         ) AS e(value)`
    )
    const links = await trx.rawQuery(
      `SELECT pa.production_id, a.search_name
         FROM production_authors pa
         JOIN authors a ON a.id = pa.author_id`
    )

    const linked = new Map<string, Set<string>>()
    for (const row of links.rows as { production_id: string; search_name: string }[]) {
      const set = linked.get(row.production_id) ?? new Set<string>()
      set.add(this.matchKey(row.search_name))
      linked.set(row.production_id, set)
    }

    let blank = 0
    let nonString = 0
    let attached = 0
    const bySource = new Map<
      string,
      { occurrences: number; slugs: Set<string>; ids: Set<string> }
    >()
    type NameRow = { id: string; slug: string; is_string: boolean; name: string | null }
    for (const row of names.rows as NameRow[]) {
      if (!row.is_string) {
        nonString++
        continue
      }
      const sourceName = this.sourceKey(row.name ?? '')
      if (!sourceName) {
        blank++
        continue
      }
      if (linked.get(row.id)?.has(this.matchKey(sourceName))) {
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
    return { sources, blank, nonString, attached }
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
      const authorKeys = authors.map((author) => this.matchKey(author.searchName))

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
        nonString: unattached.nonString,
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
        if (group.fallbackKey) groupNotes.push('nom sans lettre ni chiffre : à vérifier')
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
          .map((cell) => quote(escapeFormula(cell)))
          .join(CSV_DELIMITER)
      )
    }
    return `${BOM}${lines.join('\r\n')}\r\n`
  }

  /**
   * Parses a `;` CSV (BOM optional, CRLF or LF, quoted fields with `;`, `""` or line
   * breaks, Excel `sep=;` first line skipped). Fully empty records are skipped; a leading
   * `'` added by `toCsv` before a formula character is removed. `line` = spreadsheet row
   * number (header = 1).
   */
  static parseCsv(text: string): ParsedCsv {
    if (text.includes('\uFFFD')) {
      throw new CsvFormatError('encodage non UTF-8 : réenregistrer en « CSV UTF-8 »')
    }
    let input = text.startsWith(BOM) ? text.slice(1) : text
    const sep = /^sep=(.?)[ \t]*(\r\n|\n|\r|$)/i.exec(input)
    if (sep) {
      if (sep[1] !== CSV_DELIMITER) {
        throw new CsvFormatError(
          `séparateur déclaré « ${sep[1]} » (ligne sep=) : attendu « ${CSV_DELIMITER} »`
        )
      }
      input = input.slice(sep[0].length)
    }
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
    const duplicates = [...new Set(header.filter((c, at) => c && header.indexOf(c) !== at))]
    if (duplicates.length > 0) {
      throw new CsvFormatError(`colonnes en double dans l'en-tête : ${duplicates.join(', ')}`)
    }
    const records: ParsedCsv['records'] = []
    rows.forEach((cells, index) => {
      if (cells.every((cell) => cell.trim() === '')) return
      const values: Record<string, string> = {}
      header.forEach((column, position) => {
        values[column] = unescapeFormula(cells[position] ?? '').trim()
      })
      records.push({ line: index + 2, cells: cells.length, values })
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
    const width = parsed.header.length

    for (const { line, cells, values } of parsed.records) {
      const sourceName = this.sourceKey(values.source_name)
      const authorKey = values.author_key
      const slug = values.existing_author_slug
      const firstNames = collapse(values.first_names)
      const lastNames = collapse(values.last_names)

      if (!sourceName) {
        errors.push(`ligne ${line} : source_name vide`)
        continue
      }
      const label = `ligne ${line} (« ${sourceName} »)`
      // A stale row is only ever a warning, whatever its other cells (decided first).
      const source = pending.get(sourceName)
      if (!source) {
        warnings.push(`${label} : n'est plus à rattacher (ignorée)`)
        continue
      }
      const previous = seen.get(sourceName)
      if (previous !== undefined) {
        errors.push(`${label} : nom source en double (déjà ligne ${previous})`)
        continue
      }
      seen.set(sourceName, line)
      if (cells !== width) {
        errors.push(`${label} : ${cells} cellule(s) au lieu de ${width} (colonnes décalées)`)
        continue
      }

      if (!authorKey && !slug) {
        errors.push(`${label} : non mappé (ni author_key ni existing_author_slug)`)
        continue
      }

      let valid = true
      if (authorKey.length > MIGRATION_KEY_MAX) {
        errors.push(`${label} : author_key de plus de ${MIGRATION_KEY_MAX} caractères`)
        valid = false
      } else if (authorKey && !AUTHOR_KEY_PATTERN.test(authorKey)) {
        errors.push(
          `${label} : author_key « ${authorKey} » invalide (minuscules ASCII, chiffres, « - » ou « ' », commence par une lettre ou un chiffre)`
        )
        valid = false
      }
      const migrated = authorKey ? authorsByMigrationKey.get(authorKey) : undefined
      const card = slug ? authorsBySlug.get(slug) : undefined
      if (slug) {
        if (!card) {
          errors.push(`${label} : existing_author_slug « ${slug} » introuvable`)
          valid = false
        } else {
          if (migrated && migrated.slug !== card.slug) {
            errors.push(
              `${label} : author_key « ${authorKey} » est la migration_key de la fiche « ${migrated.slug} », pas de « ${slug} »`
            )
            valid = false
          }
          if (
            (firstNames || lastNames) &&
            (firstNames !== collapse(card.firstNames) || lastNames !== collapse(card.lastNames))
          ) {
            warnings.push(
              `${label} : prénoms / noms différents de la fiche « ${slug} » (${card.firstNames} ${card.lastNames}) : ignorés, la fiche est conservée`
            )
          }
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
          if (valid) identities.set(authorKey, { identity, line })
        } else if (known.identity !== identity) {
          errors.push(
            `${label} : author_key « ${authorKey} » porte plusieurs identités (voir ligne ${known.line})`
          )
          valid = false
        }
      }
      if (!valid) continue

      if (authorKey && !slug) {
        const nameKey = normalizeKey(`${firstNames} ${lastNames}`)
        keysByName.set(nameKey, (keysByName.get(nameKey) ?? new Set()).add(authorKey))
        if (migrated && !warnedMigrationKeys.has(authorKey)) {
          warnedMigrationKeys.add(authorKey)
          warnings.push(
            `author_key « ${authorKey} » : fiche existante « ${migrated.slug} » (migration_key), rattachement`
          )
        }
      }
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

  /** Names of a `productions.authors` value: non-blank strings, canonical (`sourceKey`). */
  static namesOf(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => this.sourceKey(item))
      .filter(Boolean)
  }

  /** Absolute path of `file` (relative to `appRoot`) when it lies inside `tmp/`, else null. */
  static resolveUnderTmp(appRoot: string, file: string): string | null {
    const target = path.isAbsolute(file) ? file : path.join(appRoot, file)
    const relative = path.relative(path.join(appRoot, 'tmp'), target)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
    return target
  }

  /** CSV rows keyed by `sourceKey(source_name)` (first row wins; `validate` ran first). */
  private static mappingOf(text: string): Map<string, MappingRow> {
    const rows = new Map<string, MappingRow>()
    for (const { values } of this.parseCsv(text).records) {
      const sourceName = this.sourceKey(values.source_name)
      if (!sourceName || rows.has(sourceName)) continue
      rows.set(sourceName, {
        authorKey: values.author_key ?? '',
        slug: values.existing_author_slug ?? '',
        firstNames: collapse(values.first_names),
        lastNames: collapse(values.last_names),
      })
    }
    return rows
  }

  /**
   * Applies a validated conversion CSV (Story 9.6, P2.2). The CSV is validated again
   * first: on errors nothing is written. Then, in one transaction (productions locked):
   * cards upserted by `migration_key` (never overwritten) or reused by slug (never
   * written), pivot rewritten in the jsonb order (duplicates linked once, at their first
   * occurrence, positions 1..n), fully attached productions skipped, and
   * `refreshDenormalizedNames` on the productions now fully attached. `dryRun` computes
   * the same result and rolls back. No activity log entry (no acting admin).
   */
  static async apply(text: string, options: { dryRun?: boolean } = {}): Promise<ApplyOutcome> {
    const { errors, warnings } = await this.validate(text)
    if (errors.length > 0) return { errors, warnings, result: null }
    const mapping = this.mappingOf(text)
    const dryRun = options.dryRun === true

    const trx = await db.transaction()
    try {
      const result = await this.applyIn(trx, mapping, dryRun)
      if (dryRun) await trx.rollback()
      else await trx.commit()
      return { errors, warnings, result }
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  private static async applyIn(
    trx: TransactionClientContract,
    mapping: Map<string, MappingRow>,
    dryRun: boolean
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      dryRun,
      created: [],
      reused: [],
      links: [],
      converted: [],
      skipped: [],
      partial: [],
      refreshed: 0,
    }
    // Locks every production: an edit through the old form waits for the conversion.
    const productions = await trx.rawQuery(
      'SELECT id, slug, authors FROM productions ORDER BY slug, id FOR UPDATE'
    )
    const linkRows = await trx.rawQuery(
      `SELECT pa.production_id, pa.author_id, a.slug, a.search_name
         FROM production_authors pa
         JOIN authors a ON a.id = pa.author_id
        ORDER BY pa.production_id, pa.position`
    )
    type Link = { authorId: string; slug: string; key: string }
    const linksOf = new Map<string, Link[]>()
    for (const row of linkRows.rows as any[]) {
      linksOf.set(row.production_id, [
        ...(linksOf.get(row.production_id) ?? []),
        { authorId: row.author_id, slug: row.slug, key: this.matchKey(row.search_name) },
      ])
    }

    const authors = await this.existingAuthors(trx)
    const bySlug = new Map(authors.map((author) => [author.slug, author]))
    const byMigrationKey = new Map(
      authors.filter((a) => a.migrationKey).map((a) => [a.migrationKey as string, a])
    )
    const slugOf = new Map(authors.map((author) => [author.id, author.slug]))
    const targets = new Map<string, string>()

    const resolve = async (row: MappingRow): Promise<string> => {
      const cacheKey = row.slug ? `slug:${row.slug}` : `key:${row.authorKey}`
      const cached = targets.get(cacheKey)
      if (cached) return cached
      let id: string
      if (row.slug) {
        const card = bySlug.get(row.slug)
        if (!card) throw new Error(`existing_author_slug « ${row.slug} » introuvable`)
        id = card.id
        result.reused.push({ slug: card.slug, via: 'slug', ignoredNames: null })
      } else {
        const card = byMigrationKey.get(row.authorKey)
        if (card) {
          id = card.id
          const same =
            collapse(card.firstNames) === row.firstNames &&
            collapse(card.lastNames) === row.lastNames
          result.reused.push({
            slug: card.slug,
            via: 'migration_key',
            ignoredNames: same ? null : `${row.firstNames} ${row.lastNames}`.trim(),
          })
        } else {
          const author = await Author.create(
            {
              firstNames: row.firstNames,
              lastNames: row.lastNames,
              migrationKey: row.authorKey,
              createdById: null,
              consentConfirmedAt: null,
              consentConfirmedById: null,
            },
            { client: trx }
          )
          id = author.id
          slugOf.set(author.id, author.slug)
          result.created.push({
            slug: author.slug,
            migrationKey: row.authorKey,
            firstNames: row.firstNames,
            lastNames: row.lastNames,
          })
        }
      }
      targets.set(cacheKey, id)
      return id
    }

    const toRefresh: string[] = []
    type ProductionRow = { id: string; slug: string; authors: unknown }
    for (const production of productions.rows as ProductionRow[]) {
      const names = this.namesOf(production.authors)
      if (names.length === 0) continue
      const existing = linksOf.get(production.id) ?? []
      const linkedByKey = new Map<string, string>()
      for (const link of existing) {
        if (!linkedByKey.has(link.key)) linkedByKey.set(link.key, link.authorId)
      }

      const order: string[] = []
      const missing: string[] = []
      let newlyAttached = false
      for (const name of names) {
        let authorId = linkedByKey.get(this.matchKey(name))
        if (!authorId) {
          const row = mapping.get(name)
          if (!row) {
            if (!missing.includes(name)) missing.push(name)
            continue
          }
          authorId = await resolve(row)
          newlyAttached = true
        }
        if (!order.includes(authorId)) order.push(authorId)
      }

      if (!newlyAttached) {
        if (missing.length > 0) result.partial.push({ production: production.slug, names: missing })
        else result.skipped.push(production.slug)
        continue
      }

      // Existing links whose name is not in the jsonb are kept, at the end (D-9.6-g).
      for (const link of existing) {
        if (!order.includes(link.authorId)) order.push(link.authorId)
      }
      const before = existing.map((link) => link.authorId)
      if (before.join(',') !== order.join(',')) {
        // Ordered table: DELETE + INSERT, never UPDATE of positions (P2.1).
        await trx.rawQuery('DELETE FROM production_authors WHERE production_id = ?', [
          production.id,
        ])
        await trx.rawQuery(
          `INSERT INTO production_authors (production_id, author_id, position)
           SELECT (e->>'p')::uuid, (e->>'a')::uuid, (e->>'n')::smallint
             FROM jsonb_array_elements(?::jsonb) AS e
           ON CONFLICT DO NOTHING`,
          [
            JSON.stringify(
              order.map((authorId, index) => ({ p: production.id, a: authorId, n: index + 1 }))
            ),
          ]
        )
        order.forEach((authorId, index) => {
          if (!before.includes(authorId)) {
            result.links.push({
              production: production.slug,
              author: slugOf.get(authorId) ?? authorId,
              position: index + 1,
            })
          }
        })
      }

      if (missing.length > 0) {
        // Refreshing would erase the free-text names left (D-9.6-e).
        result.partial.push({ production: production.slug, names: missing })
      } else {
        toRefresh.push(production.id)
        result.converted.push(production.slug)
      }
    }

    result.refreshed = await ProductionAuthorService.refreshDenormalizedNames(toRefresh, trx)
    return result
  }

  /** Text report of `apply` (contains names: written under `tmp/` only, never committed). */
  static formatApplyReport(
    result: ApplyResult,
    meta: { file: string; date: Date; warnings?: string[] }
  ): string {
    const lines: string[] = [
      `Conversion des auteurs — ${result.dryRun ? 'SIMULATION (--dry-run, transaction annulée)' : 'APPLICATION'}`,
      `Date : ${meta.date.toISOString()}`,
      `Fichier : ${meta.file}`,
      '',
      `Fiches créées : ${result.created.length}`,
      `Fiches existantes utilisées : ${result.reused.length}`,
      `Liens créés : ${result.links.length}`,
      `Productions converties : ${result.converted.length}`,
      `Productions ignorées (déjà rattachées) : ${result.skipped.length}`,
      `Productions partiellement rattachées : ${result.partial.length}`,
      `productions.authors réécrits : ${result.refreshed}`,
    ]
    const section = (title: string, items: string[]) => {
      lines.push('', `## ${title} (${items.length})`)
      lines.push(...(items.length > 0 ? items.map((item) => `- ${item}`) : ['(aucune)']))
    }
    section(
      'Fiches créées',
      result.created.map((c) =>
        `${c.slug} [migration_key ${c.migrationKey}] ${c.firstNames} ${c.lastNames}`.trim()
      )
    )
    section(
      'Fiches existantes utilisées',
      result.reused.map(
        (r) =>
          `${r.slug} (par ${r.via === 'slug' ? 'existing_author_slug' : 'migration_key'})` +
          (r.ignoredNames ? ` : noms du CSV ignorés « ${r.ignoredNames} », fiche conservée` : '')
      )
    )
    section(
      'Liens créés',
      result.links.map((l) => `${l.production} → ${l.author} (position ${l.position})`)
    )
    section('Productions ignorées (déjà rattachées)', result.skipped)
    section(
      'Productions partiellement rattachées (noms sans ligne CSV, productions.authors non réécrit)',
      result.partial.map((p) => `${p.production} : ${p.names.map((n) => `« ${n} »`).join(', ')}`)
    )
    if (meta.warnings && meta.warnings.length > 0)
      section('Avertissements du contrôle', meta.warnings)
    return `${lines.join('\n')}\n`
  }

  /**
   * Checks the conversion (read-only): names of `productions.authors` without a linked
   * author (`matchKey`), positions other than 1..n, linked authors missing from the jsonb,
   * orphan cards. `complete` = 100 % attached, no position or desync issue (D-9.6-h).
   */
  static async verify(): Promise<VerifyReport> {
    return this.readOnly(async (trx) => {
      const productions = await trx.rawQuery(
        'SELECT id, slug, authors FROM productions ORDER BY slug, id'
      )
      const links = await trx.rawQuery(
        `SELECT pa.production_id, pa.position, a.slug, a.search_name
           FROM production_authors pa
           JOIN authors a ON a.id = pa.author_id
          ORDER BY pa.production_id, pa.position`
      )
      const orphans = await trx.rawQuery(
        `SELECT a.slug, a.migration_key
           FROM authors a
          WHERE NOT EXISTS (SELECT 1 FROM production_authors pa WHERE pa.author_id = a.id)
          ORDER BY a.slug`
      )

      type LinkRow = { position: number; slug: string; key: string }
      const linksOf = new Map<string, LinkRow[]>()
      for (const row of links.rows as any[]) {
        linksOf.set(row.production_id, [
          ...(linksOf.get(row.production_id) ?? []),
          { position: Number(row.position), slug: row.slug, key: this.matchKey(row.search_name) },
        ])
      }

      const report: VerifyReport = {
        productions: productions.rows.length,
        occurrences: 0,
        attached: 0,
        rate: 100,
        unattached: [],
        positions: [],
        desync: [],
        orphans: { migrated: [], panel: 0 },
        blank: 0,
        nonString: 0,
        complete: false,
      }
      for (const production of productions.rows as {
        id: string
        slug: string
        authors: unknown
      }[]) {
        const elements = Array.isArray(production.authors) ? production.authors : []
        for (const element of elements) {
          if (typeof element !== 'string') report.nonString++
          else if (!this.sourceKey(element)) report.blank++
        }
        const names = this.namesOf(production.authors)
        const linked = linksOf.get(production.id) ?? []
        const keys = new Set(linked.map((link) => link.key))
        const missing = names.filter((name) => !keys.has(this.matchKey(name)))
        report.occurrences += names.length
        report.attached += names.length - missing.length
        if (missing.length > 0) {
          report.unattached.push({ production: production.slug, names: [...new Set(missing)] })
        }
        const positions = linked.map((link) => link.position)
        if (positions.some((position, index) => position !== index + 1)) {
          report.positions.push({ production: production.slug, positions })
        }
        const nameKeys = new Set(names.map((name) => this.matchKey(name)))
        const absent = linked.filter((link) => !nameKeys.has(link.key)).map((link) => link.slug)
        if (absent.length > 0) report.desync.push({ production: production.slug, authors: absent })
      }
      for (const row of orphans.rows as { slug: string; migration_key: string | null }[]) {
        if (row.migration_key) report.orphans.migrated.push(row.slug)
        else report.orphans.panel++
      }
      report.rate =
        report.occurrences === 0
          ? 100
          : Math.floor((report.attached * 10000) / report.occurrences) / 100
      report.complete =
        report.attached === report.occurrences &&
        report.positions.length === 0 &&
        report.desync.length === 0
      return report
    })
  }
}
