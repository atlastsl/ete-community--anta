import AdminActivityLog from '#models/admin_activity_log'
import type { ActionType } from '#enums/action_type'
import logger from '@adonisjs/core/services/logger'

interface LogParams {
  adminUserId: string
  actionType: ActionType
  resourceType?: string
  resourceId?: string
}

export default class ActivityLogService {
  static async log(params: LogParams): Promise<void> {
    try {
      await AdminActivityLog.create({
        adminUserId: params.adminUserId,
        actionType: params.actionType,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
      })
    } catch (error) {
      logger.error({ err: error, ...params }, 'ActivityLogService: failed to create log')
    }
  }
}
