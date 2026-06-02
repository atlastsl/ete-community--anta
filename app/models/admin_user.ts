import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { AdminRole } from '#enums/admin_role'
import AdminActivityLog from '#models/admin_activity_log'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'passwordHash',
})

export default class AdminUser extends compose(BaseModel, AuthFinder) {
  static table = 'admin_users'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare passwordHash: string

  @column()
  declare role: AdminRole

  @column()
  declare isActive: boolean

  @column()
  declare passwordChanged: boolean

  @column()
  declare sessionVersion: number

  @column()
  declare createdById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => AdminUser, { foreignKey: 'createdById' })
  declare createdBy: BelongsTo<typeof AdminUser>

  @hasMany(() => AdminActivityLog)
  declare activityLogs: HasMany<typeof AdminActivityLog>
}
