import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import type { ProductionStatus } from '#enums/production_status'
import type { LicenseStatus } from '#enums/license_status'
import AdminUser from '#models/admin_user'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'

export default class Production extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  @column()
  declare summary: string | null

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare authors: string[]

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare tags: string[]

  @column()
  declare category: string | null

  @column()
  declare domain: string | null

  @column()
  declare subdomain: string | null

  @column()
  declare language: string | null

  @column()
  declare publicationCountry: string | null

  @column()
  declare journal: string | null

  @column()
  declare publisher: string | null

  @column()
  declare isbnDoiIssn: string | null

  @column()
  declare institution: string | null

  @column()
  declare licenseStatus: LicenseStatus

  @column()
  declare status: ProductionStatus

  @column.date()
  declare workPublishedAt: DateTime | null

  @column.dateTime()
  declare antaPublishedAt: DateTime | null

  @column()
  declare createdById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => AdminUser, { foreignKey: 'createdById' })
  declare createdBy: BelongsTo<typeof AdminUser>

  @hasMany(() => ProductionFile)
  declare files: HasMany<typeof ProductionFile>

  @hasMany(() => ProductionLink)
  declare links: HasMany<typeof ProductionLink>
}
