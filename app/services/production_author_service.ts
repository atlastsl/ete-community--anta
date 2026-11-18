import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import AuthorConversionService from '#services/author_conversion_service'

/** Attachment state of one production (rule of `AuthorConversionService.matchKey`). */
export type AttachmentState = {
  productionId: string
  /** Every non-blank jsonb name has a linked author with the same `matchKey`. */
  fullyAttached: boolean
}

/**
 * Ordered authors of a production (pivot `production_authors`, P2.1) and the derived
 * `productions.authors` jsonb (`Production.authorNames`, P2-02).
 *
 * Story 9.6: `refreshDenormalizedNames` (conversion and author renaming). `sync`
 * (production form) belongs to Story 9.7.
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
   * Blank and non-string jsonb elements are not names and are ignored.
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
      const names = AuthorConversionService.namesOf(row.authors)
      return {
        productionId: row.id,
        fullyAttached: names.every((name) => keys.has(AuthorConversionService.matchKey(name))),
      }
    })
  }

  /**
   * Productions linked to the author whose names are all attached (evaluated with the
   * current names: call it before renaming). The others keep their jsonb, so a free-text
   * name added by the old production form is never erased (D-9.6-f).
   */
  static async fullyAttachedProductionIds(
    authorId: string,
    client: QueryClientContract = db.connection()
  ): Promise<string[]> {
    const result = await client.rawQuery(
      'SELECT production_id FROM production_authors WHERE author_id = ?',
      [authorId]
    )
    const ids = (result.rows as { production_id: string }[]).map((row) => row.production_id)
    const states = await this.attachmentStates(ids, client)
    return states.filter((state) => state.fullyAttached).map((state) => state.productionId)
  }
}
