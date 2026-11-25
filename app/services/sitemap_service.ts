import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import ProductionStatus from '#enums/production_status'

/** Protocol limit of URLs in one sitemap file (sitemaps.org 0.9). */
export const SITEMAP_MAX_URLS = 50_000

/** One `<url>` of the sitemap: absolute `loc`, optional last modification. */
export type SitemapEntry = { loc: string; lastmod: DateTime | null }

/** `appUrl` without trailing slash + `path` (same rule as `SeoService`). */
export function absoluteUrl(appUrl: string, path: string): string {
  return `${appUrl.trim().replace(/\/+$/, '')}${path}`
}

/** Escapes the five XML special characters (text and attribute safe). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** W3C Datetime in UTC to the second (`2026-11-25T10:00:00Z`), `null` for an invalid date. */
export function w3cDate(value: DateTime | null): string | null {
  if (!value || !value.isValid) return null
  return value.toUTC().startOf('second').toISO({ suppressMilliseconds: true, includeOffset: true })
}

/** Raw aggregate value (`Date` from pg, or a string) → `DateTime`, `null` when absent. */
function toDateTime(value: unknown): DateTime | null {
  if (value instanceof Date) return DateTime.fromJSDate(value)
  if (typeof value === 'string' && value) {
    const sql = DateTime.fromSQL(value)
    return sql.isValid ? sql : DateTime.fromISO(value)
  }
  if (DateTime.isDateTime(value)) return value
  return null
}

/**
 * Keeps the first `limit` entries (output order = priority: fixed pages, productions, profiles,
 * D-13.3-4); `truncated` tells whether anything was dropped.
 */
export function truncate<T>(entries: T[], limit: number): { entries: T[]; truncated: boolean } {
  const max = Math.max(0, Math.floor(limit))
  return entries.length > max
    ? { entries: entries.slice(0, max), truncated: true }
    : { entries, truncated: false }
}

/** Truncation is logged once per process, not on every crawler hit (review of 13.3). */
let truncationLogged = false

/** Most recent of the given dates, `null` when none is valid. */
function latest(dates: (DateTime | null | undefined)[]): DateTime | null {
  let result: DateTime | null = null
  for (const date of dates) {
    if (date && date.isValid && (!result || date > result)) result = date
  }
  return result
}

/**
 * Sitemap of the public site (Story 13.3, P2.7, FR36): home, `/productions`, `/authors`,
 * published productions and public author profiles. Visibility comes from the same rules as
 * the pages themselves — `status = published` for productions, `Author.visibleOnSite` (consent +
 * ≥ 1 published production) for authors — so nothing the site answers with a 404 is listed.
 */
export default class SitemapService {
  /**
   * Entries in output order: fixed pages, productions (newest first), author profiles. The
   * limit is pushed into SQL (one extra row per query detects an overflow) and rows are plain
   * objects (no model hydration): the response stays cheap whatever the catalogue size.
   */
  static async entries(appUrl: string, limit = SITEMAP_MAX_URLS): Promise<SitemapEntry[]> {
    const FIXED_PAGES = 3
    const budget = Math.max(0, limit - FIXED_PAGES)

    const productions: {
      slug: string
      updated_at: Date | null
      anta_published_at: Date | null
      created_at: Date | null
    }[] = await db
      .from('productions')
      .where('status', ProductionStatus.PUBLISHED)
      .select('slug', 'updated_at', 'anta_published_at', 'created_at')
      .orderByRaw('anta_published_at desc nulls last')
      .orderBy('id', 'asc')
      .limit(budget + 1)

    const authorBudget = Math.max(0, budget - productions.length)
    const authors = await Author.query()
      .withScopes((scopes) => scopes.visibleOnSite())
      .select('slug', 'updated_at')
      .withAggregate('productions', (q) =>
        q
          .where('status', ProductionStatus.PUBLISHED)
          .max('productions.updated_at')
          .as('last_production_update')
      )
      .orderBy('slug', 'asc')
      .limit(authorBudget + 1)
      .pojo<{ slug: string; updated_at: unknown; last_production_update: unknown }>()

    const productionEntries: SitemapEntry[] = productions.map((production) => ({
      loc: absoluteUrl(appUrl, `/productions/${encodeURIComponent(production.slug)}`),
      // `updated_at` is set on every save (publish / unpublish too); fallbacks for legacy rows.
      lastmod: toDateTime(
        production.updated_at ?? production.anta_published_at ?? production.created_at
      ),
    }))

    const authorEntries: SitemapEntry[] = authors.map((author) => ({
      loc: absoluteUrl(appUrl, `/authors/${encodeURIComponent(author.slug)}`),
      lastmod: latest([toDateTime(author.updated_at), toDateTime(author.last_production_update)]),
    }))

    // Over the limit, list lastmods come from the rows kept (approximation, D-13.3-4).
    const productionsLastmod = latest(productionEntries.map((entry) => entry.lastmod))
    const fixed: SitemapEntry[] = [
      { loc: absoluteUrl(appUrl, '/'), lastmod: productionsLastmod },
      { loc: absoluteUrl(appUrl, '/productions'), lastmod: productionsLastmod },
      {
        loc: absoluteUrl(appUrl, '/authors'),
        lastmod: latest(authorEntries.map((e) => e.lastmod)),
      },
    ]

    const result = truncate([...fixed, ...productionEntries, ...authorEntries], limit)
    if (result.truncated && !truncationLogged) {
      truncationLogged = true
      logger.warn({ limit }, 'sitemap truncated: more URLs than one sitemap file allows (D-13.3-4)')
    }
    return result.entries
  }

  /** `<urlset>` document (sitemaps.org 0.9), every value XML-escaped. */
  static render(entries: SitemapEntry[]): string {
    const urls = entries.map((entry) => {
      const lastmod = w3cDate(entry.lastmod)
      return (
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
        '  </url>'
      )
    })
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      (urls.length ? `${urls.join('\n')}\n` : '') +
      '</urlset>\n'
    )
  }

  /**
   * `robots.txt`: admin panel excluded (FR37, Story 2.5), absolute `Sitemap:` line (13.3). With
   * `disallowAll` (`ROBOTS_DISALLOW_ALL`, e.g. staging) the whole site is excluded and no sitemap
   * is declared.
   */
  static robots(appUrl: string, options: { disallowAll?: boolean } = {}): string {
    if (options.disallowAll) {
      return [
        '# robots.txt — Anta (environnement non indexé : ROBOTS_DISALLOW_ALL)',
        '',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n')
    }
    return [
      '# robots.txt — Anta',
      '# Bibliothèque numérique académique',
      '# Story 2.5 — Exclusion du panel admin de l’indexation (FR37)',
      '',
      'User-agent: *',
      'Disallow: /admin/',
      '',
      '# Pages publiques — indexation autorisée par défaut',
      'Allow: /',
      '',
      '# Story 13.3 — plan du site',
      `Sitemap: ${absoluteUrl(appUrl, '/sitemap.xml')}`,
      '',
    ].join('\n')
  }
}
