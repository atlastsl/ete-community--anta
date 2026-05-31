import './css/app.css'
import { ReactElement } from 'react'
import { client } from './client'
import PublicLayout from '~/layouts/PublicLayout'
import { publicI18n } from '~/lib/i18n/public'
import { Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { I18nextProvider } from 'react-i18next'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'Anta'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
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
