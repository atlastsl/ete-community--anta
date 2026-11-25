/**
 * Language of the contents (Story 13.2, WCAG 3.1.1 / 3.1.2): the `lang` attribute of the titles
 * and summaries of a production whose `language` differs from the interface language, and the
 * `lang` of `<html>`. Pure helpers (no import): loaded at runtime by the unit tests.
 *
 * `productions.language` is free text (the admin form stores `fr` / `en`, migrated rows may hold
 * a language name): known codes and names map to a BCP 47 tag, anything else to `null` (no
 * attribute rather than a wrong one).
 */

/** Language names (FR / EN, lower case, without accents) and ISO 639-2 codes → ISO 639-1. */
const LANGUAGE_ALIASES: Record<string, string> = {
  francais: 'fr',
  french: 'fr',
  fra: 'fr',
  fre: 'fr',
  anglais: 'en',
  english: 'en',
  eng: 'en',
  arabe: 'ar',
  arabic: 'ar',
  ara: 'ar',
  espagnol: 'es',
  spanish: 'es',
  spa: 'es',
  portugais: 'pt',
  portuguese: 'pt',
  por: 'pt',
  allemand: 'de',
  german: 'de',
  deu: 'de',
  ger: 'de',
  italien: 'it',
  italian: 'it',
  ita: 'it',
  wolof: 'wo',
  wol: 'wo',
  swahili: 'sw',
  swa: 'sw',
}

/** `fr`, `EN`, `fr-CA`, `en_us`, `pt-BR`, `es-419` (language of 2 letters, optional region). */
const TAG_PATTERN = /^([a-z]{2})(?:[-_]([a-z]{2}|\d{3}))?$/i

/**
 * Is `code` a language (or region) known to the platform? `Intl.DisplayNames` with
 * `fallback: 'code'` echoes unknown codes (`xx`, `qq`); `ZZ` is CLDR's "unknown region".
 */
function known(type: 'language' | 'region', code: string): boolean {
  if (type === 'region' && code === 'ZZ') return false
  try {
    const name = new Intl.DisplayNames(['en'], { type, fallback: 'code' }).of(code)
    return !!name && name !== code
  } catch {
    return false
  }
}

/** BCP 47 tag of a stored language value, `null` when it cannot be recognised. */
export function languageTag(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const tag = TAG_PATTERN.exec(trimmed)
  if (tag) {
    // Only known languages (`xx` is not one); an unknown region is dropped, not the language.
    const language = tag[1].toLowerCase()
    if (!known('language', language)) return null
    const region = tag[2]?.toUpperCase()
    return region && known('region', region) ? `${language}-${region}` : language
  }
  const key = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return LANGUAGE_ALIASES[key] ?? null
}

/** Primary language subtag (`fr-CA` → `fr`), lower case. */
function primary(tag: string): string {
  return tag.split(/[-_]/)[0].toLowerCase()
}

/**
 * `lang` attribute of a production content: its tag when its primary language differs from the
 * interface one, `undefined` otherwise (same language, or language unknown → inherits `<html>`).
 */
export function contentLang(
  language: string | null | undefined,
  uiLanguage: string | null | undefined
): string | undefined {
  const tag = languageTag(language)
  if (!tag) return undefined
  if (uiLanguage && primary(tag) === primary(uiLanguage)) return undefined
  return tag
}

/** `lang` of `<html>` for an interface language (`fr` / `en`; anything else → `fr`). */
export function documentLang(uiLanguage: string | null | undefined): 'fr' | 'en' {
  return uiLanguage && primary(uiLanguage) === 'en' ? 'en' : 'fr'
}
