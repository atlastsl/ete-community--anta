import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import AdminActivityLog from '#models/admin_activity_log'

// Noms fictifs uniquement (dépôt public).

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
  firstNames: string,
  lastNames: string,
  institutions: string[] = ['Université Exemple'],
  extra: Partial<Author> = {}
): Promise<Author> {
  const author = await Author.create({ firstNames, lastNames, ...extra })
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

const VALID_PAYLOAD = {
  lastNames: 'Fictif',
  firstNames: 'Jean Marc',
  affiliations: [
    { institution: 'Université de Yaoundé I', department: 'Mathématiques' },
    { institution: 'École Normale Supérieure', department: '' },
  ],
  googleScholarUrl: 'https://scholar.google.com/citations?user=fictif',
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

test.group('Admin authors | accès', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('non authentifié → redirection /admin/login sur chaque route', async ({ client }) => {
    const author = await createAuthor('Jean', 'Fictif')
    const calls = [
      client.get('/admin/authors'),
      client.get('/admin/authors/create'),
      client.get(`/admin/authors/${author.id}/edit`),
      client.post('/admin/authors').json(VALID_PAYLOAD).withCsrfToken(),
      client.put(`/admin/authors/${author.id}`).json(VALID_PAYLOAD).withCsrfToken(),
      client.delete(`/admin/authors/${author.id}`).withCsrfToken(),
    ]
    for (const call of calls) {
      const response = await call.redirects(0)
      response.assertStatus(302)
      response.assertHeader('location', '/admin/login')
    }
  })

  test('rôle admin (pas seulement super admin) : pages 200', async ({ client }) => {
    const admin = await createAdminUser('admin')
    const author = await createAuthor('Jean', 'Fictif')

    const list = await client.get('/admin/authors').loginAs(admin)
    list.assertStatus(200)
    list.assertTextIncludes('admin/Authors/Index')

    const create = await client.get('/admin/authors/create').loginAs(admin)
    create.assertStatus(200)
    create.assertTextIncludes('admin/Authors/Create')

    const edit = await client.get(`/admin/authors/${author.id}/edit`).loginAs(admin)
    edit.assertStatus(200)
    edit.assertTextIncludes('admin/Authors/Edit')
  })

  test(':id non UUID ou inconnu → 404', async ({ client }) => {
    const admin = await createAdminUser()
    for (const id of ['not-a-uuid', UNKNOWN_UUID]) {
      const edit = await client.get(`/admin/authors/${id}/edit`).loginAs(admin)
      edit.assertStatus(404)
      const update = await client
        .put(`/admin/authors/${id}`)
        .json(VALID_PAYLOAD)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      update.assertStatus(404)
    }
  })
})

test.group('Admin authors | création', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST valide → fiche, affiliations ordonnées, clés normalisées, journal, flash', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()

    const response = await client
      .post('/admin/authors')
      .json(VALID_PAYLOAD)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const author = await Author.query()
      .where('lastNames', 'Fictif')
      .preload('affiliations')
      .firstOrFail()
    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.include(JSON.stringify(response.flashMessages()), 'authors.flash.created')

    assert.equal(author.firstNames, 'Jean Marc')
    assert.equal(author.slug, 'jean-marc-fictif')
    assert.equal(author.searchName, 'jean marc fictif')
    assert.equal(author.createdById, admin.id)
    assert.equal(author.googleScholarUrl, VALID_PAYLOAD.googleScholarUrl)
    assert.isNull(author.migrationKey)
    assert.deepEqual(
      author.affiliations.map((a) => [a.position, a.institution, a.institutionKey, a.department]),
      [
        [1, 'Université de Yaoundé I', 'universite de yaounde i', 'Mathématiques'],
        [2, 'École Normale Supérieure', 'ecole normale superieure', null],
      ]
    )

    const log = await AdminActivityLog.query()
      .where('resourceType', 'author')
      .where('resourceId', author.id)
      .firstOrFail()
    assert.equal(log.actionType, 'create')
    assert.equal(log.adminUserId, admin.id)
    assert.deepEqual(log.metadata, { name: 'Jean Marc Fictif' })
  })

  test('URL Google Scholar vide → NULL', async ({ client, assert }) => {
    const admin = await createAdminUser()
    await client
      .post('/admin/authors')
      .json({ ...VALID_PAYLOAD, googleScholarUrl: '' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    const author = await Author.findByOrFail('lastNames', 'Fictif')
    assert.isNull(author.googleScholarUrl)
  })

  test('collision de slug → suffixe -2', async ({ client, assert }) => {
    const admin = await createAdminUser()
    await createAuthor('Jean Marc', 'Fictif')
    await client
      .post('/admin/authors')
      .json(VALID_PAYLOAD)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    const authors = await Author.query().where('lastNames', 'Fictif').orderBy('createdAt')
    const slugs = authors.map((a) => a.slug)
    assert.sameMembers(slugs, ['jean-marc-fictif', 'jean-marc-fictif-2'])
  })

  test('saisie invalide → erreurs par champ, rien créé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post('/admin/authors')
      .json({
        lastNames: '',
        firstNames: 'x'.repeat(121),
        affiliations: [{ institution: '' }],
        googleScholarUrl: 'ftp://scholar.test',
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const errors = flashedErrors(response.flashMessages())
    assert.equal(errors.lastNames, 'authors.form.errors.last_names_required')
    assert.equal(errors.firstNames, 'authors.form.errors.first_names_too_long')
    assert.equal(errors['affiliations.0.institution'], 'authors.form.errors.institution_required')
    assert.equal(errors.googleScholarUrl, 'authors.form.errors.scholar_url_invalid')
    assert.equal(
      await Author.query()
        .count('* as total')
        .then((r) => Number(r[0].$extras.total)),
      0
    )
  })

  test('aucune affiliation → refus (fiche du panel)', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client
      .post('/admin/authors')
      .json({ ...VALID_PAYLOAD, affiliations: [] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(
      flashedErrors(response.flashMessages()).affiliations,
      'authors.form.errors.affiliation_required'
    )
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
  })
})

test.group('Admin authors | modification', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET edit → props de la fiche (affiliations ordonnées, vides en chaîne)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Jean', 'Fictif', ['Université A', 'Université B'])

    const response = await client.get(`/admin/authors/${author.id}/edit`).loginAs(admin)
    const props = extractProps(response.text())
    assert.deepEqual(props.author, {
      id: author.id,
      firstNames: 'Jean',
      lastNames: 'Fictif',
      googleScholarUrl: '',
      affiliations: [
        { institution: 'Université A', department: '' },
        { institution: 'Université B', department: '' },
      ],
      isMigrated: false,
      productionsCount: 0,
      photoUrl: null,
      hasPhoto: false,
      isPublic: false,
      isIncomplete: false,
    })
  })

  test('PUT → modifications persistées, affiliations remplacées (ordre inversé), journal fields', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Jean', 'Fictif', ['Université A', 'Université B'])

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .json({
        lastNames: 'Fictive',
        firstNames: 'Jean',
        affiliations: [{ institution: 'Université B' }, { institution: 'Université A' }],
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', `/admin/authors/${author.id}/edit`)
    assert.include(JSON.stringify(response.flashMessages()), 'authors.flash.saved')

    await author.refresh()
    await author.load('affiliations')
    assert.equal(author.lastNames, 'Fictive')
    assert.equal(author.slug, 'jean-fictif', 'slug figé (D28)')
    assert.equal(author.searchName, 'jean fictive')
    assert.deepEqual(
      author.affiliations.map((a) => [a.position, a.institution]),
      [
        [1, 'Université B'],
        [2, 'Université A'],
      ]
    )

    const log = await AdminActivityLog.query()
      .where('resourceId', author.id)
      .where('actionType', 'update')
      .firstOrFail()
    assert.equal(log.resourceType, 'author')
    assert.deepEqual(log.metadata, { name: 'Jean Fictive', fields: ['lastNames', 'affiliations'] })
  })

  test('PUT sans changement → succès sans entrée de journal', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Jean', 'Fictif', ['Université A'])

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .json({
        lastNames: 'Fictif',
        firstNames: 'Jean',
        affiliations: [{ institution: 'Université A' }],
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.include(JSON.stringify(response.flashMessages()), 'authors.flash.saved')
    assert.isNull(await AdminActivityLog.query().where('resourceId', author.id).first())
  })

  test('PUT ne changeant que les affiliations → updated_at avancé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Jean', 'Fictif', ['Université A', 'Université B'])
    await db.from('authors').where('id', author.id).update({ updated_at: '2026-01-01T00:00:00Z' })

    const response = await client
      .put(`/admin/authors/${author.id}`)
      .json({
        lastNames: 'Fictif',
        firstNames: 'Jean',
        affiliations: [{ institution: 'Université B' }, { institution: 'Université A' }],
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await author.refresh()
    assert.isAbove(author.updatedAt!.toMillis(), Date.parse('2026-01-02T00:00:00Z'))
  })

  test('PUT sans affiliation : refusé pour une fiche du panel, accepté pour une fiche migrée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const panel = await createAuthor('Jean', 'Fictif', ['Université A'])
    const migrated = await createAuthor('Paul', 'Migré', [], { migrationKey: 'paul migre' })

    const refused = await client
      .put(`/admin/authors/${panel.id}`)
      .json({ lastNames: 'Fictif', firstNames: 'Jean', affiliations: [] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.equal(
      flashedErrors(refused.flashMessages()).affiliations,
      'authors.form.errors.affiliation_required'
    )
    await panel.load('affiliations')
    assert.lengthOf(panel.affiliations, 1)

    const accepted = await client
      .put(`/admin/authors/${migrated.id}`)
      .json({ lastNames: 'Migré', firstNames: 'Paul Henri', affiliations: [] })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    accepted.assertStatus(302)
    assert.include(JSON.stringify(accepted.flashMessages()), 'authors.flash.saved')
    await migrated.refresh()
    assert.equal(migrated.firstNames, 'Paul Henri')

    const edit = await client.get(`/admin/authors/${migrated.id}/edit`).loginAs(admin)
    assert.isTrue(extractProps(edit.text()).author.isMigrated)
  })
})

test.group('Admin authors | liste', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('triée par nom puis prénom, affiliation principale, sans affiliation → null', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    await createAuthor('Zoé', 'Bravo', ['Université Z', 'Université Y'])
    await createAuthor('Albert', 'Charlie', [])
    await createAuthor('Aline', 'Bravo', ['Université A'])

    const response = await client.get('/admin/authors').loginAs(admin)
    const props = extractProps(response.text())
    assert.deepEqual(
      props.authors.map((a: any) => [
        a.firstNames,
        a.lastNames,
        a.primaryAffiliation?.institution ?? null,
      ]),
      [
        ['Aline', 'Bravo', 'Université A'],
        ['Zoé', 'Bravo', 'Université Z'],
        ['Albert', 'Charlie', null],
      ]
    )
    assert.isString(props.authors[0].updatedAt)
  })

  test('20 par page, page 2', async ({ client, assert }) => {
    const admin = await createAdminUser()
    for (let i = 0; i < 21; i++) {
      await Author.create({ firstNames: 'Prénom', lastNames: `Nom${String(i).padStart(2, '0')}` })
    }

    const response1 = await client.get('/admin/authors').loginAs(admin)
    const page1 = extractProps(response1.text())
    assert.lengthOf(page1.authors, 20)
    assert.equal(page1.pagination.total, 21)
    assert.equal(page1.pagination.lastPage, 2)

    const response2 = await client.get('/admin/authors?page=2').loginAs(admin)
    const page2 = extractProps(response2.text())
    assert.lengthOf(page2.authors, 1)
    assert.equal(page2.authors[0].lastNames, 'Nom20')

    const bogus = await client.get('/admin/authors?page=-3').loginAs(admin)
    bogus.assertStatus(200)
  })
})
