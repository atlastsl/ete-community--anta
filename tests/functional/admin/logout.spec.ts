import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'

async function createAdminUser(): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'AnyPasswordPlain',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
  })
}

test.group('Admin logout', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST /admin/logout (auth + CSRF) → 302 vers /admin/login + flash success', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser()
    const response = await client.post('/admin/logout').loginAs(user).withCsrfToken().redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'auth.logout.success')
  })

  test('POST /admin/logout sans CSRF → rejet (flash E_BAD_CSRF_TOKEN)', async ({
    client,
    assert,
  }) => {
    const user = await createAdminUser()
    // PAS de .withCsrfToken()
    const response = await client.post('/admin/logout').loginAs(user).redirects(0)

    response.assertStatus(302)
    const flash = response.flashMessages()
    assert.include(JSON.stringify(flash), 'E_BAD_CSRF_TOKEN')
  })

  test('POST /admin/logout anonyme → 302 vers /admin/login (middleware admin)', async ({
    client,
  }) => {
    // Pas de loginAs — l'AdminMiddleware doit rejeter avant le contrôleur
    const response = await client.post('/admin/logout').withCsrfToken().redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin session | post-logout', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('un client sans cookie session ne peut pas accéder au dashboard (équivalent post-logout)', async ({
    client,
  }) => {
    // Note : sessionApiClient détruit la session entre chaque requête, donc on ne peut pas
    // chaîner POST logout → GET productions avec le même client. Ce test vérifie le
    // comportement équivalent : sans cookie session valide → redirect login.
    const response = await client.get('/admin/productions').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })
})

test.group('Admin session | fixation protection (AC6)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('le session id est régénéré après un login réussi (anti-fixation)', async ({
    client,
    assert,
  }) => {
    const password = 'CorrectPassword123!'
    const user = await AdminUser.create({
      email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
      passwordHash: password,
      role: 'admin',
      passwordChanged: true,
      isActive: true,
    })

    // 1. On FIXE un session id connu avant le login (scénario d'attaque par fixation) :
    //    `.withSession()` sème une session et envoie son id comme cookie `adonis-session`.
    const request = client
      .post('/admin/login')
      .form({ email: user.email, password })
      .withCsrfToken()
      .withSession({ fixation_marker: 'pre-login' })
      .redirects(0)

    // L'id de session envoyé par le client (le cookie "fixé") — exposé par le sessionApiClient.
    const fixedSessionId = (request as unknown as { sessionClient: { sessionId: string } })
      .sessionClient.sessionId

    // 2. Login réussi
    const response = await request
    response.assertStatus(302)

    // 3. Preuve : le cookie de session retourné DIFFÈRE de l'id fixé → AdonisJS a régénéré
    //    l'id dans `auth.use('web').login()`. L'ancien id (connu de l'attaquant) est inutilisable.
    const newSessionId = response.cookie('adonis-session')?.value
    assert.exists(newSessionId, 'Un cookie adonis-session doit être émis après login')
    assert.notEqual(
      newSessionId,
      fixedSessionId,
      'Le session id doit changer après login (protection anti-fixation)'
    )
  })
})
