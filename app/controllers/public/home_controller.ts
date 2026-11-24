import type { HttpContext } from '@adonisjs/core/http'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'
import SeoService from '#services/seo_service'
import ProductionCardTransformer from '#transformers/production_card_transformer'
import PublicBylineService from '#services/public_byline_service'
import FeaturedService from '#services/featured_service'

const SECTION_SIZE = 6

/** Base query : productions publiées + agrégats de vues/téléchargements (alias explicites). */
function publishedWithCounts() {
  return Production.query()
    .where('status', ProductionStatus.PUBLISHED)
    .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
    .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
}

export default class HomeController {
  async index({ request, inertia }: HttpContext) {
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))

    const mostViewedRows = await publishedWithCounts()
      .orderBy('viewsCount', 'desc')
      .orderBy('id', 'asc')
      .limit(SECTION_SIZE)

    const recentRows = await publishedWithCounts()
      .orderBy('antaPublishedAt', 'desc')
      .orderBy('id', 'asc')
      .limit(SECTION_SIZE)

    // Featured banner (Story 11.6): read on every request, never cached (P2.3, journey 5).
    const featuredRows = await FeaturedService.bannerRows()

    // One byline pass for every production of the page (blocks and banner).
    await PublicBylineService.attach([
      ...mostViewedRows,
      ...recentRows,
      ...featuredRows.map((row) => row.production),
    ])
    const featured = FeaturedService.bannerItems(featuredRows)

    return inertia.render('home', {
      featured,
      mostViewed: ProductionCardTransformer.transform(mostViewedRows),
      recent: ProductionCardTransformer.transform(recentRows),
      meta: SeoService.site(locale),
    })
  }
}
