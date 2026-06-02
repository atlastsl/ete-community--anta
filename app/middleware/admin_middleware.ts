import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * AdminMiddleware
 *
 * 1. Authentifie via le guard `web` (session-based) → redirect /admin/login si anonyme
 * 2. Vérifie `isActive` — sinon logout + redirect /admin/login (flash error)
 * 3. Vérifie le rôle admin OU super_admin (défense en profondeur)
 * 4. Si `passwordChanged === false` ET route ≠ change-password|logout
 *    → redirect /admin/auth/change-password
 */
export default class AdminMiddleware {
  redirectTo = '/admin/login'

  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.authenticateUsing(['web'], { loginRoute: this.redirectTo })

    const user = ctx.auth.user!

    if (!user.isActive) {
      await ctx.auth.use('web').logout()
      ctx.session.flash('error', 'errors.account_inactive')
      return ctx.response.redirect(this.redirectTo)
    }

    // Invalidation de session après réinitialisation de mot de passe : si le marqueur
    // stocké à la connexion ne correspond plus à la version courante du compte, la
    // session est périmée → logout + redirect login. Le `?? 0` évite de déconnecter
    // les sessions antérieures à l'introduction du marqueur (compte jamais réinitialisé).
    if ((ctx.session.get('authVersion') ?? 0) !== user.sessionVersion) {
      await ctx.auth.use('web').logout()
      return ctx.response.redirect(this.redirectTo)
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      await ctx.auth.use('web').logout()
      return ctx.response.redirect(this.redirectTo)
    }

    if (!user.passwordChanged) {
      // url() sans argument → pathname seul (sans query string), pour des comparaisons
      // robustes. url(true) inclurait la query string et casserait l'égalité exacte.
      const path = ctx.request.url()
      const isChangePasswordRoute = path.startsWith('/admin/auth/change-password')
      const isLogoutRoute = path === '/admin/logout'
      if (!isChangePasswordRoute && !isLogoutRoute) {
        return ctx.response.redirect('/admin/auth/change-password')
      }
    }

    return next()
  }
}
