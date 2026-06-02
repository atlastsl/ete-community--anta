import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Active l'extension PostgreSQL `pg_trgm` + index trigram GIN sur `productions.title`.
 * Sert aux « résultats approchants » (proximité orthographique) du site public quand
 * la recherche full-text exacte ne renvoie rien (SearchService.approximate).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS pg_trgm')
      await db.rawQuery(
        'CREATE INDEX IF NOT EXISTS idx_productions_title_trgm ON productions USING gin (title gin_trgm_ops)'
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS idx_productions_title_trgm')
      // L'extension pg_trgm n'est pas supprimée (peut être utilisée ailleurs).
    })
  }
}
