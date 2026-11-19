import type { HttpContext } from '@adonisjs/core/http'
import PublicAuthorService from '#services/public_author_service'
import MediaService from '#services/media_service'
import SeoService, { type Locale } from '#services/seo_service'
import ProductionCardTransformer from '#transformers/production_card_transformer'
import PublicBylineService from '#services/public_byline_service'
import env from '#start/env'

/**
 * Public author pages (Epic 10). `show`: profile of a visible author (P2.1, D11) with the
 * totals of its published productions and its productions, 12 per page (P2.6, FR58).
 */
export default class AuthorsController {
  async show(ctx: HttpContext) {
    const { params, request, response, inertia } = ctx
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))

    const author = await PublicAuthorService.findVisibleBySlug(String(params.slug))
    // Unknown slug, no consent, no published production: same 404 as a production (D17).
    if (!author) return this.notFound(ctx, locale)

    const sort = PublicAuthorService.parseSort(request.input('sort'))
    const page = PublicAuthorService.parsePage(request.input('page'))

    const paginator = await PublicAuthorService.productions(author.id, sort, page)
    const pagination = paginator.getMeta()
    // Race: the last production unpublished between the visibility check and this query.
    if (pagination.total === 0) return this.notFound(ctx, locale)

    if (page > pagination.lastPage) {
      // Out of range (D36): last page, known parameters kept.
      return response
        .redirect()
        .toPath(PublicAuthorService.profilePath(author.slug, sort, pagination.lastPage))
    }

    const stats = await PublicAuthorService.stats(author.id)
    await PublicBylineService.attach(paginator.all())

    return inertia.render('author', {
      author: {
        slug: author.slug,
        firstNames: author.firstNames,
        lastNames: author.lastNames,
        photoBase: MediaService.authorPhotoUrl(author),
        googleScholarUrl: PublicAuthorService.safeHttpUrl(author.googleScholarUrl),
        affiliations: author.affiliations.map((a) => ({
          institution: a.institution,
          department: a.department,
        })),
      },
      stats,
      // Shared card + the work date, shown on the profile cards since it drives the default
      // sort (review 10.3, D-10.3-6); home and listing cards are unchanged.
      productions: paginator.all().map((production) => ({
        ...new ProductionCardTransformer(production).toObject(),
        workPublishedAt: production.workPublishedAt?.toISODate() ?? null,
      })),
      pagination: {
        currentPage: pagination.currentPage,
        lastPage: pagination.lastPage,
        total: pagination.total,
        perPage: pagination.perPage,
      },
      sort,
      meta: SeoService.forAuthor(
        locale,
        {
          firstNames: author.firstNames,
          lastNames: author.lastNames,
          slug: author.slug,
          primaryInstitution: author.affiliations[0]?.institution ?? null,
          publishedCount: stats.productions,
        },
        env.get('APP_URL')
      ),
    })
  }

  private notFound({ response, inertia }: HttpContext, locale: Locale) {
    response.status(404)
    return inertia.render('errors/not_found', { meta: SeoService.notFound(locale) })
  }
}
