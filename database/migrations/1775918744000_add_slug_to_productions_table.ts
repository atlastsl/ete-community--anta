import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds `productions.slug` (human-readable URL `/productions/:slug` - Story 6.1).
 *
 * Sequence (raw, single `this.defer` to guarantee ordering, cf. subdomain migration):
 *  1. ADD COLUMN slug (nullable)
 *  2. Backfill: unique slug derived from the title for every existing row (300 seeded + others)
 *  3. SET NOT NULL + unique index
 *
 * `slugify` is duplicated here (raw migration context, no service boot) - must stay
 * identical to `ProductionService.generateSlug`.
 */
function slugify(title: string): string {
  const base = (title ?? '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // strip diacritics (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
  return base || 'production'
}

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery('ALTER TABLE productions ADD COLUMN slug varchar(255)')

      const res = await db.rawQuery('SELECT id, title FROM productions')
      const used = new Set<string>()
      for (const row of res.rows as { id: string; title: string }[]) {
        const base = slugify(row.title)
        let candidate = base
        let n = 2
        while (used.has(candidate)) {
          candidate = `${base}-${n}`
          n++
        }
        used.add(candidate)
        await db.rawQuery('UPDATE productions SET slug = ? WHERE id = ?', [candidate, row.id])
      }

      await db.rawQuery('ALTER TABLE productions ALTER COLUMN slug SET NOT NULL')
      await db.rawQuery('CREATE UNIQUE INDEX productions_slug_unique ON productions (slug)')
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS productions_slug_unique')
      await db.rawQuery('ALTER TABLE productions DROP COLUMN IF EXISTS slug')
    })
  }
}
