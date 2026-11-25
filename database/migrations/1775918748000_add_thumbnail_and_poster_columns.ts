import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Banner images (P2.1 - Story 11.1): `productions.thumbnail_key` (uploaded thumbnail,
 * `thumbnails/<productionId>/<token>`) and `production_files.poster_key` (frame extracted
 * from a hosted video, `posters/<fileId>/<token>`, written from Story 11.3). Prefixes of
 * fixed-size variants: no width/height stored.
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('productions', (table) => {
      table.string('thumbnail_key', 255).nullable()
    })
    this.schema.alterTable('production_files', (table) => {
      table.string('poster_key', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable('production_files', (table) => {
      table.dropColumn('poster_key')
    })
    this.schema.alterTable('productions', (table) => {
      table.dropColumn('thumbnail_key')
    })
  }
}
