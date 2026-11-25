import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import SitemapController from '#controllers/public/sitemap_controller'

/**
 * Serves `GET|HEAD /sitemap.xml` and `/robots.txt` before the router (Story 13.3, D-13.3-2), like
 * `MediaMiddleware` and `SuggestionsMiddleware`: both are cacheable publicly, so the router
 * middleware never run for them — no session commit, no `XSRF-TOKEN` cookie, no auth lookup —
 * and a shared cache can never replay a visitor's cookies. Raw path (query string excluded),
 * optional trailing slash (matched by the router too). The `sitemap` / `robots` routes stay
 * registered for naming and answer identically (but uncached) for any other spelling.
 */
const SITEMAP = /^\/sitemap\.xml\/?$/
const ROBOTS = /^\/robots\.txt\/?$/

export default class SeoFilesMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const method = ctx.request.method()
    if (method !== 'GET' && method !== 'HEAD') return next()
    const rawPath = (ctx.request.request.url ?? '').split('?')[0]
    if (SITEMAP.test(rawPath)) return new SitemapController().show(ctx, true)
    if (ROBOTS.test(rawPath)) return new SitemapController().robots(ctx, true)
    return next()
  }
}
