import { BaseModel, column, belongsTo, beforeSave } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Author from '#models/author'
import { normalizeKey } from '#helpers/normalize'

/**
 * Ordered affiliation of an author (P2.1). Position 1 = primary institution.
 * Reorder with DELETE + INSERT (UNIQUE (author_id, position) is not deferrable).
 */
export default class AuthorAffiliation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare authorId: string

  @column()
  declare position: number

  @column()
  declare institution: string

  /** `normalizeKey(institution)`, written by `normalizeInstitutionKey`. */
  @column()
  declare institutionKey: string

  @column()
  declare department: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @beforeSave()
  static normalizeInstitutionKey(affiliation: AuthorAffiliation) {
    affiliation.institutionKey = normalizeKey(affiliation.institution ?? '')
  }

  @belongsTo(() => Author)
  declare author: BelongsTo<typeof Author>
}
