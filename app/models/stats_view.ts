import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Production from '#models/production'

export default class StatsView extends BaseModel {
  static table = 'stats_views'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column.dateTime()
  declare recordedAt: DateTime

  @column()
  declare ipHash: string | null

  @column()
  declare sessionId: string | null

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
