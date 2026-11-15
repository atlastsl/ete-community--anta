import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/vite'

/**
 * Dev on the VPS behind `tailscale serve` (Story 8.1): the HMR WebSocket
 * (port 24678) is exposed over HTTPS on its own tailnet port, so the client
 * must connect with wss:// on that port, and Vite must accept the tailnet
 * host (taken from APP_URL). Unset locally: Vite defaults apply.
 */
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT) || undefined
const proxyDevServer = hmrClientPort
  ? {
      hmr: { protocol: 'wss', clientPort: hmrClientPort },
      allowedHosts: process.env.APP_URL ? [new URL(process.env.APP_URL).hostname] : [],
    }
  : {}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    inertia({ ssr: { enabled: false, entrypoint: 'inertia/ssr.tsx' } }),
    adonisjs({
      entrypoints: ['inertia/app.tsx', 'inertia/admin.tsx'],
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
    },
  },

  server: {
    ...proxyDevServer,
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})
