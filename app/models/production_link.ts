import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Production from '#models/production'

export default class ProductionLink extends BaseModel {
  static table = 'production_links'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column()
  declare url: string

  @column()
  declare linkType: 'embed' | 'simple'

  @column()
  declare label: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
