import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'

/** Sorts of the profile's productions (P2.6); `date` is the default, omitted from the URL. */
export const AUTHOR_PROFILE_SORTS = ['date', 'views', 'downloads', 'title'] as const
export type AuthorProfileSort = (typeof AUTHOR_PROFILE_SORTS)[number]
export const DEFAULT_AUTHOR_PROFILE_SORT: AuthorProfileSort = 'date'
export const AUTHOR_PROFILE_PER_PAGE = 12

export type AuthorProfileStats = { views: number; downloads: number; productions: number }

/**
 * Public side of the author referential (Epic 10). Visibility rule (P2.1, D11): a profile is
 * visible when the consent is confirmed **and** at least one published production is linked;
 * anything else is a 404 for the visitor. Nothing is cached: a withdrawn consent or the
 * unpublishing of the last production hides the profile on the next request (D17).
 */
export default class PublicAuthorService {
  /** Visible author by slug, affiliations preloaded in their `position` order; else `null`. */
  static findVisibleBySlug(slug: string): Promise<Author | null> {
    return Author.query()
      .where('slug', slug)
      .whereNotNull('consent_confirmed_at')
      .whereHas('productions', (q) => q.where('status', ProductionStatus.PUBLISHED))
      .preload('affiliations')
      .first()
  }

  /**
   * Totals of the author's **published** productions (FR58): views, downloads, count. The
   * pivot key `(production_id, author_id)` guarantees one row per production.
   */
  static async stats(authorId: string): Promise<AuthorProfileStats> {
    const published = ProductionStatus.PUBLISHED
    const result = await db.rawQuery(
      `SELECT
         (SELECT count(*) FROM production_authors pa
            JOIN productions p ON p.id = pa.production_id AND p.status = :published
           WHERE pa.author_id = :authorId) AS productions,
         (SELECT count(*) FROM stats_views v
            JOIN production_authors pa ON pa.production_id = v.production_id
            JOIN productions p ON p.id = pa.production_id AND p.status = :published
           WHERE pa.author_id = :authorId) AS views,
         (SELECT count(*) FROM stats_downloads d
            JOIN production_authors pa ON pa.production_id = d.production_id
            JOIN productions p ON p.id = pa.production_id AND p.status = :published
           WHERE pa.author_id = :authorId) AS downloads`,
      { authorId, published }
    )
    const row = result.rows[0] ?? {}
    return {
      views: Number(row.views ?? 0),
      downloads: Number(row.downloads ?? 0),
      productions: Number(row.productions ?? 0),
    }
  }

  /** One page of the author's published productions with the card aggregates (totals). */
  static productions(authorId: string, sort: AuthorProfileSort, page: number) {
    const query = Production.query()
      .where('status', ProductionStatus.PUBLISHED)
      .whereExists((sub) =>
        sub
          .from('production_authors')
          .whereColumn('production_authors.production_id', 'productions.id')
          .where('production_authors.author_id', authorId)
      )
      .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
      .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))

    if (sort === 'views') {
      query.orderBy('viewsCount', 'desc')
    } else if (sort === 'downloads') {
      query.orderBy('downloadsCount', 'desc')
    } else if (sort === 'title') {
      query.orderByRaw('lower(title) asc')
    } else {
      // Date of the work, undated last; then publication on Anta.
      query
        .orderByRaw('work_published_at desc nulls last')
        .orderByRaw('anta_published_at desc nulls last')
    }
    // Deterministic tie-break: stable pagination on equal values.
    query.orderBy('id', 'asc')

    return query.paginate(page, AUTHOR_PROFILE_PER_PAGE)
  }

  /** Whitelisted sort, default `date` (an unknown value is ignored, never an error). */
  static parseSort(input: unknown): AuthorProfileSort {
    return (AUTHOR_PROFILE_SORTS as readonly unknown[]).includes(input)
      ? (input as AuthorProfileSort)
      : DEFAULT_AUTHOR_PROFILE_SORT
  }

  /** Positive safe integer, else 1 (`0`, `-1`, `abc`, `1.5`, `1e21`). */
  static parsePage(input: unknown): number {
    const value = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : Number.NaN
    return Number.isSafeInteger(value) && value >= 1 ? value : 1
  }

  /**
   * The URL when it parses as `http:` / `https:`, else `null`: a stored `javascript:` or
   * `data:` value never reaches an `href` (the admin validator already restricts it).
   */
  static safeHttpUrl(value: string | null): string | null {
    if (!value) return null
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:' ? value : null
    } catch {
      return null
    }
  }

  /**
   * Profile URL keeping only the known parameters (default sort and page 1 omitted). Same rules as the
   * front builder `inertia/lib/author_profile_query.ts` (TS boundary: keep both in sync).
   */
  static profilePath(slug: string, sort: AuthorProfileSort, page: number): string {
    const params = new URLSearchParams()
    if (sort !== DEFAULT_AUTHOR_PROFILE_SORT) params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return `/authors/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`
  }
}
