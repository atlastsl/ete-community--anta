import { formatAuthorName } from '#helpers/author_name'

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
  ogUrl?: string
  /**
   * Absolute URL of the preview image (`og:image`, `twitter:card=summary_large_image`): author
   * profiles only, the `og.jpg` variant of the public photo (P2.5, P2.7). Productions never
   * have one (D37).
   */
  ogImage?: string
  locale: Locale
}

/** Prefix of a public author photo base (`MediaService.authorPhotoUrl`). */
const AUTHOR_PHOTO_PREFIX = '/media/authors/'
/** Variant of the author photos made for the social previews (1200×630 JPEG, `ImageService`). */
const AUTHOR_OG_VARIANT = 'og.jpg'

/** `appUrl` (any trailing slash dropped) + `path`, or `undefined` without a configured URL. */
function absoluteUrl(appUrl: string | null | undefined, path: string): string | undefined {
  const base = appUrl?.trim().replace(/\/+$/, '')
  return base ? `${base}${path}` : undefined
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

  /** Meta de la politique de confidentialité (titre dédié, Story 10.1). */
  static privacy(locale: Locale): MetaTags {
    const { name, description } = SITE[locale]
    const title = `${locale === 'fr' ? 'Politique de confidentialité' : 'Privacy policy'} — ${name}`
    return {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogType: 'website',
      locale,
    }
  }

  /** Meta de la NotFoundPage (statut 404, titre traduit, D36 — Story 10.1). */
  static notFound(locale: Locale): MetaTags {
    const { name } = SITE[locale]
    const title = `${locale === 'fr' ? 'Page introuvable' : 'Page not found'} — ${name}`
    const description =
      locale === 'fr'
        ? "Cette page n'existe pas ou n'est plus disponible."
        : 'This page does not exist or is no longer available.'
    return {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogType: 'website',
      locale,
    }
  }

  /**
   * Meta de la liste des auteurs (Story 10.5 ; 10.7 : `ogUrl` absolue `/authors`, sans les
   * paramètres de filtre, de tri ni de page). Titre et description = phrase d'introduction.
   */
  static authorsList(locale: Locale, appUrl?: string | null): MetaTags {
    const { name } = SITE[locale]
    const title = `${locale === 'fr' ? 'Auteurs' : 'Authors'} — ${name}`
    const description =
      locale === 'fr'
        ? 'Les auteurs des productions publiées sur Anta.'
        : 'The authors of the productions published on Anta.'
    return {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogType: 'website',
      ogUrl: absoluteUrl(appUrl, '/authors'),
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

  /**
   * Meta de la page détail d'une production (FR36). `ogType: 'article'`.
   * Titre = `{titre} — Anta` ; description = auteurs + extrait du résumé (~160 car.).
   * Accepte une forme minimale (pas le modèle complet) pour rester testable sans BDD.
   */
  static forProduction(
    locale: Locale,
    production: {
      title: string
      summary?: string | null
      authors?: string[] | null
      slug?: string | null
    },
    appUrl?: string | null
  ): MetaTags {
    const { name } = SITE[locale]
    const title = `${production.title} — ${name}`

    const authors = (production.authors ?? []).filter(Boolean)
    const byline = authors.length > 0 ? authors.join(', ') : null
    const summary = production.summary?.trim() ?? ''
    const excerpt = summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}…` : summary
    const composed = [byline, excerpt].filter(Boolean).join(' — ') || SITE[locale].description
    // Plafond meta description (~200) : le byline peut être long (multi-auteurs).
    const description = composed.length > 200 ? `${composed.slice(0, 197).trimEnd()}…` : composed

    const slug = production.slug?.trim()
    const ogUrl = slug ? absoluteUrl(appUrl, `/productions/${slug}`) : undefined

    return {
      title,
      description,
      ogTitle: production.title,
      ogDescription: description,
      ogType: 'article',
      ogUrl,
      locale,
    }
  }

  /**
   * Meta of a visible author profile (FR36, P2.7; Story 10.3, `ogImage` in 10.7). "Prénom NOM":
   * the last names are upper-cased for display only (D34), like `formatAuthorName` on the front.
   * `photoBase` must come from `MediaService.authorPhotoUrl` (photo **and** consent): the
   * `og.jpg` variant of that public base becomes the absolute `ogImage`.
   */
  static forAuthor(
    locale: Locale,
    author: {
      firstNames: string
      lastNames: string
      slug?: string | null
      primaryInstitution?: string | null
      publishedCount: number
      photoBase?: string | null
    },
    appUrl?: string | null
  ): MetaTags {
    const { name } = SITE[locale]
    const displayName = formatAuthorName(author.firstNames, author.lastNames)
    const title = `${displayName} — ${name}`

    const n = author.publishedCount
    const count =
      locale === 'fr'
        ? `${n} ${n > 1 ? 'productions publiées' : 'production publiée'} sur ${name}`
        : `${n} ${n === 1 ? 'production' : 'productions'} published on ${name}`
    const institution = author.primaryInstitution?.trim()
    const description = institution ? `${institution} — ${count}` : count

    const slug = author.slug?.trim()
    const ogUrl = slug ? absoluteUrl(appUrl, `/authors/${slug}`) : undefined
    const photoBase = author.photoBase
    const ogImage =
      photoBase?.startsWith(AUTHOR_PHOTO_PREFIX) && photoBase.length > AUTHOR_PHOTO_PREFIX.length
        ? absoluteUrl(appUrl, `${photoBase}/${AUTHOR_OG_VARIANT}`)
        : undefined

    return {
      title,
      description,
      ogTitle: displayName,
      ogDescription: description,
      ogType: 'profile',
      ogUrl,
      ogImage,
      locale,
    }
  }
}
