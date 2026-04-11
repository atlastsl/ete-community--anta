import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stats_downloads'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('production_id')
        .notNullable()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table.timestamp('downloaded_at').notNullable().defaultTo(this.raw('now()'))
      table.string('ip_hash').nullable()

      table.index(['production_id'], 'idx_stats_downloads_production_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
