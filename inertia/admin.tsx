import './css/app.css'
import { client } from './client'
import { adminI18n } from '~/lib/i18n/admin'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { I18nextProvider } from 'react-i18next'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

const appName = import.meta.env.VITE_APP_NAME || 'Anta Admin'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    // Les contrôleurs rendent le nom complet (ex. 'admin/Productions/Index'),
    // donc on résout `./pages/${name}.tsx` (PAS `./pages/admin/${name}` → double 'admin/').
    // Glob large pour résoudre aussi les pages d'erreur sur une route /admin/*.
    return resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx'))
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <I18nextProvider i18n={adminI18n}>
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
