import i18next, { type i18n as I18nInstance } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export type I18nResources = Record<string, { translation: Record<string, unknown> }>

/**
 * Crée une instance i18next isolée avec la configuration Anta.
 *
 * Deux instances coexistent dans l'app :
 * - `publicI18n` charge `inertia/locales/public/{fr,en}.json` — utilisée par `app.tsx`
 * - `adminI18n` charge `inertia/locales/admin/{fr,en}.json` — utilisée par `admin.tsx`
 *
 * Chaque instance détecte la langue dans l'ordre :
 *   cookie `i18n_lang` → localStorage `i18n_lang` → langue navigateur → français par défaut
 *
 * Le choix utilisateur (via `i18n.changeLanguage()`) est persisté à la fois dans le cookie
 * (lisible côté serveur AdonisJS pour le SSR partiel des meta tags) et dans localStorage.
 */
export function createI18nInstance(resources: I18nResources): I18nInstance {
  const instance = i18next.createInstance()

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'fr',
      supportedLngs: ['fr', 'en'],
      defaultNS: 'translation',
      ns: ['translation'],
      interpolation: {
        escapeValue: false, // React échappe déjà nativement
      },
      detection: {
        order: ['cookie', 'localStorage', 'navigator'],
        lookupCookie: 'i18n_lang',
        lookupLocalStorage: 'i18n_lang',
        caches: ['cookie', 'localStorage'],
        cookieMinutes: 60 * 24 * 365, // 1 an
        cookieOptions: {
          path: '/',
          sameSite: 'lax',
          // secure en production uniquement (import.meta.env absent côté Node/tests → falsy)
          secure: import.meta.env?.PROD ?? false,
          // pas de HttpOnly — JS doit pouvoir écrire le cookie
        },
      },
      react: {
        useSuspense: false, // resources inline = synchrone, pas de Suspense nécessaire
      },
    })

  return instance
}
