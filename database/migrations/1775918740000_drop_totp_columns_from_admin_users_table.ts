import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('totp_secret')
      table.dropColumn('totp_enabled')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('totp_secret').nullable()
      table.boolean('totp_enabled').notNullable().defaultTo(false)
    })
  }
}
