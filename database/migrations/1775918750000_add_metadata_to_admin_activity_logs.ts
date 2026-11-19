import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Details of the Phase 2 activity events (P2.6 - Story 9.1). NULL for existing rows.
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  protected tableName = 'admin_activity_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('metadata').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('metadata')
    })
  }
}
