import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'production_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('production_id')
        .notNullable()
        .references('id')
        .inTable('productions')
        .onDelete('CASCADE')
      table.string('url').notNullable()
      table
        .enum('link_type', ['embed', 'simple'], {
          useNative: true,
          enumName: 'link_type',
          existingType: false,
        })
        .notNullable()
      table.string('label').nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "link_type"')
  }
}
