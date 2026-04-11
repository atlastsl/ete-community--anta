import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stats_views'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('production_id')
        .notNullable()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table.timestamp('recorded_at').notNullable().defaultTo(this.raw('now()'))
      table.string('ip_hash').nullable()
      table.string('session_id').nullable()

      table.index(['production_id'], 'idx_stats_views_production_id')
      table.index(['recorded_at'], 'idx_stats_views_recorded_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
