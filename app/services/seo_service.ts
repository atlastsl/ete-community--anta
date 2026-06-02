export type Locale = 'fr' | 'en'

/**
 * Meta tags injectés côté serveur dans le HTML shell (SSR partiel — FR36).
 * Rendus par `resources/views/inertia_layout.edge` via `page.props.meta`, donc
 * visibles par les crawlers AVANT l'hydratation React (`ssr: false`).
 */
export type MetaTags = {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogType: string
  locale: Locale
}

/**
 * Chaînes de marque côté serveur (indépendantes des locales React `inertia/locales/*`,
 * qui sont client). Pas de dépendance i18n serveur.
 */
const SITE: Record<Locale, { name: string; description: string }> = {
  fr: {
    name: 'Anta',
    description:
      'Anta — bibliothèque numérique communautaire : recherchez et découvrez des productions.',
  },
  en: {
    name: 'Anta',
    description: 'Anta — community digital library: search and discover productions.',
  },
}

export default class SeoService {
  /** Normalise une valeur de langue vers une locale supportée (défaut `fr`). */
  static resolveLocale(value?: string | null): Locale {
    return value === 'en' ? 'en' : 'fr'
  }

  /**
   * Extrait la locale du cookie brut `i18n_lang` depuis l'en-tête `Cookie`.
   * Lecture directe de l'en-tête : le cookie est posé par i18next côté client
   * (non signé / non encodé AdonisJS) — `request.cookie()`/`plainCookie()` ne le
   * décodent pas correctement. Défaut `fr` si absent/invalide.
   */
  static localeFromCookieHeader(cookieHeader?: string | null): Locale {
    if (!cookieHeader) return 'fr'
    const match = cookieHeader.match(/(?:^|;\s*)i18n_lang=(fr|en)(?:;|$)/)
    return match?.[1] === 'en' ? 'en' : 'fr'
  }

  /** Meta génériques du site (accueil). */
  static site(locale: Locale): MetaTags {
    const { name, description } = SITE[locale]
    return {
      title: name,
      description,
      ogTitle: name,
      ogDescription: description,
      ogType: 'website',
      locale,
    }
  }

  /** Meta du listing (avec ou sans terme de recherche). */
  static listing(locale: Locale, q?: string | null): MetaTags {
    const { name, description } = SITE[locale]
    const term = q?.trim()
    const title = term
      ? locale === 'fr'
        ? `Recherche : ${term} — ${name}`
        : `Search: ${term} — ${name}`
      : `Productions — ${name}`

    return {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogType: 'website',
      locale,
    }
  }

  // Epic 6 — page détail : `static forProduction(locale, production): MetaTags`
  // renverra `ogType: 'article'` + titre/description issus de la production,
  // en réutilisant le même mécanisme (prop `meta` + rendu edge).
}
