import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Featured productions (Phase 2, P2.1, P2-11 - Story 11.4): up to 3 ordered slots, the
 * position is the primary key. Rewritten by DELETE + INSERT in a transaction (never
 * `UPDATE position`: the primary key is not deferrable). A deleted production leaves the
 * selection (CASCADE); a deleted admin keeps the slot (SET NULL).
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  protected tableName = 'featured_productions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.smallint('position').primary()
      table
        .uuid('production_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table
        .uuid('created_by_id')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.check('?? BETWEEN 1 AND 3', ['position'], 'featured_productions_position_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
