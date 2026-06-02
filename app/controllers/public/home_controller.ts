import type { HttpContext } from '@adonisjs/core/http'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'
import SeoService from '#services/seo_service'

const SECTION_SIZE = 6

type ProductionCardProps = {
  id: string
  title: string
  authors: string[]
  category: string | null
  domain: string | null
  summary: string | null
  viewsCount: number
  downloadsCount: number
  publishedAt: string | null
}

/** Base query : productions publiées + agrégats de vues/téléchargements (alias explicites). */
function publishedWithCounts() {
  return Production.query()
    .where('status', ProductionStatus.PUBLISHED)
    .withAggregate('statsViews', (q) => q.count('*').as('viewsCount'))
    .withAggregate('statsDownloads', (q) => q.count('*').as('downloadsCount'))
}

function serialize(p: Production): ProductionCardProps {
  return {
    id: p.id,
    title: p.title,
    authors: p.authors ?? [],
    category: p.category,
    domain: p.domain,
    summary: p.summary,
    viewsCount: Number(p.$extras.viewsCount ?? 0),
    downloadsCount: Number(p.$extras.downloadsCount ?? 0),
    publishedAt: p.antaPublishedAt?.toISO() ?? null,
  }
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

    const categoryRows = await Production.query()
      .where('status', ProductionStatus.PUBLISHED)
      .whereNotNull('category')
      .distinct('category')
      .orderBy('category', 'asc')

    return inertia.render('home', {
      mostViewed: mostViewedRows.map(serialize),
      recent: recentRows.map(serialize),
      categories: categoryRows.map((p) => p.category).filter((c): c is string => c !== null),
      meta: SeoService.site(locale),
    })
  }
}
