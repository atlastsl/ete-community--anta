import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import AdminActivityLog from '#models/admin_activity_log'
import Production from '#models/production'

// Noms fictifs uniquement (dépôt public).

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

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

async function createProduction(status: 'draft' | 'published' = 'draft'): Promise<Production> {
  return Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status,
    authorNames: [],
    tags: [],
    licenseStatus: 'member',
  })
}

/** Lie l'auteur à la production dans le pivot (aucun code applicatif n'y écrit en 9.2). */
async function link(production: Production, author: Author, position = 1) {
  await db.table('production_authors').insert({
    production_id: production.id,
    author_id: author.id,
    position,
  })
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

/** Props Inertia d'un GET authentifié. */
async function propsOf(client: ApiClient, url: string, user: AdminUser) {
  const response = await client.get(url).loginAs(user)
  return extractProps(response.text())
}

const confirmed = { consentConfirmedAt: DateTime.now() }

test.group('Admin authors | liste : colonnes et filtres', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('colonnes : productionsCount (brouillons compris), isPublic, isIncomplete', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const linked = await createAuthor('Éloïse', 'Fictive', ['Université Exemple'], confirmed)
    await createAuthor('Jean Marc', 'Exemple', [])
    await link(await createProduction('draft'), linked)
    await link(await createProduction('published'), linked)

    const response = await client.get('/admin/authors').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    const rows = Object.fromEntries(props.authors.map((a: any) => [a.lastNames, a]))
    assert.equal(rows.Fictive.productionsCount, 2)
    assert.isTrue(rows.Fictive.isPublic)
    assert.isFalse(rows.Fictive.isIncomplete)
    assert.equal(rows.Exemple.productionsCount, 0)
    assert.isFalse(rows.Exemple.isPublic)
    assert.isTrue(rows.Exemple.isIncomplete)
    assert.deepEqual(props.filters, {
      q: null,
      institution: null,
      consent: null,
      incomplete: false,
    })
  })

  test('q : accents et casse ignorés, nom de famille, aucun résultat, jokers neutralisés', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    await createAuthor('Éloïse', 'Fictive')
    await createAuthor('Jean Marc', 'Exemple')
    await createAuthor('Paul', 'Test_Imaginaire')

    const byFirst = await propsOf(client, '/admin/authors?q=ELOISE', admin)
    assert.deepEqual(
      byFirst.authors.map((a: any) => a.firstNames),
      ['Éloïse']
    )
    assert.equal(byFirst.filters.q, 'ELOISE')

    const byLast = await propsOf(client, '/admin/authors?q=exemple', admin)
    assert.deepEqual(
      byLast.authors.map((a: any) => a.lastNames),
      ['Exemple']
    )

    const none = await propsOf(client, '/admin/authors?q=zzzzqqq', admin)
    assert.deepEqual(none.authors, [])
    assert.equal(none.pagination.total, 0)

    // `%` et `_` sont échappés : ils ne valent pas « n'importe quoi ».
    const percent = await propsOf(client, '/admin/authors?q=%25', admin)
    assert.deepEqual(percent.authors, [])
    const underscore = await propsOf(client, '/admin/authors?q=t_st', admin)
    assert.notInclude(
      underscore.authors.map((a: any) => a.lastNames),
      'Test_Imaginaire'
    )
    const literal = await propsOf(client, '/admin/authors?q=test_imag', admin)
    assert.deepEqual(
      literal.authors.map((a: any) => a.lastNames),
      ['Test_Imaginaire']
    )
  })

  test('q tronqué à 100 caractères', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await client.get(`/admin/authors?q=${'a'.repeat(150)}`).loginAs(admin)
    response.assertStatus(200)
    assert.lengthOf(extractProps(response.text()).filters.q, 100)
  })

  test('institution : clé sur n’importe quelle affiliation, options dédoublonnées', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    await createAuthor('Éloïse', 'Fictive', ['Université Exemple', 'École Imaginaire'])
    await createAuthor('Jean Marc', 'Exemple', ['ÉCOLE IMAGINAIRE'])
    await createAuthor('Paul', 'Inventé', ['École Imaginaire'])
    await createAuthor('Zoé', 'Autre', ['Institut Fictif'])

    const response = await client.get('/admin/authors?institution=ecole imaginaire').loginAs(admin)
    const props = extractProps(response.text())
    assert.sameMembers(
      props.authors.map((a: any) => a.lastNames),
      ['Fictive', 'Exemple', 'Inventé']
    )
    assert.equal(props.filters.institution, 'ecole imaginaire')

    // Un libellé accentué est accepté (normalizeKey idempotent).
    const byLabel = await propsOf(client, '/admin/authors?institution=École Imaginaire', admin)
    assert.lengthOf(byLabel.authors, 3)

    const options = props.institutionOptions
    assert.deepEqual(
      options.find((o: any) => o.value === 'ecole imaginaire'),
      { value: 'ecole imaginaire', label: 'École Imaginaire' }
    )
    assert.lengthOf(options, 3)
  })

  test('consent=pending, incomplete=1, cumul, valeurs invalides ignorées, compteurs', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    await createAuthor('Éloïse', 'Fictive', ['Université Exemple'], confirmed)
    await createAuthor('Jean Marc', 'Exemple', ['Université Exemple'])
    await createAuthor('Paul', 'Inventé', [])
    await createAuthor('Zoé', 'Autre', [], confirmed)

    const names = async (url: string) => {
      const props = await propsOf(client, url, admin)
      return { props, names: props.authors.map((a: any) => a.lastNames) }
    }

    const pending = await names('/admin/authors?consent=pending')
    assert.sameMembers(pending.names, ['Exemple', 'Inventé'])
    assert.equal(pending.props.filters.consent, 'pending')
    assert.deepEqual(pending.props.counts, { consentPending: 2, incomplete: 2 })

    const incomplete = await names('/admin/authors?incomplete=1')
    assert.sameMembers(incomplete.names, ['Inventé', 'Autre'])
    assert.isTrue(incomplete.props.filters.incomplete)

    const both = await names('/admin/authors?consent=pending&incomplete=1')
    assert.deepEqual(both.names, ['Inventé'])
    // Compteurs globaux : indépendants des filtres en cours.
    assert.deepEqual(both.props.counts, { consentPending: 2, incomplete: 2 })

    const invalid = await names('/admin/authors?consent=foo&incomplete=yes')
    assert.lengthOf(invalid.names, 4)
    assert.deepEqual(invalid.props.filters, {
      q: null,
      institution: null,
      consent: null,
      incomplete: false,
    })
  })

  test('pagination filtrée : ?consent=pending&page=2', async ({ client, assert }) => {
    const admin = await createAdminUser()
    for (let i = 0; i < 22; i++) {
      await Author.create({ firstNames: 'Prénom', lastNames: `Nom${String(i).padStart(2, '0')}` })
    }
    await createAuthor('Éloïse', 'Aaa', ['Université Exemple'], confirmed)

    const page2 = await propsOf(client, '/admin/authors?consent=pending&page=2', admin)
    assert.equal(page2.pagination.total, 22)
    assert.equal(page2.pagination.currentPage, 2)
    assert.deepEqual(
      page2.authors.map((a: any) => a.lastNames),
      ['Nom20', 'Nom21']
    )
  })
})

test.group('Admin authors | suppression', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('fiche sans production → supprimée avec ses affiliations, journal, flash', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Éloïse', 'Fictive', [
      'Université Exemple',
      'École Imaginaire',
    ])

    const response = await client
      .delete(`/admin/authors/${author.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/authors')
    assert.include(JSON.stringify(response.flashMessages()), 'authors.flash.deleted')
    assert.isNull(await Author.find(author.id))
    const affiliations = await AuthorAffiliation.query().where('authorId', author.id)
    assert.lengthOf(affiliations, 0)

    const log = await AdminActivityLog.query()
      .where('resourceType', 'author')
      .where('resourceId', author.id)
      .firstOrFail()
    assert.equal(log.actionType, 'delete')
    assert.equal(log.adminUserId, admin.id)
    assert.deepEqual(log.metadata, { name: 'Éloïse Fictive' })
  })

  test('suppression depuis une liste filtrée → retour à la même liste ; référent externe ignoré', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a1 = await createAuthor('Éloïse', 'Fictive')
    const a2 = await createAuthor('Jean Marc', 'Exemple')

    const fromList = await client
      .delete(`/admin/authors/${a1.id}`)
      .header('referer', 'http://localhost:3333/admin/authors?consent=pending&page=2')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    fromList.assertHeader('location', '/admin/authors?consent=pending&page=2')

    const external = await client
      .delete(`/admin/authors/${a2.id}`)
      .header('referer', 'https://example.org/admin/authors/x/edit')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    external.assertHeader('location', '/admin/authors')
    assert.isNull(await Author.find(a2.id))
  })

  test('fiche liée à un brouillon → refus, fiche intacte, aucun journal', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Jean Marc', 'Exemple')
    await link(await createProduction('draft'), author)

    const response = await client
      .delete(`/admin/authors/${author.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/admin/authors')
    assert.equal(response.flashMessages().error, 'authors.delete.refused')
    assert.isNotNull(await Author.find(author.id))
    assert.lengthOf(await AuthorAffiliation.query().where('authorId', author.id), 1)
    assert.isNull(await AdminActivityLog.query().where('resourceId', author.id).first())
  })

  test('non authentifié → /admin/login ; :id non UUID ou inconnu → 404', async ({ client }) => {
    const author = await createAuthor('Jean Marc', 'Exemple')
    const anonymous = await client
      .delete(`/admin/authors/${author.id}`)
      .withCsrfToken()
      .redirects(0)
    anonymous.assertStatus(302)
    anonymous.assertHeader('location', '/admin/login')

    const admin = await createAdminUser('admin')
    for (const id of ['not-a-uuid', UNKNOWN_UUID]) {
      const response = await client
        .delete(`/admin/authors/${id}`)
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(404)
    }
  })

  test('super admin autorisé aussi', async ({ client, assert }) => {
    const superAdmin = await createAdminUser('super_admin')
    const author = await createAuthor('Paul', 'Inventé')
    const response = await client
      .delete(`/admin/authors/${author.id}`)
      .loginAs(superAdmin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    assert.isNull(await Author.find(author.id))
  })

  test('GET edit → author.productionsCount', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Éloïse', 'Fictive')
    await link(await createProduction('draft'), author)
    const free = await createAuthor('Jean Marc', 'Exemple')

    const linked = await propsOf(client, `/admin/authors/${author.id}/edit`, admin)
    assert.equal(linked.author.productionsCount, 1)

    const unlinked = await propsOf(client, `/admin/authors/${free.id}/edit`, admin)
    assert.equal(unlinked.author.productionsCount, 0)
  })
})
