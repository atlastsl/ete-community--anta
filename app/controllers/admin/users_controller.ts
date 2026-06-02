import type { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import AdminUser from '#models/admin_user'
import AdminRole from '#enums/admin_role'
import ActionType from '#enums/action_type'
import ActivityLogService from '#services/activity_log_service'
import { createUserValidator } from '#validators/admin/create_user_validator'

export default class UsersController {
  async index({ auth, inertia }: HttpContext) {
    const currentUser = auth.user!
    const users = await AdminUser.query()
      .where('id', '!=', currentUser.id)
      .preload('createdBy')
      .orderBy('createdAt', 'desc')

    return inertia.render('admin/Users/Index', {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt?.toISO() ?? null,
        createdBy: u.createdBy?.email ?? null,
      })),
    })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('admin/Users/Create', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    const validated = await request.validateUsing(createUserValidator)
    // Normalisation : on stocke toujours l'email en minuscules pour éviter les
    // doublons variant uniquement par la casse (admin@x.com vs Admin@x.com).
    const email = validated.email.toLowerCase()

    const temporaryPassword = string.generateRandom(16)

    let user: AdminUser
    try {
      user = await AdminUser.create({
        email,
        passwordHash: temporaryPassword,
        role: AdminRole.ADMIN,
        isActive: true,
        passwordChanged: false,
        createdById: auth.user!.id,
      })
    } catch (error) {
      // Filet de sécurité contre la race TOCTOU entre la validation `unique` et l'INSERT :
      // une violation de contrainte unique est traduite en erreur de validation lisible
      // plutôt qu'en 500.
      logger.error({ err: error, email }, 'Failed to create admin user')
      session.flashAll()
      session.flashErrors({ email: 'users.errors.email_taken' })
      return response.redirect().back()
    }

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.CREATE,
      resourceType: 'admin_user',
      resourceId: user.id,
    })

    try {
      await mail.send((message) => {
        message
          .to(email)
          .subject('Invitation — Bibliothèque Anta')
          .htmlView('emails/admin_invitation', {
            email,
            temporaryPassword,
            loginUrl: `${env.get('APP_URL')}/admin/login`,
          })
      })
      session.flash('success', 'users.create_success')
    } catch (error) {
      logger.error({ err: error, email }, 'Failed to send admin invitation email')
      session.flash('success', 'users.create_success_no_email')
      // Échec de l'envoi : on expose le mot de passe provisoire au super admin pour
      // qu'il puisse le transmettre manuellement (sinon il serait irrécupérable).
      session.flash('tempPassword', temporaryPassword)
    }

    return response.redirect('/admin/users')
  }

  async toggleActive({ params, auth, response, session }: HttpContext) {
    if (params.id === auth.user!.id) {
      session.flash('error', 'users.self_deactivate_error')
      return response.redirect('/admin/users')
    }

    const user = await AdminUser.findOrFail(params.id)

    // Défense en profondeur : un super_admin ne gère pas un autre super_admin (FR34).
    if (user.role === 'super_admin') {
      session.flash('error', 'users.protected_super_admin')
      return response.redirect('/admin/users')
    }

    user.isActive = !user.isActive
    await user.save()

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.UPDATE,
      resourceType: 'admin_user',
      resourceId: user.id,
    })

    session.flash(
      'success',
      user.isActive ? 'users.reactivate_success' : 'users.deactivate_success'
    )
    return response.redirect('/admin/users')
  }

  async resetPassword({ params, auth, response, session }: HttpContext) {
    if (params.id === auth.user!.id) {
      session.flash('error', 'users.self_reset_error')
      return response.redirect('/admin/users')
    }

    const user = await AdminUser.findOrFail(params.id)

    if (user.role === 'super_admin') {
      session.flash('error', 'users.protected_super_admin')
      return response.redirect('/admin/users')
    }

    const temporaryPassword = string.generateRandom(16)
    user.passwordHash = temporaryPassword
    user.passwordChanged = false
    // Invalide toutes les sessions actives de la cible : le marqueur stocké à leur
    // connexion ne correspondra plus → déconnexion forcée au prochain accès (AdminMiddleware).
    user.sessionVersion = user.sessionVersion + 1
    await user.save()

    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.PASSWORD_RESET,
      resourceType: 'admin_user',
      resourceId: user.id,
    })

    try {
      await mail.send((message) => {
        message
          .to(user.email)
          .subject('Réinitialisation de mot de passe — Anta')
          .htmlView('emails/admin_password_reset', {
            email: user.email,
            temporaryPassword,
            loginUrl: `${env.get('APP_URL')}/admin/login`,
          })
      })
      session.flash('success', 'users.reset_password_success')
    } catch (error) {
      logger.error({ err: error, email: user.email }, 'Failed to send password reset email')
      session.flash('success', 'users.reset_password_success_no_email')
      session.flash('tempPassword', temporaryPassword)
    }

    return response.redirect('/admin/users')
  }

  async destroy({ params, auth, response, session }: HttpContext) {
    if (params.id === auth.user!.id) {
      session.flash('error', 'users.self_delete_error')
      return response.redirect('/admin/users')
    }

    const user = await AdminUser.findOrFail(params.id)

    if (user.role === 'super_admin') {
      session.flash('error', 'users.protected_super_admin')
      return response.redirect('/admin/users')
    }

    // Log écrit AVANT la suppression. Il est attribué au super admin acteur
    // (resourceId = compte supprimé), donc il survit au CASCADE qui n'efface
    // que les logs dont admin_user_id = le compte supprimé.
    await ActivityLogService.log({
      adminUserId: auth.user!.id,
      actionType: ActionType.DELETE,
      resourceType: 'admin_user',
      resourceId: user.id,
    })

    await user.delete()

    session.flash('success', 'users.delete_success')
    return response.redirect('/admin/users')
  }
}
