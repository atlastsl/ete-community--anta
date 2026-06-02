import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  /**
   * Vue racine (HTML shell) selon le périmètre :
   * - `/admin/*` → `admin_layout.edge` qui charge `inertia/admin.tsx` (adminI18n + bundle admin)
   * - reste     → `inertia_layout.edge` qui charge `inertia/app.tsx` (publicI18n + bundle public)
   * Sans ce routage, toutes les pages chargeraient `app.tsx`/publicI18n et les clés i18n
   * admin (locales/admin/*) ne seraient jamais chargées (→ clés brutes dans le panel).
   */
  rootView: (ctx) => (ctx.request.url().startsWith('/admin') ? 'admin_layout' : 'inertia_layout'),

  /**
   * Server-side rendering options.
   */
  ssr: {
    /**
     * Toggle SSR mode for Inertia pages.
     */
    enabled: false,

    /**
     * Entry file used by the SSR server build.
     */
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
