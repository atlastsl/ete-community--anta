import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import ProductionLink from '#models/production_link'

// Noms fictifs uniquement (dépôt public).

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000'

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

async function createAuthor(
  firstNames: string,
  lastNames: string,
  institutions: { institution: string; department?: string | null }[] = [
    { institution: 'Université Exemple' },
  ],
  extra: Partial<Author> = {}
): Promise<Author> {
  const author = await Author.create({ firstNames, lastNames, ...extra })
  for (const [index, affiliation] of institutions.entries()) {
    await AuthorAffiliation.create({
      authorId: author.id,
      position: index + 1,
      institution: affiliation.institution,
      department: affiliation.department ?? null,
    })
  }
  return author
}

/** Production complète hors auteurs (FR21), avec un lien. */
async function createProduction(overrides: Partial<Production> = {}): Promise<Production> {
  const production = await Production.create({
    title: `Prod ${Math.floor(Math.random() * 1_000_000)}`,
    summary: 'Résumé',
    authorNames: [],
    tags: ['t'],
    category: 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: 'fr',
    publicationCountry: 'SN',
    licenseStatus: 'member',
    status: 'draft',
    workPublishedAt: DateTime.fromISO('2024-01-01'),
    createdById: null,
    ...overrides,
  })
  await ProductionLink.create({
    productionId: production.id,
    url: 'https://example.com',
    linkType: 'simple',
    label: null,
  })
  return production
}

async function link(production: Production, authors: Author[]) {
  await db.table('production_authors').multiInsert(
    authors.map((author, index) => ({
      production_id: production.id,
      author_id: author.id,
      position: index + 1,
    }))
  )
}

async function pivotOf(productionId: string): Promise<[string, number][]> {
  const rows = await db
    .from('production_authors')
    .where('production_id', productionId)
    .orderBy('position', 'asc')
    .select('author_id', 'position')
  return rows.map((row: { author_id: string; position: number }) => [row.author_id, row.position])
}

async function namesOf(productionId: string): Promise<string[]> {
  const row = await db.from('productions').where('id', productionId).select('authors').first()
  return row.authors
}

/** Corps complet du formulaire (PUT remplace toutes les métadonnées). */
function formBody(extra: Record<string, unknown> = {}) {
  return {
    title: 'Titre',
    summary: 'Résumé',
    tags: ['t'],
    category: 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: 'fr',
    publicationCountry: 'SN',
    licenseStatus: 'member',
    workPublishedAt: '2024-01-01',
    ...extra,
  }
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).props
}

test.group('Admin productions | auteurs du référentiel (Story 9.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('POST avec authorIds ordonnés → pivot 1..n et colonne dénormalisée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const first = await createAuthor('Aminata', 'Fictiva')
    const second = await createAuthor('Jean-Paul', 'Exemplaire')

    const response = await client
      .post('/admin/productions')
      .json(formBody({ title: 'Création ordonnée', authorIds: [second.id, first.id] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    const created = await Production.findByOrFail('title', 'Création ordonnée')
    assert.deepEqual(await pivotOf(created.id), [
      [second.id, 1],
      [first.id, 2],
    ])
    assert.deepEqual(created.authorNames, ['Jean-Paul Exemplaire', 'Aminata Fictiva'])
  })

  test('PUT réordonne → pivot réécrit, colonne rafraîchie ; `authors` reçu ignoré', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const b = await createAuthor('Jean-Paul', 'Exemplaire')
    const c = await createAuthor('Zoé', 'Imaginaire')
    const production = await createProduction({
      authorNames: ['Aminata Fictiva', 'Jean-Paul Exemplaire'],
    })
    await link(production, [a, b])

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [c.id, b.id, a.id], authors: ['Nom Libre Injecté'] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    assert.deepEqual(await pivotOf(production.id), [
      [c.id, 1],
      [b.id, 2],
      [a.id, 3],
    ])
    assert.deepEqual(await namesOf(production.id), [
      'Zoé Imaginaire',
      'Jean-Paul Exemplaire',
      'Aminata Fictiva',
    ])
  })

  test('identifiant inconnu → erreur de validation, rien n’est écrit', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction({ title: 'Avant', authorNames: ['Aminata Fictiva'] })
    await link(production, [a])

    const response = await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ title: 'Après', authorIds: [UNKNOWN_UUID] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.include(
      JSON.stringify(response.flashMessages()),
      'productions.form.errors.author_unknown'
    )
    await production.refresh()
    assert.equal(production.title, 'Avant')
    assert.deepEqual(await pivotOf(production.id), [[a.id, 1]])

    // À la création : aucune production créée.
    await client
      .post('/admin/productions')
      .json(formBody({ title: 'Jamais créée', authorIds: [a.id, UNKNOWN_UUID] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.isNull(await Production.findBy('title', 'Jamais créée'))
  })

  test('doublon ou identifiant non uuid → erreur de validation', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction({ title: 'Inchangée' })

    for (const authorIds of [[a.id, a.id], ['pas-un-uuid']]) {
      const response = await client
        .put(`/admin/productions/${production.id}`)
        .json(formBody({ title: 'Modifiée', authorIds }))
        .loginAs(admin)
        .withCsrfToken()
        .redirects(0)
      response.assertStatus(302)
      await production.refresh()
      assert.equal(production.title, 'Inchangée')
    }
    assert.deepEqual(await pivotOf(production.id), [])
  })

  test('authorIds absent → auteurs inchangés', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction({ authorNames: ['Aminata Fictiva'] })
    await link(production, [a])

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authors: ['Autre'] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    assert.deepEqual(await pivotOf(production.id), [[a.id, 1]])
    assert.deepEqual(await namesOf(production.id), ['Aminata Fictiva'])
  })

  test('brouillon sans auteur accepté ; publication refusée puis acceptée avec un auteur', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')

    const created = await client
      .post('/admin/productions')
      .json(formBody({ title: 'Sans auteur', authorIds: [] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    created.assertStatus(302)
    const production = await Production.findByOrFail('title', 'Sans auteur')
    await ProductionLink.create({
      productionId: production.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: null,
    })

    await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await production.refresh()
    assert.equal(production.status, 'draft')

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ title: 'Sans auteur', authorIds: [a.id] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await production.refresh()
    assert.equal(production.status, 'published')
  })

  test('production non convertie enregistrée sans auteur → noms conservés, pas de dépublication', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      authorNames: ['Nom Libre', 'Autre Nom'],
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.deepEqual(production.authorNames, ['Nom Libre', 'Autre Nom'])
    assert.equal(production.status, 'published')
    assert.deepEqual(await pivotOf(production.id), [])
  })

  test('production convertie vidée de ses auteurs → colonne [] et dépublication automatique', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction({
      authorNames: ['Aminata Fictiva'],
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })
    await link(production, [a])

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.deepEqual(production.authorNames, [])
    assert.equal(production.status, 'draft')
  })

  test('GET edit → auteurs du pivot ordonnés ; noms à rattacher si non convertie', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva', [
      { institution: 'Université Exemple', department: 'Département Test' },
    ])
    const b = await createAuthor('Jean-Paul', 'Exemplaire', [], {
      consentConfirmedAt: DateTime.now(),
    })
    const converted = await createProduction({
      authorNames: ['Jean-Paul Exemplaire', 'Aminata Fictiva'],
    })
    await link(converted, [b, a])

    const response = await client.get(`/admin/productions/${converted.id}/edit`).loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.deepEqual(props.legacyAuthorNames, [])
    assert.deepEqual(props.production.authors, [
      {
        id: b.id,
        name: 'Jean-Paul Exemplaire',
        firstNames: 'Jean-Paul',
        lastNames: 'Exemplaire',
        primaryInstitution: null,
        primaryDepartment: null,
        isIncomplete: true,
        isPublic: true,
        photoUrl: null,
      },
      {
        id: a.id,
        name: 'Aminata Fictiva',
        firstNames: 'Aminata',
        lastNames: 'Fictiva',
        primaryInstitution: 'Université Exemple',
        primaryDepartment: 'Département Test',
        isIncomplete: false,
        isPublic: false,
        photoUrl: null,
      },
    ])

    const legacy = await createProduction({ authorNames: ['Nom Libre', ' '] })
    const legacyResponse = await client.get(`/admin/productions/${legacy.id}/edit`).loginAs(admin)
    const legacyProps = extractProps(legacyResponse.text())
    assert.deepEqual(legacyProps.production.authors, [])
    assert.deepEqual(legacyProps.legacyAuthorNames, ['Nom Libre'])
  })

  test('recherche full-text publique : l’auteur sélectionné est trouvé', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Zébulon', 'Imaginarius')
    const production = await createProduction()

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [a.id] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    const found = await db
      .from('productions')
      .whereRaw("search_vector @@ websearch_to_tsquery('simple', ?)", ['imaginarius'])
      .select('id')
    assert.deepEqual(
      found.map((row: { id: string }) => row.id),
      [production.id]
    )
  })
})

test.group('Admin authors | search (Story 9.7)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('insensible aux accents et à la casse ; forme des résultats', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor('Éloïse', 'Fictivé', [
      { institution: 'Université Exemple', department: 'Lettres' },
      { institution: 'Autre Institut' },
    ])

    const response = await client
      .get('/admin/authors/search')
      .qs({ q: 'ELOISE fict' })
      .loginAs(admin)

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      authors: [
        {
          id: author.id,
          name: 'Éloïse Fictivé',
          firstNames: 'Éloïse',
          lastNames: 'Fictivé',
          primaryInstitution: 'Université Exemple',
          primaryDepartment: 'Lettres',
          isIncomplete: false,
          isPublic: false,
          photoUrl: null,
        },
      ],
    })
  })

  test('exclude[] écarte les auteurs déjà sélectionnés (forme simple ou répétée)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const b = await createAuthor('Awa', 'Fictiva')
    const c = await createAuthor('Adja', 'Fictiva')

    const one = await client
      .get(`/admin/authors/search?q=fictiva&exclude[]=${a.id}&exclude[]=not-a-uuid`)
      .loginAs(admin)
    assert.sameMembers(
      one.body().authors.map((x: { id: string }) => x.id),
      [b.id, c.id]
    )

    const repeated = await client
      .get(`/admin/authors/search?q=fictiva&exclude=${a.id}&exclude=${b.id}`)
      .loginAs(admin)
    assert.deepEqual(
      repeated.body().authors.map((x: { id: string }) => x.id),
      [c.id]
    )
  })

  test('au plus 10 résultats ; préfixe d’abord, puis nom', async ({ client, assert }) => {
    const admin = await createAdminUser()
    for (let i = 0; i < 12; i++) {
      await createAuthor(
        `Prénom${String.fromCharCode(97 + i)}`,
        `Martinez${String.fromCharCode(97 + i)}`
      )
    }
    const prefix = await createAuthor('Zoé', 'Tinez')

    const response = await client.get('/admin/authors/search').qs({ q: 'tinez' }).loginAs(admin)
    const authors = response.body().authors
    assert.lengthOf(authors, 10)
    // « Tinez » commence par le terme : en tête, devant les « Martinez… » (sous-chaîne).
    assert.equal(authors[0].id, prefix.id)
  })

  test('q de moins de 2 caractères → liste vide', async ({ client, assert }) => {
    const admin = await createAdminUser()
    await createAuthor('Aminata', 'Fictiva')
    for (const q of ['', 'f', ' f ']) {
      const response = await client.get('/admin/authors/search').qs({ q }).loginAs(admin)
      response.assertStatus(200)
      assert.deepEqual(response.body(), { authors: [] })
    }
  })

  test('photoUrl : URL signée de la variante w128, sinon null', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const withPhoto = await createAuthor('Aminata', 'Fictiva', undefined, {
      photoKey: 'authors/fictif/token',
    })
    const without = await createAuthor('Awa', 'Fictiva')

    const response = await client.get('/admin/authors/search').qs({ q: 'fictiva' }).loginAs(admin)
    const urls = Object.fromEntries(
      response
        .body()
        .authors.map((x: { id: string; photoUrl: string | null }) => [x.id, x.photoUrl])
    )
    assert.include(urls[withPhoto.id], 'authors/fictif/token/w128.webp')
    assert.isNull(urls[without.id])
    drive.restore('r2')
  })

  test('non authentifié → redirection vers la connexion', async ({ client, assert }) => {
    const response = await client.get('/admin/authors/search').qs({ q: 'fictiva' }).redirects(0)
    response.assertStatus(302)
    assert.match(response.header('location') ?? '', /^\/admin\/login(\?|$)/)
  })
})

test.group('Admin productions | revue de code 9.7', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('rattachement partiel : un enregistrement sans changer les auteurs garde le nom libre', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction({ authorNames: ['Aminata Fictiva', 'Nom Libre'] })
    await link(production, [a])

    const editResponse = await client.get(`/admin/productions/${production.id}/edit`).loginAs(admin)
    const edit = extractProps(editResponse.text())
    assert.deepEqual(edit.legacyAuthorNames, ['Nom Libre'])
    assert.isFalse(edit.legacyAuthorsNonText)

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ title: 'Titre seul modifié', authorIds: [a.id] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.title, 'Titre seul modifié')
    assert.deepEqual(production.authorNames, ['Aminata Fictiva', 'Nom Libre'])
  })

  test('valeur non textuelle : signalée dans le formulaire, jamais effacée implicitement', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction()
    await db
      .from('productions')
      .where('id', production.id)
      .update({ authors: db.raw(`'[42]'::jsonb`) })

    const editResponse = await client.get(`/admin/productions/${production.id}/edit`).loginAs(admin)
    const edit = extractProps(editResponse.text())
    assert.isTrue(edit.legacyAuthorsNonText)

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.deepEqual(await namesOf(production.id), [42] as any)
  })

  test('identifiant mal formé : erreur par élément remontée (authors_invalid)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction()
    const response = await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: ['pas-un-uuid'] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    const flashed = JSON.stringify(response.flashMessages())
    assert.include(flashed, 'authorIds.0')
    assert.include(flashed, 'productions.form.errors.authors_invalid')
  })

  test('uuid en majuscules accepté et normalisé ; plus de 200 identifiants refusés', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Aminata', 'Fictiva')
    const production = await createProduction()

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [a.id.toUpperCase()] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.deepEqual(await pivotOf(production.id), [[a.id, 1]])

    const tooMany = Array.from(
      { length: 201 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    )
    const response = await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ title: 'Refusé', authorIds: tooMany }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.include(JSON.stringify(response.flashMessages()), 'authors_invalid')
    await production.refresh()
    assert.notEqual(production.title, 'Refusé')
  })

  test('AC9 : non convertie publiée à qui il manque un autre critère → dépubliée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      authorNames: ['Nom Libre'],
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ summary: '', authorIds: [] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.status, 'draft')
    assert.deepEqual(production.authorNames, ['Nom Libre'])
  })

  test('AC9 : non convertie publiée, authorIds absent → reste publiée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({
      authorNames: ['Nom Libre'],
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody())
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    await production.refresh()
    assert.equal(production.status, 'published')
    assert.deepEqual(production.authorNames, ['Nom Libre'])
  })

  test('AC11 : la page publique de la production affiche l’auteur sélectionné', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createAuthor('Zébulon', 'Imaginarius')
    const production = await createProduction({
      status: 'published',
      antaPublishedAt: DateTime.now(),
    })

    await client
      .put(`/admin/productions/${production.id}`)
      .json(formBody({ authorIds: [a.id] }))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    await production.refresh()
    assert.equal(production.status, 'published')

    const page = await client.get(`/productions/${production.slug}`)
    page.assertStatus(200)
    // Story 10.4: byline `{ name, slug }` ; profile not public (no consent) → no link.
    assert.deepEqual(extractProps(page.text()).production.authors, [
      { name: 'Zébulon IMAGINARIUS', slug: null },
    ])
  })
})

test.group('Admin authors | search — revue de code 9.7', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('plus de 20 exclude[] (objet qs) : toujours écartés', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const excluded: Author[] = []
    for (let i = 0; i < 22; i++) {
      excluded.push(await createAuthor(`Prénom${String.fromCharCode(97 + i)}`, 'Fictiva'))
    }
    const kept = await createAuthor('Zoé', 'Fictiva')
    const qs = excluded.map((author) => `exclude[]=${author.id}`).join('&')

    const response = await client.get(`/admin/authors/search?q=fictiva&${qs}`).loginAs(admin)
    assert.deepEqual(
      response.body().authors.map((x: { id: string }) => x.id),
      [kept.id]
    )
  })

  test('longueur minimale mesurée sur le terme normalisé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    await createAuthor('Éa', 'Fictiva')
    const response = await client.get('/admin/authors/search').qs({ q: 'é-' }).loginAs(admin)
    assert.deepEqual(response.body(), { authors: [] })
  })
})
