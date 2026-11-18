import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import { normalizeKey } from '#helpers/normalize'

export type AffiliationInput = { institution: string; department?: string | null }

/** Validated payload of `authorValidator` (Story 9.1). */
export type AuthorPayload = {
  lastNames: string
  firstNames: string
  affiliations: AffiliationInput[]
  googleScholarUrl?: string | null
}

/** Fields compared to build the `fields` list of the `update` activity entry. */
export type AuthorField = 'lastNames' | 'firstNames' | 'googleScholarUrl' | 'affiliations'

/** Filters of the admin authors list (Story 9.2), already sanitized by the controller. */
export type AuthorListFilters = {
  /** Free search on `search_name` (normalized here). */
  q: string | null
  /** `institution_key` matched on any affiliation of the card. */
  institution: string | null
  /** `pending` = cards not public yet (`consent_confirmed_at IS NULL`). */
  consent: 'pending' | null
  /** Cards without any affiliation ("À compléter", derived, P2-03). */
  incomplete: boolean
}

export type AuthorDeleteResult = { deleted: true } | { deleted: false; productionsCount: number }

/** Trigram similarity threshold, explicit rather than the `%` operator (GUC-dependent). */
const SIMILARITY_THRESHOLD = 0.3

/** Escapes the LIKE wildcards of a normalized term (`\` is the default escape character). */
const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

function isForeignKeyViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === '23503'
}

/** Attempts when two concurrent creates pick the same free slug (check-then-insert). */
const SLUG_ATTEMPTS = 3

function isSlugConflict(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string }
  return e?.code === '23505' && e.constraint === 'authors_slug_unique'
}

const emptyToNull = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value.trim() === '' ? null : value.trim()

function normalizedAffiliations(affiliations: AffiliationInput[]) {
  return affiliations.map((a) => ({
    institution: a.institution.trim(),
    department: emptyToNull(a.department),
  }))
}

/**
 * Writes author cards and their ordered affiliations (P2.1). Reused by the photo,
 * consent, conversion and "Create an author" dialog stories.
 */
export default class AuthorService {
  /** "first names last names" with the typed case (activity `metadata.name`, D34). */
  static displayName(author: Pick<Author, 'firstNames' | 'lastNames'>): string {
    return `${author.firstNames} ${author.lastNames}`
  }

  static async create(payload: AuthorPayload, adminId: string | null): Promise<Author> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.createOnce(payload, adminId)
      } catch (error) {
        if (!isSlugConflict(error) || attempt >= SLUG_ATTEMPTS) throw error
      }
    }
  }

  private static async createOnce(payload: AuthorPayload, adminId: string | null) {
    return db.transaction(async (trx) => {
      const author = new Author()
      author.useTransaction(trx)
      author.firstNames = payload.firstNames.trim()
      author.lastNames = payload.lastNames.trim()
      author.googleScholarUrl = emptyToNull(payload.googleScholarUrl)
      author.createdById = adminId
      await author.save()
      await this.replaceAffiliations(author, payload.affiliations, trx)
      return author
    })
  }

  /** Updates the card and replaces its affiliations; returns the fields that changed. */
  static async update(
    author: Author,
    payload: AuthorPayload
  ): Promise<{ author: Author; fields: AuthorField[] }> {
    await author.load('affiliations')
    const before = {
      lastNames: author.lastNames,
      firstNames: author.firstNames,
      googleScholarUrl: author.googleScholarUrl,
      affiliations: JSON.stringify(normalizedAffiliations(author.affiliations)),
    }
    const after = {
      lastNames: payload.lastNames.trim(),
      firstNames: payload.firstNames.trim(),
      googleScholarUrl: emptyToNull(payload.googleScholarUrl),
      affiliations: JSON.stringify(normalizedAffiliations(payload.affiliations)),
    }
    const fields = (Object.keys(before) as AuthorField[]).filter(
      (key) => before[key] !== after[key]
    )
    if (fields.length === 0) return { author, fields }

    await db.transaction(async (trx) => {
      // Serializes concurrent saves of one card: without the lock, the second DELETE misses
      // the rows the first one inserted and its INSERT breaks UNIQUE (author_id, position).
      await Author.query({ client: trx }).where('id', author.id).forUpdate().firstOrFail()
      author.useTransaction(trx)
      author.lastNames = after.lastNames
      author.firstNames = after.firstNames
      author.googleScholarUrl = after.googleScholarUrl
      // An affiliations-only change leaves no dirty column: Lucid would skip the UPDATE.
      author.updatedAt = DateTime.now()
      await author.save()
      if (fields.includes('affiliations')) {
        await this.replaceAffiliations(author, payload.affiliations, trx)
      }
    })
    return { author, fields }
  }

  /**
   * DELETE + INSERT positions 1..n: never `UPDATE position` (UNIQUE (author_id, position)
   * is checked row by row, P2.1). Created through the model so `institution_key` is written.
   */
  static async replaceAffiliations(
    author: Author,
    affiliations: AffiliationInput[],
    trx: TransactionClientContract
  ): Promise<void> {
    await AuthorAffiliation.query({ client: trx }).where('authorId', author.id).delete()
    const rows = normalizedAffiliations(affiliations).map((a, index) => ({
      authorId: author.id,
      position: index + 1,
      institution: a.institution,
      department: a.department,
    }))
    if (rows.length > 0) {
      await AuthorAffiliation.createMany(rows, { client: trx })
    }
  }

  /** Pivot rows of the card, every production status included (FR55). */
  static async productionsCount(authorId: string, client?: QueryClientContract): Promise<number> {
    const row = await (client ?? db)
      .from('production_authors')
      .where('author_id', authorId)
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }

  /**
   * Deletes a card linked to no production (affiliations go by CASCADE). The row lock
   * makes a concurrent pivot INSERT (FOR KEY SHARE on the author) wait for the decision;
   * the FK RESTRICT stays the last guard and is translated into the same refusal.
   * Story 9.3 will also remove the photo here.
   */
  static async delete(author: Author): Promise<AuthorDeleteResult> {
    try {
      return await db.transaction(async (trx): Promise<AuthorDeleteResult> => {
        await Author.query({ client: trx }).where('id', author.id).forUpdate().firstOrFail()
        const productionsCount = await this.productionsCount(author.id, trx)
        if (productionsCount > 0) return { deleted: false, productionsCount }
        author.useTransaction(trx)
        await author.delete()
        return { deleted: true }
      })
    } catch (error) {
      if (!isForeignKeyViolation(error)) throw error
      return { deleted: false, productionsCount: await this.productionsCount(author.id) }
    }
  }

  /**
   * Server-side filters of the authors list (Story 9.2), combined with AND. Reusable by the
   * author search of the production form (Story 9.7, `limit(10)`).
   */
  static applyListFilters(
    query: ModelQueryBuilderContract<typeof Author>,
    filters: AuthorListFilters
  ): ModelQueryBuilderContract<typeof Author> {
    const q = filters.q ? normalizeKey(filters.q) : ''
    if (q !== '') {
      const term = escapeLike(q)
      query.where((sub) => {
        sub
          .whereRaw('authors.search_name LIKE ?', [`%${term}%`])
          .orWhereRaw('similarity(authors.search_name, ?) > ?', [q, SIMILARITY_THRESHOLD])
      })
    }
    const institution = filters.institution ? normalizeKey(filters.institution) : ''
    if (institution !== '') {
      query.whereExists((sub) =>
        sub
          .from('author_affiliations')
          .whereColumn('author_affiliations.author_id', 'authors.id')
          .where('author_affiliations.institution_key', institution)
      )
    }
    if (filters.consent === 'pending') {
      query.whereNull('authors.consent_confirmed_at')
    }
    if (filters.incomplete) {
      query.whereNotExists((sub) =>
        sub.from('author_affiliations').whereColumn('author_affiliations.author_id', 'authors.id')
      )
    }
    return query
  }

  /**
   * List order: with a search term, a word starting with the term first, then similarity;
   * always ends with last names, first names, id (stable pagination).
   */
  static applyListOrder(
    query: ModelQueryBuilderContract<typeof Author>,
    rawQ: string | null
  ): ModelQueryBuilderContract<typeof Author> {
    const q = rawQ ? normalizeKey(rawQ) : ''
    if (q !== '') {
      const term = escapeLike(q)
      query
        .orderByRaw('(authors.search_name LIKE ? OR authors.search_name LIKE ?) DESC', [
          `${term}%`,
          `% ${term}%`,
        ])
        .orderByRaw('similarity(authors.search_name, ?) DESC', [q])
    }
    return query.orderBy('last_names', 'asc').orderBy('first_names', 'asc').orderBy('id', 'asc')
  }

  /** Global counters of the quick filters (remaining work, independent of the other filters). */
  static async quickFilterCounts(): Promise<{ consentPending: number; incomplete: number }> {
    const result = await db.rawQuery(
      `SELECT
         count(*) FILTER (WHERE consent_confirmed_at IS NULL) AS consent_pending,
         count(*) FILTER (
           WHERE NOT EXISTS (SELECT 1 FROM author_affiliations aa WHERE aa.author_id = authors.id)
         ) AS incomplete
       FROM authors`
    )
    const row = result.rows[0] ?? {}
    return {
      consentPending: Number(row.consent_pending ?? 0),
      incomplete: Number(row.incomplete ?? 0),
    }
  }

  /** Institution filter options: one per key, labelled with the most frequent spelling (D14). */
  static async institutionOptions(): Promise<{ value: string; label: string }[]> {
    const result = await db.rawQuery(
      `SELECT institution_key AS value, mode() WITHIN GROUP (ORDER BY institution) AS label
       FROM author_affiliations
       GROUP BY institution_key
       ORDER BY label, value`
    )
    return (result.rows as { value: string; label: string }[]).map((r) => ({
      value: r.value,
      label: r.label,
    }))
  }
}
