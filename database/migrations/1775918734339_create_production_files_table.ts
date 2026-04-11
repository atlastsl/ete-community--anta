import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('production_id')
        .notNullable()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table.string('file_key').notNullable()
      table.string('original_name').notNullable()
      table.string('mime_type').notNullable()
      table.bigInteger('size_bytes').notNullable()
      table.string('storage_provider').notNullable().defaultTo('r2')

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
