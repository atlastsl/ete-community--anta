import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import AdminActivityLog from '#models/admin_activity_log'

// Noms fictifs uniquement (dépôt public).

/**
 * Story 9.4 — confirmation et retrait du consentement d'un auteur (FR53, D16, D17, D27) :
 * case du formulaire, actions de la liste, idempotence, journal.
 */

async function createAdminUser(role: 'admin' | 'super_admin' = 'admin'): Promise<AdminUser> {
  return AdminUser.create({
    email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role,
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

async function createAuthor(
  institutions: string[] = ['Université Exemple'],
  extra: Partial<Author> = {}
): Promise<Author> {
  const author = await Author.create({ firstNames: 'Jean', lastNames: 'Fictif', ...extra })
  for (const [index, institution] of institutions.entries()) {
    await AuthorAffiliation.create({
      authorId: author.id,
      position: index + 1,
      institution,
      department: null,
    })
  }
  return author
}

async function propsAt(client: ApiClient, url: string, admin: AdminUser) {
  const response = await client.get(url).loginAs(admin)
  return extractProps(response.text())
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

/** Erreurs de validation flashées (`errors` : { champ: clé i18n }). */
function flashedErrors(flash: Record<string, any>): Record<string, string> {
  const raw = (flash.errors ?? flash.inputErrorsBag ?? {}) as Record<string, string | string[]>
  return Object.fromEntries(
    Object.entries(raw).map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
  )
}

/**
 * Types d'action journalisés pour une fiche, triés (deux entrées d'une même requête peuvent
 * partager leur horodatage : l'ordre d'écriture n'est pas observable de façon fiable).
 */
async function actionsFor(authorId: string): Promise<string[]> {
  const logs = await AdminActivityLog.query()
    .where('resourceType', 'author')
    .where('resourceId', authorId)
  return logs.map((log) => log.actionType).sort()
}

/** Colonnes de consentement relues en base. */
async function consentOf(id: string) {
  const author = await Author.findOrFail(id)
  return { at: author.consentConfirmedAt, by: author.consentConfirmedById }
}

const PAYLOAD = {
  lastNames: 'Fictif',
  firstNames: 'Jean',
  affiliations: [{ institution: 'Université Exemple' }],
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

test.group('Admin authors consent | case du formulaire', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('création avec consent → confirmé par l’admin, journal create puis consent_confirm', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post('/admin/authors')
      .json({ ...PAYLOAD, consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    const author = await Author.findByOrFail('lastNames', 'Fictif')
    assert.isNotNull(author.consentConfirmedAt)
    assert.equal(author.consentConfirmedById, admin.id)
    assert.deepEqual(await actionsFor(author.id), ['consent_confirm', 'create'])
    const log = await AdminActivityLog.query()
      .where('resourceId', author.id)
      .where('actionType', 'consent_confirm')
      .firstOrFail()
    assert.deepEqual(log.metadata, { name: 'Jean Fictif' })
    assert.equal(log.adminUserId, admin.id)
  })

  test('création sans consent → fiche non publique, seul create journalisé (D16)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    await client
      .post('/admin/authors')
      .json({ ...PAYLOAD, consent: false })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    const author = await Author.findByOrFail('lastNames', 'Fictif')
    assert.isNull(author.consentConfirmedAt)
    assert.isNull(author.consentConfirmedById)
    assert.deepEqual(await actionsFor(author.id), ['create'])
  })

  test('création multipart avec consent=1 → confirmée', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post('/admin/authors')
      .field('lastNames', 'Fictif')
      .field('firstNames', 'Jean')
      .field('affiliations[0][institution]', 'Université Exemple')
      .field('consent', '1')
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    const author = await Author.findByOrFail('lastNames', 'Fictif')
    assert.isNotNull(author.consentConfirmedAt)
  })

  test('création consent sans affiliation → erreurs affiliations et consent, rien créé', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const response = await client
      .post('/admin/authors')
      .json({ ...PAYLOAD, affiliations: [], consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    const errors = flashedErrors(response.flashMessages())
    assert.equal(errors.affiliations, 'authors.form.errors.affiliation_required')
    assert.equal(errors.consent, 'authors.form.errors.consent_requires_affiliation')
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
  })

  test('modification + consent → update puis consent_confirm ; consentement seul → consent_confirm seul', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const changed = await createAuthor()
    await client
      .put(`/admin/authors/${changed.id}`)
      .json({ ...PAYLOAD, firstNames: 'Jean Marc', consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    assert.deepEqual(await actionsFor(changed.id), ['consent_confirm', 'update'])
    assert.equal(await consentOf(changed.id).then((c) => c.by), admin.id)

    const consentOnly = await createAuthor(['Université Exemple'], { lastNames: 'Exemple' })
    const response = await client
      .put(`/admin/authors/${consentOnly.id}`)
      .json({ ...PAYLOAD, lastNames: 'Exemple', consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    response.assertHeader('location', `/admin/authors/${consentOnly.id}/edit`)
    assert.deepEqual(await actionsFor(consentOnly.id), ['consent_confirm'])
    assert.isNotNull(await consentOf(consentOnly.id).then((c) => c.at))
  })

  test('fiche migrée sans affiliation : consent refusé (D27), accepté avec une affiliation', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor([], { migrationKey: 'jean-fictif' })

    const refused = await client
      .put(`/admin/authors/${author.id}`)
      .json({ ...PAYLOAD, affiliations: [], consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    assert.deepEqual(flashedErrors(refused.flashMessages()), {
      consent: 'authors.form.errors.consent_requires_affiliation',
    })
    assert.isNull(await consentOf(author.id).then((c) => c.at))
    assert.deepEqual(await actionsFor(author.id), [])

    await client
      .put(`/admin/authors/${author.id}`)
      .json({ ...PAYLOAD, consent: true })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)
    const saved = await Author.findOrFail(author.id)
    assert.isNotNull(saved.consentConfirmedAt)
    assert.deepEqual(await actionsFor(author.id), ['consent_confirm', 'update'])
  })

  test('fiche déjà publique + consent → rien ne change, aucun consent_confirm', async ({
    client,
    assert,
  }) => {
    const first = await createAdminUser()
    const second = await createAdminUser()
    const confirmedAt = DateTime.now().minus({ days: 3 })
    const author = await createAuthor(['Université Exemple'], {
      consentConfirmedAt: confirmedAt,
      consentConfirmedById: first.id,
    })

    await client
      .put(`/admin/authors/${author.id}`)
      .json({ ...PAYLOAD, consent: true })
      .withCsrfToken()
      .loginAs(second)
      .redirects(0)

    const saved = await Author.findOrFail(author.id)
    assert.equal(saved.consentConfirmedById, first.id)
    assert.equal(saved.consentConfirmedAt?.toMillis(), confirmedAt.toMillis())
    assert.deepEqual(await actionsFor(author.id), [])
  })

  test('fiche publique migrée : 0 affiliation refusée (P2.1)', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor(['Université Exemple'], {
      migrationKey: 'jean-fictif',
      consentConfirmedAt: DateTime.now(),
    })

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .json({ ...PAYLOAD, affiliations: [] })
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    assert.deepEqual(flashedErrors(response.flashMessages()), {
      affiliations: 'authors.form.errors.affiliation_required',
    })
    const saved = await Author.findOrFail(author.id)
    await saved.load('affiliations')
    assert.lengthOf(saved.affiliations, 1)
  })

  test('GET edit → isPublic et isIncomplete', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const publicCard = await createAuthor(['Université Exemple'], {
      consentConfirmedAt: DateTime.now(),
    })
    const incomplete = await createAuthor([], { lastNames: 'Exemple', migrationKey: 'x' })

    const one = await propsAt(client, `/admin/authors/${publicCard.id}/edit`, admin)
    assert.isTrue(one.author.isPublic)
    assert.isFalse(one.author.isIncomplete)
    const two = await propsAt(client, `/admin/authors/${incomplete.id}/edit`, admin)
    assert.isFalse(two.author.isPublic)
    assert.isTrue(two.author.isIncomplete)
  })
})

test.group('Admin authors consent | actions confirmer / retirer', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('confirm-consent → public, flash, journal, retour à la liste filtrée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor()
    const listUrl = '/admin/authors?consent=pending&page=2'

    const response = await client
      .post(`/admin/authors/${author.id}/confirm-consent`)
      .header('referer', `http://localhost:3333${listUrl}`)
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', listUrl)
    assert.equal(response.flashMessages().success, 'authors.consent.flash.confirmed')
    const saved = await Author.findOrFail(author.id)
    assert.isNotNull(saved.consentConfirmedAt)
    assert.equal(saved.consentConfirmedById, admin.id)
    assert.deepEqual(await actionsFor(author.id), ['consent_confirm'])
    const log = await AdminActivityLog.query().where('resourceId', author.id).firstOrFail()
    assert.deepEqual(log.metadata, { name: 'Jean Fictif' })
  })

  test('confirm-consent sur un profil déjà public → aucun changement ni journal', async ({
    client,
    assert,
  }) => {
    const first = await createAdminUser()
    const second = await createAdminUser()
    const author = await createAuthor(['Université Exemple'], {
      consentConfirmedAt: DateTime.now().minus({ days: 1 }),
      consentConfirmedById: first.id,
    })
    const before = await Author.findOrFail(author.id)

    const response = await client
      .post(`/admin/authors/${author.id}/confirm-consent`)
      .header('referer', 'https://autre-site.example/ailleurs')
      .withCsrfToken()
      .loginAs(second)
      .redirects(0)

    response.assertStatus(302)
    // Référent ni la liste ni la fiche : retour à la liste nue (chemin relatif, jamais un hôte).
    response.assertHeader('location', '/admin/authors')
    assert.isUndefined(response.flashMessages().error)
    const saved = await Author.findOrFail(author.id)
    assert.equal(saved.consentConfirmedById, first.id)
    assert.equal(saved.consentConfirmedAt?.toMillis(), before.consentConfirmedAt?.toMillis())
    assert.equal(saved.updatedAt?.toMillis(), before.updatedAt?.toMillis())
    assert.deepEqual(await actionsFor(author.id), [])
  })

  test('confirm-consent sans affiliation → refus (flash d’erreur), inchangé (D27)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor([], { migrationKey: 'jean-fictif' })

    const response = await client
      .post(`/admin/authors/${author.id}/confirm-consent`)
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.flashMessages().error, 'authors.consent.flash.refused')
    assert.isNull(await consentOf(author.id).then((c) => c.at))
    assert.deepEqual(await actionsFor(author.id), [])
  })

  test('withdraw-consent → non public (NULL / NULL), flash, journal consent_withdraw', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor(['Université Exemple'], {
      consentConfirmedAt: DateTime.now(),
      consentConfirmedById: admin.id,
    })

    const response = await client
      .post(`/admin/authors/${author.id}/withdraw-consent`)
      .header('referer', `http://localhost:3333/admin/authors/${author.id}/edit`)
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.equal(response.flashMessages().success, 'authors.consent.flash.withdrawn')
    const saved = await Author.findOrFail(author.id)
    assert.isNull(saved.consentConfirmedAt)
    assert.isNull(saved.consentConfirmedById)
    assert.deepEqual(await actionsFor(author.id), ['consent_withdraw'])
    const log = await AdminActivityLog.query().where('resourceId', author.id).firstOrFail()
    assert.deepEqual(log.metadata, { name: 'Jean Fictif' })
  })

  test('withdraw-consent sur un profil non public → aucun changement ni journal', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor()
    const before = await Author.findOrFail(author.id)

    const response = await client
      .post(`/admin/authors/${author.id}/withdraw-consent`)
      .withCsrfToken()
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assert.isUndefined(response.flashMessages().success)
    const saved = await Author.findOrFail(author.id)
    assert.equal(saved.updatedAt?.toMillis(), before.updatedAt?.toMillis())
    assert.deepEqual(await actionsFor(author.id), [])
  })

  test('super_admin peut aussi confirmer ; badges de la liste à jour', async ({
    client,
    assert,
  }) => {
    const su = await createAdminUser('super_admin')
    const author = await createAuthor()
    await client
      .post(`/admin/authors/${author.id}/confirm-consent`)
      .withCsrfToken()
      .loginAs(su)
      .redirects(0)

    const props = await propsAt(client, '/admin/authors', su)
    const row = props.authors.find((a: { id: string }) => a.id === author.id)
    assert.isTrue(row.isPublic)
    assert.equal(props.counts.consentPending, 0)
  })

  test('accès : non authentifié → /admin/login ; id malformé ou inconnu → 404', async ({
    client,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor()
    for (const action of ['confirm-consent', 'withdraw-consent']) {
      const anonymous = await client
        .post(`/admin/authors/${author.id}/${action}`)
        .withCsrfToken()
        .redirects(0)
      anonymous.assertStatus(302)
      anonymous.assertHeader('location', '/admin/login')

      for (const id of ['pas-un-uuid', UNKNOWN_UUID]) {
        const missing = await client
          .post(`/admin/authors/${id}/${action}`)
          .withCsrfToken()
          .loginAs(admin)
          .redirects(0)
        missing.assertStatus(404)
      }
    }
  })
})
