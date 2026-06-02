import type { HttpContext } from '@adonisjs/core/http'
import SeoService from '#services/seo_service'

/** Pages publiques statiques (politique de confidentialité, etc.) avec meta SEO côté serveur. */
export default class PagesController {
  async privacy({ request, inertia }: HttpContext) {
    const locale = SeoService.localeFromCookieHeader(request.header('cookie'))
    return inertia.render('privacy-policy', { meta: SeoService.site(locale) })
  }
}
