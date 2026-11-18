import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Authors referential (Phase 2, P2.1 - Story 9.1).
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 * `search_name` is the normalized "first names last names" key written by the model
 * (`normalizeKey`), searched with pg_trgm (extension enabled by 1775918742000).
 */
export default class extends BaseSchema {
  protected tableName = 'authors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('slug', 255).notNullable().unique()
      table.string('first_names', 120).notNullable()
      table.string('last_names', 120).notNullable()
      table.text('search_name').notNullable()
      table.string('google_scholar_url', 500).nullable()
      table.string('photo_key', 255).nullable()
      table.timestamp('consent_confirmed_at').nullable()
      table
        .uuid('consent_confirmed_by_id')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')
      table.string('migration_key', 255).nullable().unique()
      table
        .uuid('created_by_id')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()

      table.index(['last_names'], 'idx_authors_last_names')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE INDEX IF NOT EXISTS idx_authors_search_name_trgm ON authors USING gin (search_name gin_trgm_ops)'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
