import type { HttpContext } from '@adonisjs/core/http'
import StatsService from '#services/stats_service'

/**
 * Dashboard admin — vue agrégée des statistiques (Epic 7, FR28).
 * (Productions → ProductionsController depuis Story 4.2 ; Users → UsersController depuis Story 3.2.)
 */
export default class AdminDashboardController {
  async stats({ inertia }: HttpContext) {
    return inertia.render('admin/Stats/Index', {
      stats: await StatsService.libraryStats(),
    })
  }
}
