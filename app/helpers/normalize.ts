/**
 * Accent- and case-insensitive key (P2.1): NFD, diacritics stripped, lower case,
 * whitespace collapsed, trimmed. Single source for `authors.search_name`,
 * `author_affiliations.institution_key` and the search terms compared with them.
 */
export function normalizeKey(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
