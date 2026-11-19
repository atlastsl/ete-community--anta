/**
 * URL slug: NFD transliteration, diacritics stripped, lower case, runs of other
 * characters → `-`, truncated to `maxLength` without a trailing dash.
 * Returns '' when nothing survives: the caller owns the fallback ('production', 'auteur').
 *
 * The copy in migration 1775918744000_add_slug_to_productions_table.ts stays frozen.
 */
export function slugify(value: string, maxLength = 80): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}
