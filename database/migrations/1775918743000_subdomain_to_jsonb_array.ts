import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `productions.subdomain` : string unique → tableau jsonb (multi-valeurs).
 * Convertit les valeurs existantes en tableau à 1 élément (ou []), met à jour la
 * fonction trigger `search_vector` (subdomain est désormais jsonb → `::text`), et
 * recalcule le search_vector des lignes existantes.
 */
const TRIGGER_FN = (subdomainExpr: string) => `
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
      ${subdomainExpr} || ' ' ||
      coalesce(NEW.language, '')
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE productions
        ALTER COLUMN subdomain DROP DEFAULT,
        ALTER COLUMN subdomain TYPE jsonb USING (
          CASE
            WHEN subdomain IS NULL OR subdomain = '' THEN '[]'::jsonb
            ELSE to_jsonb(ARRAY[subdomain])
          END
        )
      `)
      await db.rawQuery(`UPDATE productions SET subdomain = '[]'::jsonb WHERE subdomain IS NULL`)
      await db.rawQuery(`
        ALTER TABLE productions
        ALTER COLUMN subdomain SET DEFAULT '[]'::jsonb,
        ALTER COLUMN subdomain SET NOT NULL
      `)
      await db.rawQuery(TRIGGER_FN("coalesce(NEW.subdomain::text, '')"))
      // Recalcule search_vector des lignes existantes (le subdomain a changé de représentation).
      await db.rawQuery(`UPDATE productions SET subdomain = subdomain`)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE productions
        ALTER COLUMN subdomain DROP DEFAULT,
        ALTER COLUMN subdomain DROP NOT NULL,
        ALTER COLUMN subdomain TYPE varchar(255) USING (subdomain->>0)
      `)
      await db.rawQuery(TRIGGER_FN("coalesce(NEW.subdomain, '')"))
      await db.rawQuery(`UPDATE productions SET subdomain = subdomain`)
    })
  }
}
