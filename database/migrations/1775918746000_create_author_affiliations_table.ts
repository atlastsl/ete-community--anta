import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ordered affiliations of an author (Phase 2, P2.1 - Story 9.1). Position 1 = primary
 * institution. Reordering is always DELETE + INSERT in a transaction (the UNIQUE
 * constraint is not deferrable).
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  protected tableName = 'author_affiliations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('author_id').notNullable().references('id').inTable('authors').onDelete('CASCADE')
      table.smallint('position').notNullable()
      table.string('institution', 255).notNullable()
      table.string('institution_key', 255).notNullable()
      table.string('department', 255).nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()

      table.unique(['author_id', 'position'])
      table.check('?? >= 1', ['position'], 'author_affiliations_position_check')
      table.index(['institution_key'], 'idx_author_affiliations_institution_key')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
