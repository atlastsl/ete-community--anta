import type { HttpContext } from '@adonisjs/core/http'
import AdminUser from '#models/admin_user'
import { loginValidator, changePasswordValidator } from '#validators/auth_validator'
import ActivityLogService from '#services/activity_log_service'
import ActionType from '#enums/action_type'

/**
 * Contrôleur d'authentification admin.
 *
 * Story 2.2 — Login fonctionnel (verifyCredentials + isActive + redirect conditionnel).
 * Story 2.3 — Changement de mot de passe à la première connexion.
 */
export default class AdminAuthController {
  /**
   * GET /admin/login — Affiche le formulaire de connexion.
   * Si l'utilisateur est déjà authentifié et actif, redirige vers le bon endroit.
   */
  async showLogin({ auth, inertia, response }: HttpContext) {
    if (await auth.use('web').check()) {
      const user = auth.user
      if (user?.isActive) {
        return response.redirect(
          user.passwordChanged ? '/admin/productions' : '/admin/auth/change-password'
        )
      }
      // Authentifié mais désactivé (isActive flippé en cours de session) :
      // on détruit la session périmée avant d'afficher le formulaire.
      await auth.use('web').logout()
    }
    return inertia.render('admin/Auth/Login', {})
  }

  /**
   * POST /admin/login — Tente la connexion.
   *
   * Sécurité (AC4) : email inexistant ET mot de passe incorrect renvoient le MÊME
   * message `invalid_credentials` (`verifyCredentials` lance `E_INVALID_CREDENTIALS`
   * dans les deux cas) — pas d'énumération via ce chemin.
   *
   * Sécurité (AC5) : la vérification `isActive` se fait APRÈS verifyCredentials, pour
   * rester timing-safe (le hash scrypt prend le même temps quel que soit `isActive`).
   * NOTE : un compte valide-mais-désactivé reçoit `account_inactive` (message distinct,
   * exigé par AC5). Cela révèle l'existence du compte à qui détient déjà des credentials
   * valides — compromis accepté pour le MVP (panel interne, comptes connus de l'équipe).
   */
  async login({ request, auth, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    let user: AdminUser
    try {
      user = await AdminUser.verifyCredentials(email, password)
    } catch {
      session.flashOnly(['email'])
      session.flashErrors({ email: 'auth.login.errors.invalid_credentials' })
      return response.redirect('/admin/login')
    }

    if (!user.isActive) {
      session.flashOnly(['email'])
      session.flashErrors({ email: 'auth.login.errors.account_inactive' })
      return response.redirect('/admin/login')
    }

    await auth.use('web').login(user)

    // Marqueur de version de session : permet d'invalider cette session si le
    // mot de passe du compte est réinitialisé ultérieurement (cf. UsersController.resetPassword).
    session.put('authVersion', user.sessionVersion)

    await ActivityLogService.log({
      adminUserId: user.id,
      actionType: ActionType.LOGIN,
      resourceType: 'session',
    })

    return response.redirect(
      user.passwordChanged ? '/admin/productions' : '/admin/auth/change-password'
    )
  }

  /**
   * GET /admin/auth/change-password — Affiche le formulaire.
   *
   * AC7 — Si l'admin a déjà `passwordChanged = true`, on redirige vers le dashboard
   * sans afficher le formulaire (le flux première connexion est terminé).
   */
  async showChangePassword({ auth, inertia, response }: HttpContext) {
    const user = auth.user!
    if (user.passwordChanged) {
      return response.redirect('/admin/productions')
    }
    return inertia.render('admin/Auth/ChangePassword', {})
  }

  /**
   * POST /admin/auth/change-password — Définit le mot de passe permanent.
   *
   * Validation via `changePasswordValidator` (min 12 + confirmation).
   * VineJS lance `ValidationException` → 302 + flashErrors automatique.
   *
   * AC7 (idempotence) : si `passwordChanged = true`, redirige sans rien modifier.
   * Le mixin `AuthFinder` (admin_user.ts) hashe automatiquement le password en clair.
   */
  async changePassword({ auth, request, response, session }: HttpContext) {
    const user = auth.user!

    if (user.passwordChanged) {
      return response.redirect('/admin/productions')
    }

    const { password } = await request.validateUsing(changePasswordValidator)

    user.passwordHash = password // hashé par le mixin AuthFinder au save
    user.passwordChanged = true
    await user.save()

    session.flash('success', 'auth.change_password.success')
    return response.redirect('/admin/productions')
  }

  /**
   * POST /admin/logout — Détruit la session côté serveur.
   *
   * Sécurité : la régénération du session ID lors du prochain login est gérée
   * automatiquement par `auth.use('web').login()` (anti-fixation, cf. Story 2.4).
   */
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'auth.logout.success')
    return response.redirect('/admin/login')
  }
}
