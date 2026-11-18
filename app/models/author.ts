import { BaseModel, column, hasMany, beforeSave, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import AuthorAffiliation from '#models/author_affiliation'
import { normalizeKey } from '#helpers/normalize'
import { slugify } from '#helpers/slug'

/**
 * Author of the referential (Phase 2, P2.1). Names keep the case typed by the admin
 * (D34): "Prénom NOM" is a display concern of the front.
 */
export default class Author extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  /** Public URL `/authors/:slug`. Generated at creation, then frozen (D28). */
  @column()
  declare slug: string

  @column()
  declare firstNames: string

  @column()
  declare lastNames: string

  /** `normalizeKey("first names last names")`, written by `normalizeSearchName`. */
  @column()
  declare searchName: string

  @column()
  declare googleScholarUrl: string | null

  @column()
  declare photoKey: string | null

  @column.dateTime()
  declare consentConfirmedAt: DateTime | null

  @column()
  declare consentConfirmedById: string | null

  /** Grouping key of the conversion CSV (FR56); NULL = created in the admin panel. */
  @column()
  declare migrationKey: string | null

  @column()
  declare createdById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => AuthorAffiliation, {
    onQuery: (query) => query.orderBy('position', 'asc'),
  })
  declare affiliations: HasMany<typeof AuthorAffiliation>

  @beforeSave()
  static normalizeSearchName(author: Author) {
    author.searchName = normalizeKey(`${author.firstNames ?? ''} ${author.lastNames ?? ''}`)
  }

  /** Slug only at creation: no hook ever recomputes it on update (D28). */
  @beforeCreate()
  static async assignSlug(author: Author) {
    if (!author.slug) {
      author.slug = await Author.generateUniqueSlug(author)
    }
  }

  /** `prenom-nom`, fallback `auteur`, then `-2`, `-3`… while the slug is taken. */
  static async generateUniqueSlug(author: Author): Promise<string> {
    const base = slugify(`${author.firstNames ?? ''} ${author.lastNames ?? ''}`) || 'auteur'
    const client = author.$trx
    let candidate = base
    let n = 2
    while (await Author.query({ client }).where('slug', candidate).first()) {
      candidate = `${base}-${n}`
      n++
    }
    return candidate
  }
}
