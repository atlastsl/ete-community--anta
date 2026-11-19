import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'
import AuthorService from '#services/author_service'
import { normalizeKey } from '#helpers/normalize'

/** Sorts of the profile's productions (P2.6); `date` is the default, omitted from the URL. */
export const AUTHOR_PROFILE_SORTS = ['date', 'views', 'downloads', 'title'] as const
export type AuthorProfileSort = (typeof AUTHOR_PROFILE_SORTS)[number]
export const DEFAULT_AUTHOR_PROFILE_SORT: AuthorProfileSort = 'date'
export const AUTHOR_PROFILE_PER_PAGE = 12

/** Sorts of the authors list (P2.3, P2.6); `views` (365-day window) is the default. */
export const AUTHORS_LIST_SORTS = ['views', 'name', 'productions'] as const
export type AuthorsListSort = (typeof AUTHORS_LIST_SORTS)[number]
export const DEFAULT_AUTHORS_LIST_SORT: AuthorsListSort = 'views'
export const AUTHORS_LIST_PER_PAGE = 24
/** Longest search term kept (longer input is truncated, D-10.5-8). */
const MAX_QUERY_LENGTH = 100

/** Filters of `/authors`, raw strings from the URL (`institution` = label, normalized here). */
export type AuthorsListFilters = {
  q: string | null
  institution: string | null
  domain: string | null
}

/** Rolling 365-day window of the rankings (P2.3), computed by Postgres. */
const WINDOW = "now() - interval '365 days'"

export type AuthorProfileStats = { views: number; downloads: number; productions: number }

/**
 * Public side of the author referential (Epic 10). Visibility rule (P2.1, D11): a profile is
 * visible when the consent is confirmed **and** at least one published production is linked;
 * anything else is a 404 for the visitor. Nothing is cached: a withdrawn consent or the
 * unpublishing of the last production hides the profile on the next request (D17).
 */
export default class PublicAuthorService {
  /**
   * Slugs of the given authors that are visible on the site (`Author.visibleOnSite`), by id.
   * Only visible authors' slugs are ever read: the others stay unlinked (D12, P2.7).
   */
  static async visibleSlugs(authorIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(authorIds)]
    if (ids.length === 0) return new Map()
    const rows = await Author.query()
      .whereIn('id', ids)
      .withScopes((scopes) => scopes.visibleOnSite())
      .select('id', 'slug')
    return new Map(rows.map((author) => [author.id, author.slug]))
  }

  /** Visible author by slug, affiliations preloaded in their `position` order; else `null`. */
  static findVisibleBySlug(slug: string): Promise<Author | null> {
    return Author.query()
      .where('slug', slug)
      .withScopes((scopes) => scopes.visibleOnSite())
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

  /** Ids of the visible authors (`Author.visibleOnSite`), as a sub-query of the facets. */
  private static visibleAuthorIds() {
    return Author.query()
      .withScopes((scopes) => scopes.visibleOnSite())
      .select('authors.id')
  }

  /**
   * One page of the visible authors (Story 10.5, FR57), aggregates computed in the same query
   * (no N+1): published productions, primary institution (affiliation position 1), and one
   * LATERAL pass over the views of the published productions giving the total (D3) and the
   * 365-day window (default sort, P2.3 without `HAVING`: 0-view authors come last). Search and
   * institution reuse the admin filters (normalized `search_name`, any affiliation's key).
   */
  static list(filters: AuthorsListFilters, sort: AuthorsListSort, page: number) {
    const published = ProductionStatus.PUBLISHED
    const query = Author.query()
      .withScopes((scopes) => scopes.visibleOnSite())
      .joinRaw(
        `LEFT JOIN LATERAL (
           SELECT count(*) AS total_views,
                  count(*) FILTER (WHERE v.recorded_at >= ${WINDOW}) AS window_views
             FROM stats_views v
             JOIN production_authors pa ON pa.production_id = v.production_id
             JOIN productions p ON p.id = pa.production_id AND p.status = ?
            WHERE pa.author_id = authors.id) AS sv ON true`,
        [published]
      )
      .select('authors.id', 'authors.slug', 'authors.first_names', 'authors.last_names')
      .select('authors.photo_key', 'authors.consent_confirmed_at')
      .select('sv.total_views', 'sv.window_views')
      .select(
        db.raw(
          `(SELECT count(*) FROM production_authors pa
              JOIN productions p ON p.id = pa.production_id AND p.status = ?
             WHERE pa.author_id = authors.id) AS published_count`,
          [published]
        ),
        db.raw(
          `(SELECT aa.institution FROM author_affiliations aa
             WHERE aa.author_id = authors.id ORDER BY aa.position ASC LIMIT 1) AS primary_institution`
        )
      )

    AuthorService.applyListFilters(query, {
      q: filters.q,
      institution: filters.institution,
      consent: null,
      incomplete: false,
    })
    if (filters.domain) {
      const domain = filters.domain
      query.whereExists((sub) =>
        sub
          .from('production_authors')
          .join('productions', 'productions.id', 'production_authors.production_id')
          .whereColumn('production_authors.author_id', 'authors.id')
          .where('productions.status', published)
          .where('productions.domain', domain)
      )
    }

    if (sort === 'views') query.orderBy('sv.window_views', 'desc')
    else if (sort === 'productions') query.orderBy('published_count', 'desc')
    // Ties (and the `name` sort): last names, first names, then id (stable pagination).
    query
      .orderBy('authors.last_names', 'asc')
      .orderBy('authors.first_names', 'asc')
      .orderBy('authors.id', 'asc')

    return query.paginate(page, AUTHORS_LIST_PER_PAGE)
  }

  /** Card of the list from a `list()` row (aggregates read from `$extras`). */
  static listCard(author: Author) {
    return {
      slug: author.slug,
      firstNames: author.firstNames,
      lastNames: author.lastNames,
      primaryInstitution: (author.$extras.primary_institution as string | null) ?? null,
      productionsCount: Number(author.$extras.published_count ?? 0),
      viewsCount: Number(author.$extras.total_views ?? 0),
    }
  }

  /**
   * Institution facet (D14): affiliations of the visible authors (shared scope) grouped by
   * `institution_key`, labelled with the most frequent spelling. The value is the label (P2.6,
   * normalized back to the key by the filter).
   */
  static async institutionOptions(): Promise<{ value: string; label: string }[]> {
    const rows = await db
      .from('author_affiliations as aa')
      .whereIn('aa.author_id', this.visibleAuthorIds())
      .whereNot('aa.institution_key', '')
      .groupBy('aa.institution_key')
      .select(db.raw('mode() WITHIN GROUP (ORDER BY aa.institution) AS label'))
      .orderBy('label', 'asc')
    return (rows as { label: string }[]).map((r) => ({ value: r.label, label: r.label }))
  }

  /** Domain facet: domains of the published productions of the visible authors (shared scope). */
  static async domainOptions(): Promise<string[]> {
    const rows = await db
      .from('productions as p')
      .join('production_authors as pa', 'pa.production_id', 'p.id')
      .whereIn('pa.author_id', this.visibleAuthorIds())
      .where('p.status', ProductionStatus.PUBLISHED)
      .whereNotNull('p.domain')
      .whereNot('p.domain', '')
      .distinct('p.domain')
      .orderBy('p.domain', 'asc')
    return (rows as { domain: string }[]).map((r) => r.domain)
  }

  /** At least one visible author (empty state « Aucun auteur pour le moment. »). */
  static async hasVisibleAuthors(): Promise<boolean> {
    const row = await this.visibleAuthorIds().first()
    return row !== null
  }

  /** Whitelisted list sort, default `views`. */
  static parseListSort(input: unknown): AuthorsListSort {
    return (AUTHORS_LIST_SORTS as readonly unknown[]).includes(input)
      ? (input as AuthorsListSort)
      : DEFAULT_AUTHORS_LIST_SORT
  }

  /**
   * Strings only (a repeated parameter is ignored), trimmed, empty → null; `q` truncated to 100
   * code points (never a split surrogate pair).
   */
  static parseListFilters(input: {
    q?: unknown
    institution?: unknown
    domain?: unknown
  }): AuthorsListFilters {
    const str = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() !== '' ? value.trim() : null
    const q = str(input.q)
    return {
      q: q ? Array.from(q).slice(0, MAX_QUERY_LENGTH).join('').trim() : null,
      institution: str(input.institution),
      domain: str(input.domain),
    }
  }

  /**
   * Filters restricted to the offered facet values: an institution matching an option (by key)
   * becomes its canonical label; an unknown institution or domain is dropped (`null`, no
   * filtering), so the URL, the selects and the results always agree.
   */
  static knownFilters(
    requested: AuthorsListFilters,
    institutionOptions: { value: string; label: string }[],
    domainOptions: string[]
  ): AuthorsListFilters {
    const key = requested.institution ? normalizeKey(requested.institution) : ''
    const institution = key
      ? (institutionOptions.find((o) => normalizeKey(o.value) === key)?.value ?? null)
      : null
    const domain =
      requested.domain && domainOptions.includes(requested.domain) ? requested.domain : null
    return { q: requested.q, institution, domain }
  }

  /**
   * List URL keeping the known parameters (defaults, empty filters and page 1 omitted). Same rules
   * as the front builder `inertia/lib/authors_list_query.ts` (TS boundary: keep both in sync).
   */
  static authorsListPath(filters: AuthorsListFilters, sort: AuthorsListSort, page: number): string {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.institution) params.set('institution', filters.institution)
    if (filters.domain) params.set('domain', filters.domain)
    if (sort !== DEFAULT_AUTHORS_LIST_SORT) params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return `/authors${qs ? `?${qs}` : ''}`
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
