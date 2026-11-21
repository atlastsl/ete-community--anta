import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Production from '#models/production'

export default class ProductionFile extends BaseModel {
  static table = 'production_files'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare productionId: string

  @column()
  declare fileKey: string

  @column()
  declare originalName: string

  @column()
  declare mimeType: string

  @column()
  declare sizeBytes: number

  @column()
  declare storageProvider: string

  /** Prefix of the frame extracted from a hosted video (`posters/<id>/<token>`, Story 11.3). */
  @column()
  declare posterKey: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Production)
  declare production: BelongsTo<typeof Production>
}
