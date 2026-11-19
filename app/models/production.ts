import {
  BaseModel,
  column,
  hasMany,
  belongsTo,
  manyToMany,
  beforeCreate,
} from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import type { ProductionStatus } from '#enums/production_status'
import type { LicenseStatus } from '#enums/license_status'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'
import StatsView from '#models/stats_view'
import StatsDownload from '#models/stats_download'
import ProductionService from '#services/production_service'

export default class Production extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  /** URL publique lisible (`/productions/:slug`). Unique. Généré à la création, jamais modifié. */
  @column()
  declare slug: string

  /**
   * Génère un slug unique à la création si non déjà fourni (admin, seeder via modèle, tests).
   * Le seeder de démo (multiInsert raw) pose le slug lui-même — ce hook ne s'y applique pas.
   */
  @beforeCreate()
  static async assignSlug(production: Production) {
    if (!production.slug) {
      production.slug = await ProductionService.generateUniqueSlug(production.title)
    }
  }

  @column()
  declare summary: string | null

  /** Denormalized "First Last" names, ordered like the pivot (P2-02). Read-only outside ProductionAuthorService (Story 9.6+). */
  @column({
    columnName: 'authors',
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare authorNames: string[]

  /** Ordered authors of the referential (pivot `production_authors`, Story 9.2). */
  @manyToMany(() => Author, {
    pivotTable: 'production_authors',
    pivotColumns: ['position'],
    // Not on sub-queries (`withCount`, `has`): an ORDER BY there breaks the aggregate.
    onQuery: (query) => {
      if (!query.isRelatedSubQuery) query.orderBy('production_authors.position', 'asc')
    },
  })
  declare authors: ManyToMany<typeof Author>

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare tags: string[]

  @column()
  declare category: string | null

  @column()
  declare domain: string | null

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare subdomain: string[]

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

  @hasMany(() => StatsView)
  declare statsViews: HasMany<typeof StatsView>

  @hasMany(() => StatsDownload)
  declare statsDownloads: HasMany<typeof StatsDownload>
}
