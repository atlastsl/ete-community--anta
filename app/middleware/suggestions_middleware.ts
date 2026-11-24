import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ProductionsController from '#controllers/public/productions_controller'

/**
 * `/productions/<slug>/suggestions`, raw path (query string excluded), optional trailing slash
 * (matched by the router too, review of 12.4).
 */
const PATH = /^\/productions\/([^/]+)\/suggestions\/?$/

/**
 * Serves `GET /productions/:slug/suggestions` before the router (Story 12.4, D-12.4-3), like
 * `MediaMiddleware`: the JSON is cacheable publicly (`Cache-Control: public, max-age=300`), so
 * the router middleware never run for it — no session commit (no `Set-Cookie`, flash messages
 * of the page untouched), no `XSRF-TOKEN` cookie, no auth lookup — and a shared cache can
 * never replay another visitor's cookies. Shield does not run either: the controller sets
 * `X-Content-Type-Options` itself. The `production.suggestions` route stays registered for
 * naming and Tuyau, and answers identically for any path this pattern does not match.
 */
export default class SuggestionsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const method = ctx.request.method()
    if (method !== 'GET' && method !== 'HEAD') return next()
    const rawPath = (ctx.request.request.url ?? '').split('?')[0]
    const match = PATH.exec(rawPath)
    if (!match) return next()

    let slug: string
    try {
      slug = decodeURIComponent(match[1])
    } catch {
      return next()
    }
    ctx.params = { slug }
    return new ProductionsController().suggestions(ctx, true)
  }
}
