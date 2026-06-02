import type { HttpContext } from '@adonisjs/core/http'

/**
 * Dashboard admin — STUB de la story 2.1.
 *
 * Rend la page placeholder restante qui sera remplacée par la vraie page dans :
 * - Stats : Epic 7 (statistiques)
 *
 * (Productions → ProductionsController depuis Story 4.2 ; Users → UsersController depuis Story 3.2.)
 */
export default class AdminDashboardController {
  async stats({ inertia }: HttpContext) {
    return inertia.render('admin/Stats/Index', {})
  }
}
