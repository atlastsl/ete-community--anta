import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ordered pivot production ↔ author (Phase 2, P2.1 - Story 9.2). Reordering is always
 * DELETE + INSERT in a transaction.
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  protected tableName = 'production_authors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .uuid('production_id')
        .notNullable()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table.uuid('author_id').notNullable().references('id').inTable('authors').onDelete('RESTRICT')
      table.smallint('position').notNullable()

      table.primary(['production_id', 'author_id'])
      table.unique(['production_id', 'position'])
      table.check('?? >= 1', ['position'], 'production_authors_position_check')
      table.index(['author_id'], 'idx_production_authors_author_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
