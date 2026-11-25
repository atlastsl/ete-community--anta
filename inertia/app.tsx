import './css/app.css'
import { ReactElement } from 'react'
import { client } from './client'
import PublicLayout from '~/layouts/PublicLayout'
import { publicI18n } from '~/lib/i18n/public'
import { documentLang } from '~/lib/content_lang'
import { Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { I18nextProvider } from 'react-i18next'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'Anta'

// `<html lang>` follows the interface language (Story 13.2, WCAG 3.1.1): the server renders it
// from the `i18n_lang` cookie only, while i18next may detect another language (localStorage,
// browser) and `LanguageSwitcher` changes it without a reload.
const syncDocumentLang = (language?: string) => {
  document.documentElement.lang = documentLang(language)
}
syncDocumentLang(publicI18n.resolvedLanguage ?? publicI18n.language)
publicI18n.on('languageChanged', syncDocumentLang)

createInertiaApp({
  // Public titles come complete from `SeoService` (« … — Anta ») through PublicLayout's <Head>.
  title: (title) => title || appName,
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob('./pages/**/*.tsx'),
      (page: ReactElement<Data.SharedProps>) => <PublicLayout children={page} />
    )
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <I18nextProvider i18n={publicI18n}>
        <TuyauProvider client={client}>
          <App {...props} />
        </TuyauProvider>
      </I18nextProvider>
    )
  },
  progress: {
    color: '#15803d',
  },
})
