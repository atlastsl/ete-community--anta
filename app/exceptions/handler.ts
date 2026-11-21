import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import SeoService from '#services/seo_service'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. Enabled everywhere so the translated NotFoundPage (D36, Story 10.1)
   * is what visitors, developers and tests see; 5xx pages stay production-only
   * (see `statusPages`) so that development keeps the Youch stack trace.
   */
  protected renderStatusPages = true

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response. The 404 page carries
   * server meta (translated title, `<html lang>`) from the `i18n_lang` cookie.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, { inertia, request }) =>
      inertia.render('errors/not_found', {
        meta: SeoService.notFound(SeoService.localeFromCookieHeader(request.header('cookie'))),
      }),
    ...(app.inProduction
      ? {
          '500..599': ((_, { inertia }) =>
            inertia.render('errors/server_error', {})) as StatusPageRenderer,
        }
      : {}),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
