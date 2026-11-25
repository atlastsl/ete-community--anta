import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import SitemapService from '#services/sitemap_service'

/**
 * `sitemap.xml` and `robots.txt` (Story 13.3, P2.7). Served by `SeoFilesMiddleware` before the
 * router — no session, shield nor cookie — because both are cacheable publicly (D-13.3-2):
 * `X-Content-Type-Options` is therefore set here. Through the router (fallback for any path the
 * middleware does not match) session / shield cookies may be on the response → never cached.
 */
export default class SitemapController {
  async show({ response }: HttpContext, stateless = false) {
    const entries = await SitemapService.entries(env.get('APP_URL'))
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Content-Type', 'application/xml; charset=utf-8')
    response.header('Cache-Control', stateless ? 'public, max-age=3600' : 'private, no-store')
    return response.send(SitemapService.render(entries))
  }

  async robots({ response }: HttpContext, stateless = false) {
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Content-Type', 'text/plain; charset=utf-8')
    response.header('Cache-Control', stateless ? 'public, max-age=3600' : 'private, no-store')
    return response.send(
      SitemapService.robots(env.get('APP_URL'), {
        disallowAll: env.get('ROBOTS_DISALLOW_ALL', false),
      })
    )
  }
}
