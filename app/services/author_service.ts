import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'

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
}
