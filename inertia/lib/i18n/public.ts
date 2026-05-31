import { createI18nInstance } from './shared'
import frPublic from '~/locales/public/fr.json'
import enPublic from '~/locales/public/en.json'

export const publicI18n = createI18nInstance({
  fr: { translation: frPublic },
  en: { translation: enPublic },
})
