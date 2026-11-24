import type { HttpContext } from '@adonisjs/core/http'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'
import SeoService from '#services/seo_service'
import ProductionCardTransformer from '#transformers/production_card_transformer'
import PublicBylineService from '#services/public_byline_service'
import FeaturedService from '#services/featured_service'
import RankingService, { RANKING_SIZE } from '#services/ranking_service'

/** Base query : productions publiées + agrégats de vues/téléchargements (alias explicites). */
function publishedWithCounts() {
  return Production.query()
    .where('status', ProductionStatus.PUBLISHED)
    .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
    .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
}

/**
 * Cards of a cached ranking, in its order, with the **totals** (FR46, D4). Re-filtered on
 * `published`: an id left in the cache by another process (Ace) is skipped (D-12.2-1).
 */
async function rankedRows(ids: string[]): Promise<Production[]> {
  if (ids.length === 0) return []
  const rows = await publishedWithCounts().whereIn('id', ids)
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

export default class HomeController {
  async index({ request, inertia }: HttpContext) {
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))

    // « Récemment publiées » : jamais en cache (P2.3).
    const recentRows = await publishedWithCounts()
      .orderByRaw('anta_published_at DESC NULLS LAST')
      .orderBy('id', 'asc')
      .limit(RANKING_SIZE)

    // Classements 365 j : identifiants ordonnés en cache (TTL 10 min, Story 12.2, P2-06).
    const mostViewedRows = await rankedRows(await RankingService.mostViewedIds())
    const mostDownloadedRows = await rankedRows(await RankingService.mostDownloadedIds())

    // Featured banner (Story 11.6): read on every request, never cached (P2.3, journey 5).
    const featuredRows = await FeaturedService.bannerRows()

    // One byline pass for every production of the page (blocks and banner; no dedup, D6).
    await PublicBylineService.attach([
      ...recentRows,
      ...mostViewedRows,
      ...mostDownloadedRows,
      ...featuredRows.map((row) => row.production),
    ])
    const featured = FeaturedService.bannerItems(featuredRows)

    return inertia.render('home', {
      featured,
      recent: ProductionCardTransformer.transform(recentRows),
      mostViewed: ProductionCardTransformer.transform(mostViewedRows),
      mostDownloaded: ProductionCardTransformer.transform(mostDownloadedRows),
      meta: SeoService.site(locale),
    })
  }
}
