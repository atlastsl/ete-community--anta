import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import publicEn from '~/locales/public/en.json'
import publicFr from '~/locales/public/fr.json'
import adminEn from '~/locales/admin/en.json'
import adminFr from '~/locales/admin/fr.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    defaultNS: 'public',
    ns: ['public', 'admin'],
    resources: {
      fr: { public: publicFr, admin: adminFr },
      en: { public: publicEn, admin: adminEn },
    },
    detection: {
      order: ['cookie', 'navigator'],
      lookupCookie: 'i18n_lang',
      caches: ['cookie'],
      cookieOptions: { path: '/', sameSite: 'strict' },
    },
    interpolation: { escapeValue: false },
  })

export default i18n
