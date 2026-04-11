import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Production from '#models/production'

export default class StatsDownload extends BaseModel {
  static table = 'stats_downloads'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column.dateTime()
  declare downloadedAt: DateTime

  @column()
  declare ipHash: string | null

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
