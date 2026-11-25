import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import MediaController from '#controllers/public/media_controller'

const PREFIX = '/media/'

/**
 * Serves `GET|HEAD /media/*` before the router (Story 10.2 review): public images are
 * stateless, so the router middleware never run for them — no session commit (flash
 * messages of the page being loaded are not consumed, the session cookie is not
 * rewritten), no `XSRF-TOKEN` cookie, no auth lookup — and the cacheable responses carry
 * no `Set-Cookie`. The `media.show` route stays registered for naming and URL building.
 * Shield does not run either: `MediaController` sets `X-Content-Type-Options` itself. Served
 * prefixes (`authors/`, `thumbnails/` since Story 11.2) are decided by `MediaService`.
 */
export default class MediaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const method = ctx.request.method()
    const path = ctx.request.url()
    if ((method !== 'GET' && method !== 'HEAD') || !path.startsWith(PREFIX)) return next()

    // Raw (undecoded) segments: `request.url()` is passed through `decodeURI` (unreserved
    // escapes such as `%2E` are decoded), so the segments come from the Node request URL and
    // the strict key allow-list refuses any `%` escape (review of 11.2). A path whose raw form
    // does not start with `/media/` (e.g. `/%6Dedia/…`) gets no segment, hence a 404.
    const rawPath = (ctx.request.request.url ?? '').split('?')[0]
    const segments = rawPath.startsWith(PREFIX) ? rawPath.slice(PREFIX.length).split('/') : []
    ctx.params = { '*': segments }
    return new MediaController().show(ctx)
  }
}
