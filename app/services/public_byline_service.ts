import db from '@adonisjs/lucid/services/db'
import type Production from '#models/production'
import PublicAuthorService from '#services/public_author_service'
import ProductionAuthorService from '#services/production_author_service'
import { formatAuthorName } from '#helpers/author_name'

/** One name of a public byline: `slug` only for a profile visible on the site (D12, P2.7). */
export type AuthorCredit = { name: string; slug: string | null }

type PivotRow = {
  production_id: string
  author_id: string
  first_names: string
  last_names: string
  search_name: string
}

/**
 * Public bylines (Story 10.4, FR59): the authors of each production in the pivot order,
 * linked to their profile only when it is visible (`Author.visibleOnSite`), followed by the
 * `productions.authors` names no linked author matches (unconverted or partially attached
 * productions, `ProductionAuthorService.legacyOf`) as plain text: no name ever disappears.
 */
export default class PublicBylineService {
  /**
   * Computes the bylines of a batch of productions in at most two queries whatever its size
   * (pivot + authors, then the slugs of the visible ones, skipped when no author is linked) and stores each one in `$extras.byline`,
   * read by `ProductionCardTransformer` and the detail page.
   */
  static async attach(productions: Production[]): Promise<void> {
    if (productions.length === 0) return
    const ids = [...new Set(productions.map((p) => p.id))]

    const rows: PivotRow[] = await db
      .from('production_authors')
      .join('authors', 'authors.id', 'production_authors.author_id')
      .whereIn('production_authors.production_id', ids)
      .orderBy('production_authors.production_id')
      .orderBy('production_authors.position')
      .select(
        'production_authors.production_id',
        'production_authors.author_id',
        'authors.first_names',
        'authors.last_names',
        'authors.search_name'
      )

    const slugs = await PublicAuthorService.visibleSlugs(rows.map((row) => row.author_id))

    const byProduction = new Map<string, PivotRow[]>()
    for (const row of rows) {
      const list = byProduction.get(row.production_id) ?? []
      list.push(row)
      byProduction.set(row.production_id, list)
    }

    for (const production of productions) {
      production.$extras.byline = this.compose(
        production,
        byProduction.get(production.id) ?? [],
        slugs
      )
    }
  }

  /** Linked authors (pivot order) then the unmatched jsonb names, unlinked. */
  private static compose(
    production: Production,
    linked: PivotRow[],
    slugs: Map<string, string>
  ): AuthorCredit[] {
    const credits: AuthorCredit[] = linked.map((row) => ({
      name: formatAuthorName(row.first_names, row.last_names),
      slug: slugs.get(row.author_id) ?? null,
    }))
    const { unlinkedNames } = ProductionAuthorService.legacyOf(
      production.authorNames,
      linked.map((row) => row.search_name)
    )
    return [...credits, ...unlinkedNames.map((name) => ({ name, slug: null }))]
  }

  /**
   * Byline of a production: the computed one (`attach`), else its jsonb names unlinked —
   * never a slug without the visibility check.
   */
  static of(production: Production): AuthorCredit[] {
    const computed = production.$extras.byline as AuthorCredit[] | undefined
    if (computed) return computed
    return ProductionAuthorService.legacyOf(production.authorNames, []).unlinkedNames.map(
      (name) => ({ name, slug: null })
    )
  }
}
