import type { HttpContext } from '@adonisjs/core/http'
import AdminActivityLog from '#models/admin_activity_log'
import AdminUser from '#models/admin_user'
import ActionType from '#enums/action_type'

const PER_PAGE = 20
const ACTION_VALUES = Object.values(ActionType) as string[]
/** Garde format UUID : un id non-UUID passé à `where` ferait lever Postgres (500). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Logs d'activité des administrateurs (FR29) — super admin uniquement (route sous
 * SuperAdminMiddleware). Liste paginée (20/page), plus récents d'abord, filtrable par
 * administrateur et par type d'action. Lecture seule (les logs sont écrits par ActivityLogService).
 */
export default class ActivityLogsController {
  async index({ request, inertia }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)

    // Type d'action validé contre l'enum ; sinon ignoré.
    const actionInput = request.input('actionType')
    const actionType = ACTION_VALUES.includes(actionInput) ? actionInput : null

    // adminId accepté seulement s'il a la forme d'un UUID (anti-500 Postgres).
    const adminInput = request.input('adminId')
    const adminUserId =
      typeof adminInput === 'string' && UUID_RE.test(adminInput) ? adminInput : null

    const query = AdminActivityLog.query()
      .preload('adminUser')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'asc')
    if (actionType) query.where('actionType', actionType)
    if (adminUserId) query.where('adminUserId', adminUserId)

    const paginator = await query.paginate(page, PER_PAGE)
    const meta = paginator.getMeta()

    const admins = await AdminUser.query().select('id', 'email').orderBy('email', 'asc')

    return inertia.render('admin/ActivityLogs/Index', {
      logs: paginator.all().map((log) => ({
        id: log.id,
        adminEmail: log.adminUser?.email ?? null,
        actionType: log.actionType,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        createdAt: log.createdAt.toISO() ?? null,
      })),
      pagination: {
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        total: meta.total,
        perPage: meta.perPage,
      },
      currentAdminId: adminUserId,
      currentActionType: actionType,
      admins: admins.map((a) => ({ id: a.id, email: a.email })),
      actionTypes: ACTION_VALUES,
    })
  }
}
