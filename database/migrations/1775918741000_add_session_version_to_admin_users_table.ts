import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Incrémenté lors d'une réinitialisation de mot de passe pour invalider
      // toutes les sessions actives de ce compte (comparé au marqueur stocké en session).
      table.integer('session_version').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_version')
    })
  }
}
