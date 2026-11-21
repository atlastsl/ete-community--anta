/**
 * "Prénom NOM": last name upper-cased for display only, the data keeps its case (D13, D34).
 * Server mirror of `formatAuthorName` in `inertia/lib/author_form.ts` (TS boundary TS6305:
 * keep both in sync).
 */
export function formatAuthorName(firstNames: string, lastNames: string): string {
  return `${firstNames} ${lastNames.toLocaleUpperCase('fr-FR')}`.trim()
}
