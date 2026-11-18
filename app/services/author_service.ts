import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import string from '@adonisjs/core/helpers/string'
import { DateTime } from 'luxon'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import { normalizeKey } from '#helpers/normalize'
import FileStorageService from '#services/file_storage_service'
import { AUTHOR_PHOTO_VARIANTS, type ImageVariant } from '#services/image_service'

export type AffiliationInput = { institution: string; department?: string | null }

/** Validated payload of `authorValidator` (Story 9.1). */
export type AuthorPayload = {
  lastNames: string
  firstNames: string
  affiliations: AffiliationInput[]
  googleScholarUrl?: string | null
}

/** Fields compared to build the `fields` list of the `update` activity entry. */
export type AuthorField = 'lastNames' | 'firstNames' | 'googleScholarUrl' | 'affiliations' | 'photo'

/** Photo options of `update` (Story 9.3): a new photo wins over `removePhoto`. */
export type AuthorPhotoOptions = { photo?: ImageVariant[] | null; removePhoto?: boolean }

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

/** Only the pivot RESTRICT means "linked to a production"; other FKs (9.3+) must surface. */
function isProductionLinkViolation(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string }
  return e?.code === '23503' && e.constraint === 'production_authors_author_id_foreign'
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

  /** R2 keys of the variants stored under a `photo_key` prefix. */
  static photoKeys(prefix: string): string[] {
    return AUTHOR_PHOTO_VARIANTS.map((variant) => `${prefix}/${variant.name}`)
  }

  /**
   * Creates the card. The id is generated first so the photo variants can be uploaded
   * under `authors/<id>/<token>` before the INSERT (P2.5); they are removed again when
   * the creation fails. Slug retries reuse the same id and prefix (rolled back INSERT).
   */
  static async create(
    payload: AuthorPayload,
    adminId: string | null,
    photo?: ImageVariant[] | null
  ): Promise<Author> {
    const id = randomUUID()
    const prefix = photo ? await this.uploadPhoto(id, photo) : null
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.createOnce(id, payload, adminId, prefix)
      } catch (error) {
        if (!isSlugConflict(error) || attempt >= SLUG_ATTEMPTS) {
          await this.discardPhoto(prefix)
          throw error
        }
      }
    }
  }

  private static async createOnce(
    id: string,
    payload: AuthorPayload,
    adminId: string | null,
    photoKey: string | null
  ) {
    return db.transaction(async (trx) => {
      const author = new Author()
      author.useTransaction(trx)
      author.id = id
      author.photoKey = photoKey
      author.firstNames = payload.firstNames.trim()
      author.lastNames = payload.lastNames.trim()
      author.googleScholarUrl = emptyToNull(payload.googleScholarUrl)
      author.createdById = adminId
      await author.save()
      await this.replaceAffiliations(author, payload.affiliations, trx)
      return author
    })
  }

  /**
   * Updates the card, replaces its affiliations and adds, replaces or removes its photo;
   * returns the fields that changed. New variants are uploaded before the transaction
   * (removed if it fails); the replaced ones are deleted after the commit (best-effort).
   */
  static async update(
    author: Author,
    payload: AuthorPayload,
    options: AuthorPhotoOptions = {}
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
    const fields: AuthorField[] = (Object.keys(before) as (keyof typeof before)[]).filter(
      (key) => before[key] !== after[key]
    )
    const photo = options.photo && options.photo.length > 0 ? options.photo : null
    const photoChange = photo ? 'replace' : options.removePhoto && author.photoKey ? 'remove' : null
    if (photoChange) fields.push('photo')
    if (fields.length === 0) return { author, fields }

    const newPrefix = photo ? await this.uploadPhoto(author.id, photo) : null
    let oldPrefix: string | null = null
    try {
      await db.transaction(async (trx) => {
        // Serializes concurrent saves of one card: without the lock, the second DELETE misses
        // the rows the first one inserted and its INSERT breaks UNIQUE (author_id, position).
        // The locked row also gives the photo actually being replaced (not the stale instance).
        const locked = await Author.query({ client: trx })
          .where('id', author.id)
          .forUpdate()
          .firstOrFail()
        author.useTransaction(trx)
        author.lastNames = after.lastNames
        author.firstNames = after.firstNames
        author.googleScholarUrl = after.googleScholarUrl
        if (photoChange) {
          oldPrefix = locked.photoKey
          author.photoKey = newPrefix
        }
        // An affiliations-only change leaves no dirty column: Lucid would skip the UPDATE.
        author.updatedAt = DateTime.now()
        await author.save()
        if (fields.includes('affiliations')) {
          await this.replaceAffiliations(author, payload.affiliations, trx)
        }
      })
    } catch (error) {
      await this.discardPhoto(newPrefix)
      throw error
    }
    if (oldPrefix && oldPrefix !== newPrefix) await this.discardPhoto(oldPrefix)
    return { author, fields }
  }

  /** Uploads the variants under a fresh prefix; on a failed upload, removes the sent ones. */
  private static async uploadPhoto(authorId: string, variants: ImageVariant[]): Promise<string> {
    const prefix = `authors/${authorId}/${string.generateRandom(20)}`
    const results = await Promise.allSettled(
      variants.map((variant) =>
        FileStorageService.putObject(`${prefix}/${variant.name}`, variant.body, variant.contentType)
      )
    )
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) {
      const sent = variants
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((variant) => `${prefix}/${variant.name}`)
      await this.deleteKeys(sent)
      throw (failure as PromiseRejectedResult).reason
    }
    return prefix
  }

  /** Best-effort removal of the variants of a prefix: failures are logged, never thrown. */
  private static async discardPhoto(prefix: string | null): Promise<void> {
    if (!prefix) return
    await this.deleteKeys(this.photoKeys(prefix))
  }

  private static async deleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      const failures = await FileStorageService.deleteObjects(keys)
      for (const { key, error } of failures) {
        logger.error({ err: error, keys: [key] }, 'Failed to delete author photo variants')
      }
    } catch (error) {
      logger.error({ err: error, keys }, 'Failed to delete author photo variants')
    }
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
   * The photo variants are deleted after the commit only (best-effort); a refusal keeps them.
   */
  static async delete(author: Author): Promise<AuthorDeleteResult> {
    try {
      let photoKey: string | null = null
      const result = await db.transaction(async (trx): Promise<AuthorDeleteResult> => {
        const locked = await Author.query({ client: trx })
          .where('id', author.id)
          .forUpdate()
          .firstOrFail()
        const productionsCount = await this.productionsCount(author.id, trx)
        if (productionsCount > 0) return { deleted: false, productionsCount }
        photoKey = locked.photoKey
        author.useTransaction(trx)
        await author.delete()
        return { deleted: true }
      })
      if (result.deleted) await this.discardPhoto(photoKey)
      return result
    } catch (error) {
      if (!isProductionLinkViolation(error)) throw error
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
    if (filters.q?.trim() && q === '') {
      // A term made only of stripped characters (`-`, `'`) matches nothing, not everything.
      query.whereRaw('false')
    } else if (q !== '') {
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
       WHERE institution_key <> ''
       GROUP BY institution_key
       ORDER BY label, value`
    )
    return (result.rows as { value: string; label: string }[]).map((r) => ({
      value: r.value,
      label: r.label,
    }))
  }
}
