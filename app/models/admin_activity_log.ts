import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import AdminUser from '#models/admin_user'
import type { ActionType } from '#enums/action_type'

export default class AdminActivityLog extends BaseModel {
  static table = 'admin_activity_logs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare adminUserId: string

  @column()
  declare actionType: ActionType

  @column()
  declare resourceType: string | null

  @column()
  declare resourceId: string | null

  /** Event details (P2.6), e.g. `{ name, fields }` for an author; NULL for older entries. */
  @column({
    prepare: (value: Record<string, unknown> | null) =>
      value === null || value === undefined ? null : JSON.stringify(value),
    consume: (value: string | Record<string, unknown> | null) =>
      typeof value === 'string' ? JSON.parse(value) : (value ?? null),
  })
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => AdminUser)
  declare adminUser: BelongsTo<typeof AdminUser>
}
