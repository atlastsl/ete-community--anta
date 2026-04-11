import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_activity_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('admin_user_id')
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('CASCADE')
      table.string('action_type').notNullable()
      table.string('resource_type').nullable()
      table.string('resource_id').nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))

      table.index(['admin_user_id'], 'idx_admin_activity_logs_admin_user_id')
      table.index(['created_at'], 'idx_admin_activity_logs_created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
