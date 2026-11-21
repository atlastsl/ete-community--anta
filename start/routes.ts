/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import env from '#start/env'

router.get('/', [controllers.public.Home, 'index']).as('home')
router.get('/productions', [controllers.public.Productions, 'index']).as('productions')
// Détail par slug — APRÈS le listing pour éviter tout shadowing de `/productions`.
router.get('/productions/:slug', [controllers.public.Productions, 'show']).as('production.show')
router
  .get('/productions/:slug/files/:fileId/download', [controllers.public.Productions, 'download'])
  .as('production.download')
// Liste des auteurs visibles (P2.6, Story 10.5) puis profil public d'un auteur visible (D11) ; 404 sinon.
router.get('/authors', [controllers.public.Authors, 'index']).as('authors.index')
router.get('/authors/:slug', [controllers.public.Authors, 'show']).as('authors.show')
router.get('/privacy-policy', [controllers.public.Pages, 'privacy']).as('privacy-policy')
// Images publiques adossées à R2 (P2.5) : photos d'auteurs à profil public. Les fichiers
// sous licence (`productions/…`) ne passent jamais par ici (URL signées).
// Servie avant le routeur par `MediaMiddleware` (sans session ni cookies) ; la route reste
// déclarée pour le nommage et la construction d'URL.
router.get('/media/*', [controllers.public.Media, 'show']).as('media.show')

// Health check (Docker / déploiement) — sans base de données ni rendu.
// `revision` : commit de l'image, vérifié par le health check du déploiement (Story 8.4).
router
  .get('/health', ({ response }) =>
    response.ok({ status: 'ok', revision: env.get('ANTA_REVISION', 'unknown') })
  )
  .as('health')

// Beacon de vue (FR25) — public, exempté de CSRF dans config/shield.ts (fire-and-forget).
router.post('/stats/view', [controllers.public.Stats, 'view']).as('stats.view')

// --- Routes legacy (starter AdonisJS) ---
// Conservées pour compatibilité ; remplacées par /admin/* à partir de l'Epic 2.
router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

// --- Panel admin ---
router
  .group(() => {
    // Routes publiques (login) — pas de middleware admin
    router.get('login', [controllers.admin.Auth, 'showLogin']).as('admin.login')
    router.post('login', [controllers.admin.Auth, 'login']).as('admin.login.submit')

    // Routes authentifiées (AdminMiddleware = auth + isActive + role + redirect change-password)
    router
      .group(() => {
        router.post('logout', [controllers.admin.Auth, 'logout']).as('admin.logout')

        router
          .get('auth/change-password', [controllers.admin.Auth, 'showChangePassword'])
          .as('admin.auth.change-password')
        router
          .post('auth/change-password', [controllers.admin.Auth, 'changePassword'])
          .as('admin.auth.change-password.submit')

        router
          .get('productions/create', [controllers.admin.Productions, 'create'])
          .as('admin.productions.create')
        router
          .get('productions/:id/edit', [controllers.admin.Productions, 'edit'])
          .as('admin.productions.edit')
        router.get('productions', [controllers.admin.Productions, 'index']).as('admin.productions')
        router
          .put('productions/:id', [controllers.admin.Productions, 'update'])
          .as('admin.productions.update')
        router
          .delete('productions/:id', [controllers.admin.Productions, 'destroy'])
          .as('admin.productions.destroy')
        router
          .post('productions/:id/unpublish', [controllers.admin.Productions, 'unpublish'])
          .as('admin.productions.unpublish')
        router
          .post('productions', [controllers.admin.Productions, 'store'])
          .as('admin.productions.store')
        router
          .post('productions/:id/publish', [controllers.admin.Productions, 'publish'])
          .as('admin.productions.publish')
        router
          .post('productions/:productionId/files', [controllers.admin.Files, 'store'])
          .as('admin.productions.files.store')
        router
          .delete('productions/:productionId/files/:fileId', [controllers.admin.Files, 'destroy'])
          .as('admin.productions.files.destroy')
        router
          .post('productions/:productionId/links', [controllers.admin.Links, 'store'])
          .as('admin.productions.links.store')
        router
          .delete('productions/:productionId/links/:linkId', [controllers.admin.Links, 'destroy'])
          .as('admin.productions.links.destroy')
        // Vignette d'une production (Story 11.1, D37) : téléversement / retrait immédiats.
        router
          .post('productions/:productionId/thumbnail', [controllers.admin.Thumbnails, 'store'])
          .as('admin.productions.thumbnail.store')
        router
          .delete('productions/:productionId/thumbnail', [controllers.admin.Thumbnails, 'destroy'])
          .as('admin.productions.thumbnail.destroy')
        router
          .get('authors/create', [controllers.admin.Authors, 'create'])
          .as('admin.authors.create')
        router
          .get('authors/search', [controllers.admin.Authors, 'search'])
          .as('admin.authors.search')
        router
          .post('authors/quick', [controllers.admin.Authors, 'quickStore'])
          .as('admin.authors.quick-store')
        router.get('authors/:id/edit', [controllers.admin.Authors, 'edit']).as('admin.authors.edit')
        router.get('authors', [controllers.admin.Authors, 'index']).as('admin.authors')
        router.post('authors', [controllers.admin.Authors, 'store']).as('admin.authors.store')
        router.put('authors/:id', [controllers.admin.Authors, 'update']).as('admin.authors.update')
        router
          .delete('authors/:id', [controllers.admin.Authors, 'destroy'])
          .as('admin.authors.destroy')
        router
          .post('authors/:id/confirm-consent', [controllers.admin.Authors, 'confirmConsent'])
          .as('admin.authors.confirm-consent')
        router
          .post('authors/:id/withdraw-consent', [controllers.admin.Authors, 'withdrawConsent'])
          .as('admin.authors.withdraw-consent')
        router.get('stats', [controllers.admin.Dashboard, 'stats']).as('admin.stats')

        // Sous-groupe super_admin uniquement
        router
          .group(() => {
            router.get('users/create', [controllers.admin.Users, 'create']).as('admin.users.create')
            router.get('users', [controllers.admin.Users, 'index']).as('admin.users')
            router.post('users', [controllers.admin.Users, 'store']).as('admin.users.store')
            router
              .patch('users/:id/toggle-active', [controllers.admin.Users, 'toggleActive'])
              .as('admin.users.toggle-active')
            router
              .post('users/:id/reset-password', [controllers.admin.Users, 'resetPassword'])
              .as('admin.users.reset-password')
            router
              .delete('users/:id', [controllers.admin.Users, 'destroy'])
              .as('admin.users.destroy')
            router.get('activity', [controllers.admin.ActivityLogs, 'index']).as('admin.activity')
          })
          .use(middleware.superAdmin())
      })
      .use(middleware.admin())
  })
  .prefix('admin')
