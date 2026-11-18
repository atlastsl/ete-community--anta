import db from '@adonisjs/lucid/services/db'
import { errors as vineErrors } from '@vinejs/vine'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuthorConversionService from '#services/author_conversion_service'

/** Attachment state of one production (rule of `AuthorConversionService.matchKey`). */
export type AttachmentState = {
  productionId: string
  /**
   * At least one usable name, no non-text value (non-array, non-string element) and every
   * non-blank jsonb name has a linked author with the same `matchKey`.
   */
  fullyAttached: boolean
}

/** Outcome of `sync`. */
export type SyncResult = {
  /** Unconverted production (jsonb names, no link) saved without authors: nothing written. */
  protected: boolean
  /** Pivot rows rewritten (the selection or its order changed). */
  changed: boolean
}

/** Error of an unknown author id, reported on the `authorIds` field of the production form. */
export function unknownAuthorError() {
  return new vineErrors.E_VALIDATION_ERROR([
    { field: 'authorIds', message: 'productions.form.errors.author_unknown', rule: 'exists' },
  ])
}

/**
 * Ordered authors of a production (pivot `production_authors`, P2.1) and the derived
 * `productions.authors` jsonb (`Production.authorNames`, P2-02): the only writer of that
 * column.
 *
 * Story 9.6: `refreshDenormalizedNames` (conversion and author renaming). Story 9.7: `sync`
 * (production form) and `count` (FR21).
 */
export default class ProductionAuthorService {
  /**
   * Rewrites `productions.authors` from the pivot in one SQL statement: names
   * "first names last names" in position order, `[]` for an empty pivot (NOT NULL
   * column). Only rows whose value changes are updated; `updated_at` is left untouched
   * (derived data). The `productions_search_vector_update` trigger recomputes the
   * search vector of the updated rows. Returns the number of rows updated.
   */
  static async refreshDenormalizedNames(
    productionIds: string[],
    client: QueryClientContract = db.connection()
  ): Promise<number> {
    const ids = [...new Set(productionIds)]
    if (ids.length === 0) return 0
    // Ids passed as jsonb: knex would expand a JS array into a list of bindings.
    const result = await client.rawQuery(
      `UPDATE productions p
          SET authors = sub.names
         FROM (
           SELECT pr.id,
                  COALESCE(
                    (SELECT jsonb_agg(btrim(a.first_names || ' ' || a.last_names) ORDER BY pa.position)
                       FROM production_authors pa
                       JOIN authors a ON a.id = pa.author_id
                      WHERE pa.production_id = pr.id),
                    '[]'::jsonb
                  ) AS names
             FROM productions pr
            WHERE pr.id IN (SELECT (jsonb_array_elements_text(?::jsonb))::uuid)
         ) AS sub
        WHERE p.id = sub.id
          AND p.authors IS DISTINCT FROM sub.names`,
      [JSON.stringify(ids)]
    )
    return result.rowCount ?? 0
  }

  /**
   * Attachment state of the given productions (unknown ids are absent from the result).
   * Blank strings are ignored; a non-text value (non-array, non-string element) or an
   * empty name list is never fully attached (no vacuous "every"): the refresh would drop
   * those values.
   */
  static async attachmentStates(
    productionIds: string[],
    client: QueryClientContract = db.connection()
  ): Promise<AttachmentState[]> {
    const ids = [...new Set(productionIds)]
    if (ids.length === 0) return []
    const json = JSON.stringify(ids)
    const productions = await client.rawQuery(
      `SELECT p.id, p.authors
         FROM productions p
        WHERE p.id IN (SELECT (jsonb_array_elements_text(?::jsonb))::uuid)`,
      [json]
    )
    const links = await client.rawQuery(
      `SELECT pa.production_id, a.search_name
         FROM production_authors pa
         JOIN authors a ON a.id = pa.author_id
        WHERE pa.production_id IN (SELECT (jsonb_array_elements_text(?::jsonb))::uuid)`,
      [json]
    )
    const linked = new Map<string, Set<string>>()
    for (const row of links.rows as { production_id: string; search_name: string }[]) {
      const set = linked.get(row.production_id) ?? new Set<string>()
      set.add(AuthorConversionService.matchKey(row.search_name))
      linked.set(row.production_id, set)
    }
    return (productions.rows as { id: string; authors: unknown }[]).map((row) => {
      const keys = linked.get(row.id) ?? new Set<string>()
      const { names, nonText } = AuthorConversionService.inspectAuthors(row.authors)
      return {
        productionId: row.id,
        fullyAttached:
          !nonText &&
          names.length > 0 &&
          names.every((name) => keys.has(AuthorConversionService.matchKey(name))),
      }
    })
  }

  /**
   * Productions linked to the author whose names are all attached (evaluated with the
   * current names: call it before renaming). The candidate rows are locked first
   * (`SELECT … FOR UPDATE`, by id, in the caller's transaction): an edit through the old
   * form cannot add a free-text name between this check and the refresh. The others keep
   * their jsonb, so a free-text name is never erased (D-9.6-f).
   */
  static async fullyAttachedProductionIds(
    authorId: string,
    trx: TransactionClientContract
  ): Promise<string[]> {
    const result = await trx.rawQuery(
      `SELECT p.id
         FROM productions p
        WHERE p.id IN (SELECT production_id FROM production_authors WHERE author_id = ?)
        ORDER BY p.id
          FOR UPDATE`,
      [authorId]
    )
    const ids = (result.rows as { id: string }[]).map((row) => row.id)
    const states = await this.attachmentStates(ids, trx)
    return states.filter((state) => state.fullyAttached).map((state) => state.productionId)
  }

  /**
   * Replaces the ordered authors of a production (production form, Story 9.7) inside the
   * caller's transaction, then refreshes `productions.authors`.
   *
   * - The production row is locked first (`FOR UPDATE`) and every decision is taken on the
   *   locked row and the current links.
   * - Unconverted production (non-empty jsonb, no link) saved with an empty selection:
   *   nothing is written, so the legacy names are never erased by mistake.
   * - The cards are read `FOR SHARE` (a concurrent delete waits); an unknown id raises a
   *   validation error on `authorIds` (the caller's transaction is rolled back).
   * - Same ids in the same order: the pivot is left as is; otherwise `DELETE` + `INSERT`
   *   with positions 1..n (never an `UPDATE` of positions, P2.1).
   * - The jsonb is always refreshed (`IS DISTINCT FROM`: no-op when already in sync).
   */
  static async sync(
    productionId: string,
    authorIds: string[],
    trx: TransactionClientContract
  ): Promise<SyncResult> {
    const ids = [...new Set(authorIds)]
    const locked = await trx.rawQuery(
      `SELECT id, authors FROM productions WHERE id = ? FOR UPDATE`,
      [productionId]
    )
    const production = locked.rows[0] as { id: string; authors: unknown } | undefined
    if (!production) throw new Error(`Production ${productionId} not found`)

    const links = await trx.rawQuery(
      `SELECT author_id FROM production_authors WHERE production_id = ? ORDER BY position`,
      [productionId]
    )
    const current = (links.rows as { author_id: string }[]).map((row) => row.author_id)

    if (ids.length === 0 && current.length === 0) {
      const { names, nonText } = AuthorConversionService.inspectAuthors(production.authors)
      if (names.length > 0 || nonText) return { protected: true, changed: false }
    }

    if (ids.length > 0) {
      const found = await trx.rawQuery(
        `SELECT id FROM authors
          WHERE id IN (SELECT (jsonb_array_elements_text(?::jsonb))::uuid)
            FOR SHARE`,
        [JSON.stringify(ids)]
      )
      if (found.rows.length !== ids.length) throw unknownAuthorError()
    }

    const changed = ids.length !== current.length || ids.some((id, index) => id !== current[index])
    if (changed) {
      await trx.rawQuery(`DELETE FROM production_authors WHERE production_id = ?`, [productionId])
      if (ids.length > 0) {
        await trx.rawQuery(
          `INSERT INTO production_authors (production_id, author_id, position)
           SELECT ?, (e.value)::uuid, e.ordinality
             FROM jsonb_array_elements_text(?::jsonb) WITH ORDINALITY AS e(value, ordinality)`,
          [productionId, JSON.stringify(ids)]
        )
      }
    }
    await this.refreshDenormalizedNames([productionId], trx)
    return { protected: false, changed }
  }

  /** Pivot rows of a production (FR21: at least one author to publish). */
  static async count(
    productionId: string,
    client: QueryClientContract = db.connection()
  ): Promise<number> {
    const row = await client
      .from('production_authors')
      .where('production_id', productionId)
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }
}
