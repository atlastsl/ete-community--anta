/**
 * Libellés des langues affichés dans leur **nom natif** (Français/English), indépendamment
 * de la langue d'affichage de l'interface. La valeur stockée reste le code ISO court (`fr`/`en`).
 * Fallback : le code brut si non répertorié.
 */
export const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
}

export function languageLabel(code: string | null | undefined): string {
  if (!code) return ''
  return LANGUAGE_LABELS[code] ?? code
}

/** Options pour les sélecteurs de langue (valeur = code, libellé = nom natif). */
export const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
] as const
