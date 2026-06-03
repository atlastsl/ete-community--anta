import type { HttpContext } from '@adonisjs/core/http'
import Production from '#models/production'
import ProductionStatus from '#enums/production_status'
import StatsService from '#services/stats_service'

/** Garde format UUID : un id non-UUID passé à `where('id', ...)` ferait lever Postgres (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default class StatsController {
  /**
   * Beacon de vue (FR25) — appelé par `ViewTracker` après 10s sur la page détail.
   * Enregistre une vue pour une production publiée ; 404 si id invalide/inexistant/non publié.
   * Réponse 204 (pas une réponse Inertia). Route exemptée de CSRF (beacon public).
   */
  async view({ request, response, session }: HttpContext) {
    const productionId = request.input('productionId')
    if (typeof productionId !== 'string' || !UUID_RE.test(productionId)) {
      return response.notFound()
    }

    const production = await Production.query()
      .where('id', productionId)
      .where('status', ProductionStatus.PUBLISHED)
      .first()

    if (!production) {
      return response.notFound()
    }

    await StatsService.recordView(production.id, request.ip(), session.sessionId)
    return response.noContent()
  }
}
