import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('email', 254).notNullable().unique()
      table.string('password_hash').notNullable()
      table
        .enum('role', ['admin', 'super_admin'], {
          useNative: true,
          enumName: 'admin_role',
          existingType: false,
        })
        .notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.string('totp_secret').nullable()
      table.boolean('totp_enabled').notNullable().defaultTo(false)
      table.boolean('password_changed').notNullable().defaultTo(false)
      table
        .uuid('created_by_id')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "admin_role"')
  }
}
