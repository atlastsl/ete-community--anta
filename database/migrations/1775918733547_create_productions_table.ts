import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'productions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('title').notNullable()
      table.text('summary').nullable()
      table.jsonb('authors').notNullable().defaultTo('[]')
      table.jsonb('tags').notNullable().defaultTo('[]')
      table.string('category').nullable()
      table.string('domain').nullable()
      table.string('subdomain').nullable()
      table.string('language').nullable()
      table.string('publication_country').nullable()
      table.string('journal').nullable()
      table.string('publisher').nullable()
      table.string('isbn_doi_issn').nullable()
      table.string('institution').nullable()
      table
        .enum('license_status', ['member', 'free_license', 'external_link'], {
          useNative: true,
          enumName: 'license_status',
          existingType: false,
        })
        .notNullable()
      table
        .enum('status', ['draft', 'published', 'unpublished'], {
          useNative: true,
          enumName: 'production_status',
          existingType: false,
        })
        .notNullable()
        .defaultTo('draft')
      table.date('work_published_at').nullable()
      table.timestamp('anta_published_at').nullable()
      table.specificType('search_vector', 'tsvector').nullable()
      table
        .uuid('created_by_id')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable().defaultTo(this.raw('now()'))
      table.timestamp('updated_at').nullable()

      table.index(['status'], 'idx_productions_status')
      table.index(['license_status'], 'idx_productions_license_status')
      table.index(['language'], 'idx_productions_language')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION productions_search_vector_update()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := to_tsvector(
            'simple',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.summary, '') || ' ' ||
            coalesce(NEW.authors::text, '') || ' ' ||
            coalesce(NEW.tags::text, '') || ' ' ||
            coalesce(NEW.category, '') || ' ' ||
            coalesce(NEW.domain, '') || ' ' ||
            coalesce(NEW.subdomain, '') || ' ' ||
            coalesce(NEW.language, '')
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)

      await db.rawQuery(`
        CREATE TRIGGER productions_search_vector_trigger
        BEFORE INSERT OR UPDATE ON productions
        FOR EACH ROW EXECUTE FUNCTION productions_search_vector_update();
      `)

      await db.rawQuery(`
        CREATE INDEX idx_productions_search_vector
        ON productions USING GIN (search_vector);
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP TRIGGER IF EXISTS productions_search_vector_trigger ON productions')
      await db.rawQuery('DROP FUNCTION IF EXISTS productions_search_vector_update()')
    })
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS "license_status"')
    this.schema.raw('DROP TYPE IF EXISTS "production_status"')
  }
}
