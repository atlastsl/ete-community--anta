import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'

/** Suggestions shown under a production (FR61, D22). */
export const SUGGESTIONS_LIMIT = 4

/**
 * Elements of a jsonb array column, an empty set for anything else (D-12.4-2). No jsonb `?`
 * operator anywhere: knex would read it as a binding (P2.4).
 */
const elements = (column: string) =>
  `jsonb_array_elements_text(CASE WHEN jsonb_typeof(${column}) = 'array' THEN ${column} ELSE '[]'::jsonb END)`

/**
 * Candidates and order of P2.4 (P2-07): a published production sharing at least one author
 * (pivot), tag, subdomain or the (non null) domain with the current one, ordered by the
 * strongest shared criterion (author > tag > subdomain > domain), then the number of shared
 * elements (each distinct author, tag and subdomain, + 1 for the domain), then the Anta
 * publication date (newest first, undated last), then `id`. Positional bindings only.
 */
const SUGGESTIONS_SQL = `
WITH cur AS (SELECT id, domain, tags, subdomain FROM productions WHERE id = ?),
cand AS (
  SELECT p.id, p.anta_published_at,
    (SELECT count(*) FROM production_authors x
       JOIN production_authors y ON y.author_id = x.author_id
       WHERE x.production_id = cur.id AND y.production_id = p.id) AS n_authors,
    (SELECT count(DISTINCT t) FROM ${elements('p.tags')} t
       WHERE t IN (SELECT ${elements('cur.tags')})) AS n_tags,
    (SELECT count(DISTINCT s) FROM ${elements('p.subdomain')} s
       WHERE s IN (SELECT ${elements('cur.subdomain')})) AS n_sub,
    -- COALESCE: a NULL domain on either side yields 0, never NULL (a NULL would void the sum).
    CAST(COALESCE(p.domain = cur.domain, false) AS int) AS n_domain
  FROM productions p, cur
  WHERE p.status = ? AND p.id <> cur.id
)
SELECT id FROM cand
WHERE n_authors + n_tags + n_sub + n_domain > 0
ORDER BY CASE WHEN n_authors > 0 THEN 4 WHEN n_tags > 0 THEN 3 WHEN n_sub > 0 THEN 2 ELSE 1 END DESC,
  n_authors + n_tags + n_sub + n_domain DESC,
  anta_published_at DESC NULLS LAST,
  id ASC
LIMIT ?
`

/**
 * Similar productions (Story 12.4, P2.4): one scan of the published productions (a few
 * hundred rows), no cache. `GET /productions/:slug/suggestions` serializes the result with
 * `ProductionCardTransformer` (text cards, D37).
 */
export default class SuggestionService {
  /** Ordered ids of the suggestions of `productionId` (at most 4). */
  static async idsFor(productionId: string): Promise<string[]> {
    const result = await db.rawQuery<{ rows: { id: string }[] }>(SUGGESTIONS_SQL, [
      productionId,
      ProductionStatus.PUBLISHED,
      SUGGESTIONS_LIMIT,
    ])
    return result.rows.map((row) => row.id)
  }

  /**
   * The suggested productions in their order, with the `viewsCount` / `downloadsCount`
   * aggregates expected by the card transformer (bylines attached by the caller).
   */
  static async forProduction(productionId: string): Promise<Production[]> {
    const ids = await this.idsFor(productionId)
    if (ids.length === 0) return []
    const rows = await Production.query()
      .whereIn('id', ids)
      .where('status', ProductionStatus.PUBLISHED)
      .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
      .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
    const byId = new Map(rows.map((row) => [row.id, row]))
    return ids.flatMap((id) => byId.get(id) ?? [])
  }
}
