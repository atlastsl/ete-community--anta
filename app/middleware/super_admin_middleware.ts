import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * SuperAdminMiddleware
 *
 * Suppose que `AdminMiddleware` s'est exécuté avant (donc `auth.user` existe et est un admin actif).
 * Si le rôle n'est pas super_admin, redirige vers le dashboard avec un flash error.
 */
export default class SuperAdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user!

    if (user.role !== 'super_admin') {
      ctx.session.flash('error', 'errors.forbidden')
      return ctx.response.redirect('/admin/productions')
    }

    return next()
  }
}
