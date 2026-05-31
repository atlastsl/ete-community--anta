import { createI18nInstance } from './shared'
import frAdmin from '~/locales/admin/fr.json'
import enAdmin from '~/locales/admin/en.json'

export const adminI18n = createI18nInstance({
  fr: { translation: frAdmin },
  en: { translation: enAdmin },
})
