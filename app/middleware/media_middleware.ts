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
 */
export default class MediaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const method = ctx.request.method()
    const path = ctx.request.url()
    if ((method !== 'GET' && method !== 'HEAD') || !path.startsWith(PREFIX)) return next()

    // Raw (undecoded) segments: the strict key allow-list refuses any `%` escape.
    ctx.params = { '*': path.slice(PREFIX.length).split('/') }
    return new MediaController().show(ctx)
  }
}
