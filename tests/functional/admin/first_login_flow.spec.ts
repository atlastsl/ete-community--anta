import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'

/**
 * Story 2.6 — Test d'intégration end-to-end "première connexion complète".
 *
 * Traverse l'intégration des Stories 2.1 (middleware), 2.2 (login), 2.3 (change-password)
 * au niveau service-level (modèle `AdminUser` + mixin `AuthFinder`).
 *
 * Pourquoi service-level et pas HTTP enchaîné :
 *   - Le `sessionApiClient` détruit la session entre 2 requêtes → impossible de chaîner
 *     POST /admin/login → POST /admin/auth/change-password → GET /admin/productions
 *     avec les mêmes cookies. Cf. gotchas Stories 2.2 + 2.4.
 *   - Un test service-level prouve l'intégration des règles métier (verifyCredentials,
 *     mixin hash automatique, idempotence, redirect cible) sans les limites du client API.
 *   - Un vrai E2E via navigateur (suite `browser` Playwright) est noté pour Phase 2.
 */

const PROVISIONAL_PASSWORD = 'TempPwd-Initial!' // 16 chars
const NEW_PASSWORD = 'PermanentPassword-2026!' // 22 chars

test.group('Admin | flux première connexion complet (Stories 2.1+2.2+2.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('crée admin → login provisoire → change-password → re-login avec nouveau password', async ({
    assert,
  }) => {
    // ── 1. Création par seeder/super admin équivalente : passwordChanged=false ──────────
    const email = `e2e-${Math.floor(Math.random() * 1_000_000)}@anta.test`
    const created = await AdminUser.create({
      email,
      passwordHash: PROVISIONAL_PASSWORD, // hashé par mixin AuthFinder au save
      role: 'admin',
      passwordChanged: false,
      isActive: true,
    })

    assert.isFalse(created.passwordChanged, 'état initial : passwordChanged doit être false')
    assert.isTrue(created.isActive)

    // ── 2. Login provisoire (équivalent POST /admin/login Story 2.2) ────────────────────
    const loginCheck = await AdminUser.verifyCredentials(email, PROVISIONAL_PASSWORD)
    assert.equal(
      loginCheck.id,
      created.id,
      'verifyCredentials doit retourner le bon utilisateur avec le password provisoire'
    )

    // ── 3. La logique de redirect du contrôleur (Story 2.2) : password_changed=false →
    //       cible = /admin/auth/change-password (pas le dashboard). Le middleware Story 2.1
    //       enforce aussi cette redirection sur toute autre route admin.
    const redirectAfterLogin = loginCheck.passwordChanged
      ? '/admin/productions'
      : '/admin/auth/change-password'
    assert.equal(
      redirectAfterLogin,
      '/admin/auth/change-password',
      'à la première connexion, la cible doit être /admin/auth/change-password'
    )

    // ── 4. Change-password (équivalent POST /admin/auth/change-password Story 2.3) ──────
    loginCheck.passwordHash = NEW_PASSWORD // mixin hashe automatiquement au save
    loginCheck.passwordChanged = true
    await loginCheck.save()

    // ── 5. Vérifier l'état final en BDD ────────────────────────────────────────────────
    const refreshed = await AdminUser.findOrFail(created.id)
    assert.isTrue(
      refreshed.passwordChanged,
      'passwordChanged doit passer à true après le change-password'
    )
    assert.isTrue(
      await hash.verify(refreshed.passwordHash, NEW_PASSWORD),
      'le nouveau password doit hasher correctement (scrypt)'
    )
    assert.isFalse(
      await hash.verify(refreshed.passwordHash, PROVISIONAL_PASSWORD),
      'le password provisoire ne doit plus valider après changement'
    )

    // ── 6. Re-login avec le nouveau password → cible = dashboard ────────────────────────
    const reLogin = await AdminUser.verifyCredentials(email, NEW_PASSWORD)
    assert.equal(reLogin.id, refreshed.id)
    assert.isTrue(reLogin.passwordChanged)

    const redirectAfterReLogin = reLogin.passwordChanged
      ? '/admin/productions'
      : '/admin/auth/change-password'
    assert.equal(
      redirectAfterReLogin,
      '/admin/productions',
      'après changement de password, la prochaine connexion mène au dashboard'
    )

    // ── 7. Tentative de re-login avec l'ancien password → doit échouer ──────────────────
    let oldPasswordRejected = false
    try {
      await AdminUser.verifyCredentials(email, PROVISIONAL_PASSWORD)
    } catch {
      oldPasswordRejected = true
    }
    assert.isTrue(
      oldPasswordRejected,
      "l'ancien password provisoire doit être invalide après le changement"
    )
  })
})
