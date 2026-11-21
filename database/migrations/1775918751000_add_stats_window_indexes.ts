import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Indexes of the 365-day windows (P2.1, P2.3 - Story 10.5): per-production views and downloads
 * by date, and downloads by date (the views equivalent `idx_stats_views_recorded_at` exists).
 * Small tables: plain CREATE INDEX inside the migration transaction (no CONCURRENTLY).
 *
 * Additive only - shared dev/staging database: down() is written but never executed.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('stats_views', (table) => {
      table.index(['production_id', 'recorded_at'], 'idx_stats_views_production_id_recorded_at')
    })
    this.schema.alterTable('stats_downloads', (table) => {
      table.index(
        ['production_id', 'downloaded_at'],
        'idx_stats_downloads_production_id_downloaded_at'
      )
      table.index(['downloaded_at'], 'idx_stats_downloads_downloaded_at')
    })
  }

  async down() {
    this.schema.alterTable('stats_downloads', (table) => {
      table.dropIndex(['downloaded_at'], 'idx_stats_downloads_downloaded_at')
      table.dropIndex(
        ['production_id', 'downloaded_at'],
        'idx_stats_downloads_production_id_downloaded_at'
      )
    })
    this.schema.alterTable('stats_views', (table) => {
      table.dropIndex(['production_id', 'recorded_at'], 'idx_stats_views_production_id_recorded_at')
    })
  }
}
