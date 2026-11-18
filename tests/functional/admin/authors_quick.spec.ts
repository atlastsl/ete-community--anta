import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import encryption from '@adonisjs/core/services/encryption'
import sharp from 'sharp'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AdminActivityLog from '#models/admin_activity_log'
import AuthorService from '#services/author_service'

// Story 9.8 : fenêtre « Créer un auteur » du formulaire de production (POST /admin/authors/quick,
// JSON). Noms fictifs uniquement (dépôt public) ; images générées par sharp.

const URL = '/admin/authors/quick'
const TMP = join(tmpdir(), 'anta-test-author-quick')
mkdirSync(TMP, { recursive: true })

async function createAdminUser(): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

async function makePng(name: string): Promise<string> {
  const path = join(TMP, name)
  const buffer = await sharp({
    create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 120, b: 60, alpha: 1 } },
  })
    .png()
    .toBuffer()
  writeFileSync(path, buffer)
  return path
}

function makeTextAsJpg(name: string): string {
  const path = join(TMP, name)
  writeFileSync(path, 'pas une image', 'utf-8')
  return path
}

function fieldsOf(body: { errors?: { field: string; message: string }[] }): Record<string, string> {
  return Object.fromEntries((body.errors ?? []).map((error) => [error.field, error.message]))
}

test.group('Admin authors | création rapide (9.8)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('201 JSON { author } (forme du sélecteur), affiliations ordonnées, journal create', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Moïse Exemple')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('affiliations[0][department]', 'Chimie')
      .field('affiliations[1][institution]', 'Institut Modèle')
      .field('googleScholarUrl', 'https://scholar.google.com/citations?user=abc')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(201)
    assert.include(response.header('content-type') ?? '', 'application/json')
    const author = await Author.query()
      .where('lastNames', 'Fictivo')
      .preload('affiliations')
      .firstOrFail()
    assert.deepEqual(response.body(), {
      author: {
        id: author.id,
        name: 'Moïse Exemple Fictivo',
        firstNames: 'Moïse Exemple',
        lastNames: 'Fictivo',
        primaryInstitution: 'Université Exemple',
        primaryDepartment: 'Chimie',
        isIncomplete: false,
        isPublic: false,
        photoUrl: null,
      },
    })
    assert.deepEqual(
      author.affiliations.map((a) => [a.position, a.institution]),
      [
        [1, 'Université Exemple'],
        [2, 'Institut Modèle'],
      ]
    )
    assert.equal(author.createdById, admin.id)
    assert.isNull(author.consentConfirmedAt)

    const logs = await AdminActivityLog.query().where('resourceId', author.id)
    assert.deepEqual(
      logs.map((log) => [log.actionType, log.resourceType]),
      [['create', 'author']]
    )
    assert.equal(logs[0].metadata?.name, 'Moïse Exemple Fictivo')
  })

  test('consentement coché → profil public, journal create + consent_confirm', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('consent', '1')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(201)
    assert.isTrue(response.body().author.isPublic)
    const author = await Author.findOrFail(response.body().author.id)
    assert.isNotNull(author.consentConfirmedAt)
    assert.equal(author.consentConfirmedById, admin.id)
    const logs = await AdminActivityLog.query().where('resourceId', author.id)
    const actions = logs.map((log) => log.actionType)
    assert.sameMembers(actions, ['create', 'consent_confirm'])
  })

  test('422 JSON : erreurs VineJS (clés i18n), rien créé, aucune redirection', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', '')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('googleScholarUrl', 'pas-une-url')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(422)
    assert.include(response.header('content-type') ?? '', 'application/json')
    const errors = fieldsOf(response.body())
    assert.equal(errors.lastNames, 'authors.form.errors.last_names_required')
    assert.equal(errors.googleScholarUrl, 'authors.form.errors.scholar_url_invalid')
    assert.isNull(await Author.findBy('firstNames', 'Ada'))
  })

  test('422 sans affiliation (FR52) ; consentement sans affiliation (D27)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('consent', '1')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(422)
    const errors = fieldsOf(response.body())
    assert.equal(errors.affiliations, 'authors.form.errors.affiliation_required')
    assert.equal(errors.consent, 'authors.form.errors.consent_requires_affiliation')
    assert.isNull(await Author.findBy('lastNames', 'Fictivo'))
  })

  test('422 même sans en-tête Accept (endpoint JSON)', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .field('firstNames', 'Ada')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(422)
    assert.equal(fieldsOf(response.body()).lastNames, 'authors.form.errors.last_names_required')
  })

  test('parcours navigateur : en-tête X-XSRF-TOKEN = cookie XSRF-TOKEN de la page → 201', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    // Même secret CSRF de session pour la page et l'envoi (le client de test ne garde pas la
    // session entre deux requêtes).
    const session = { 'csrf-secret': 'secret-csrf-fictif-de-test' }
    const page = await client.get('/admin/productions/create').loginAs(admin).withSession(session)
    page.assertStatus(200)
    const token = page.cookies()['XSRF-TOKEN']?.value
    assert.isString(token)
    // Valeur brute du cookie telle que le navigateur la lit (chiffrée, encodée URI).
    const header = encodeURIComponent(`e:${encryption.encrypt(token, undefined, 'XSRF-TOKEN')}`)

    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .header('X-XSRF-TOKEN', header)
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .loginAs(admin)
      .withSession(session)
      .redirects(0)

    response.assertStatus(201)
    assert.equal(response.body().author.lastNames, 'Fictivo')
  })

  test('sans jeton CSRF → refusé par Shield, rien créé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .loginAs(admin)
      .redirects(0)

    assert.notEqual(response.status(), 201)
    assert.isAtLeast(response.status(), 300)
    assert.isNull(await Author.findBy('lastNames', 'Fictivo'))
  })

  test('jeton XSRF invalide → refusé, rien créé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .header('X-XSRF-TOKEN', 'jeton-invalide')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .loginAs(admin)
      .redirects(0)

    assert.notEqual(response.status(), 201)
    assert.isNull(await Author.findBy('lastNames', 'Fictivo'))
  })

  test('non authentifié → /admin/login, rien créé', async ({ client, assert }) => {
    const response = await client
      .post(URL)
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
    assert.isNull(await Author.findBy('lastNames', 'Fictivo'))
  })

  test('photo → variantes stockées, photoUrl signée dans la réponse', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', await makePng('quick.png'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(201)
    const author = await Author.findOrFail(response.body().author.id)
    assert.isNotNull(author.photoKey)
    fakeDisk.assertExists(AuthorService.photoKeys(author.photoKey!))
    assert.isString(response.body().author.photoUrl)
  })

  test('photo refusée → 422 photo, rien créé', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const response = await client
      .post(URL)
      .header('Accept', 'application/json')
      .field('lastNames', 'Fictivo')
      .field('firstNames', 'Ada')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', makeTextAsJpg('texte.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(422)
    assert.match(fieldsOf(response.body()).photo, /^authors\.form\.errors\.photo_/)
    assert.isNull(await Author.findBy('lastNames', 'Fictivo'))
  })
})
