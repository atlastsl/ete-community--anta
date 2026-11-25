import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import StatsView from '#models/stats_view'
import ProductionAuthorService from '#services/production_author_service'

// Story 10.5 — liste publique des auteurs (FR57, D3, D13, D14, D31). Noms fictifs uniquement
// (dépôt public). Les lignes créées sont annulées par la transaction globale de chaque test.

function extractPage(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
}

async function propsOf(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  const page = extractPage(response.text())!
  return page.props
}

let sequence = 0

async function createAuthor(
  options: {
    consent?: boolean
    firstNames?: string
    lastNames?: string
    institutions?: string[]
  } = {}
): Promise<Author> {
  sequence++
  const author = await Author.create({
    firstNames: options.firstNames ?? 'Jeanne',
    lastNames: options.lastNames ?? `Listeexemple${sequence}`,
    consentConfirmedAt: options.consent === false ? null : DateTime.now(),
  })
  let position = 1
  for (const institution of options.institutions ?? []) {
    await AuthorAffiliation.create({ authorId: author.id, position: position++, institution })
  }
  return author
}

async function createProduction(
  overrides: { status?: 'draft' | 'published'; domain?: string } = {}
): Promise<Production> {
  sequence++
  return Production.create({
    title: `Oeuvre liste ${sequence}`,
    summary: 'Résumé de test.',
    authorNames: [],
    tags: [],
    category: 'Livre',
    domain: overrides.domain ?? 'Informatique',
    subdomain: [],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: overrides.status ?? 'published',
    antaPublishedAt: overrides.status === 'draft' ? null : DateTime.now(),
  })
}

async function link(production: Production, author: Author, position = 1) {
  await db.table('production_authors').insert({
    production_id: production.id,
    author_id: author.id,
    position,
  })
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
}

async function addViews(production: Production, count: number, daysAgo = 0) {
  for (let i = 0; i < count; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now().minus({ days: daysAgo }),
      ipHash: `l${daysAgo}-${i}`,
    })
  }
}

/** A visible author (public + one published production), with optional views. */
async function visibleAuthor(
  options: Parameters<typeof createAuthor>[0] & { views?: number; domain?: string } = {}
) {
  const author = await createAuthor(options)
  const production = await createProduction({ domain: options.domain })
  await link(production, author)
  if (options.views) await addViews(production, options.views)
  return { author, production }
}

const slugsOf = (props: any): string[] => props.authors.map((a: any) => a.slug)

test.group('Public | liste des auteurs — visibilité et forme', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    // Isolation : seuls les auteurs de ce test sont visibles (aucune ligne pivot préexistante).
    await db.from('production_authors').delete()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET /authors → page authors, seuls les auteurs visibles', async ({ client, assert }) => {
    const { author: visible } = await visibleAuthor()
    const noConsent = await createAuthor({ consent: false })
    await link(await createProduction(), noConsent)
    const draftOnly = await createAuthor()
    await link(await createProduction({ status: 'draft' }), draftOnly)
    await createAuthor() // aucune production

    const response = await client.get('/authors')
    response.assertStatus(200)
    const page = extractPage(response.text())!
    assert.equal(page.component, 'authors')
    assert.deepEqual(slugsOf(page.props), [visible.slug])
    assert.notInclude(response.text(), noConsent.lastNames)
    assert.notInclude(response.text(), draftOnly.lastNames)
  })

  test('carte : nom, institution principale, productions publiées et vues totales, sans champ interne', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor({
      lastNames: 'Cartefictive',
      institutions: ['Université Exemple A', 'Institut Exemple B'],
    })
    const p1 = await createProduction()
    const p2 = await createProduction()
    const draft = await createProduction({ status: 'draft' })
    await link(p1, author)
    await link(p2, author)
    await link(draft, author)
    await addViews(p1, 3)
    await addViews(p2, 2, 400) // hors fenêtre : compté dans le total (D3)
    await addViews(draft, 5) // brouillon : jamais compté

    const props = await propsOf(client, '/authors')
    const card = props.authors.find((a: any) => a.slug === author.slug)
    assert.deepEqual(card, {
      slug: author.slug,
      firstNames: 'Jeanne',
      lastNames: 'Cartefictive',
      photoBase: null,
      primaryInstitution: 'Université Exemple A',
      productionsCount: 2,
      viewsCount: 5,
    })
  })

  test('auteur sans affiliation → institution principale null', async ({ client, assert }) => {
    const { author } = await visibleAuthor()
    const props = await propsOf(client, '/authors')
    assert.isNull(props.authors.find((a: any) => a.slug === author.slug).primaryInstitution)
  })

  test('props : pagination, filtres et tri par défaut, meta', async ({ client, assert }) => {
    await visibleAuthor()
    const props = await propsOf(client, '/authors')
    assert.equal(props.sort, 'views')
    assert.deepEqual(props.filters, { q: null, institution: null, domain: null })
    assert.equal(props.pagination.perPage, 24)
    assert.equal(props.pagination.currentPage, 1)
    assert.isTrue(props.hasAuthors)
    assert.equal(props.meta.title, 'Auteurs — Anta')
  })
})

test.group('Public | liste des auteurs — recherche et facettes', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    // Isolation : seuls les auteurs de ce test sont visibles (aucune ligne pivot préexistante).
    await db.from('production_authors').delete()
    return () => db.rollbackGlobalTransaction()
  })

  test('recherche insensible à la casse et aux accents', async ({ client, assert }) => {
    const { author: target } = await visibleAuthor({
      firstNames: 'Hélène',
      lastNames: 'Évrardfictif',
    })
    const { author: other } = await visibleAuthor({ lastNames: 'Autrenomzz' })

    for (const q of ['evrardfictif', 'ÉVRARDFICTIF', 'helene evrard']) {
      const props = await propsOf(client, `/authors?q=${encodeURIComponent(q)}`)
      assert.include(slugsOf(props), target.slug, q)
      assert.notInclude(slugsOf(props), other.slug, q)
      assert.equal(props.filters.q, q)
    }
  })

  test('facette institution : auteurs visibles, dédoublonnée, graphie majoritaire', async ({
    client,
    assert,
  }) => {
    await visibleAuthor({ institutions: ['Université Fictive de Test'] })
    await visibleAuthor({ institutions: ['Université Fictive de Test'] })
    await visibleAuthor({ institutions: ['universite fictive de TEST'] })
    // Auteur non visible : son institution n'apparaît pas.
    await createAuthor({ consent: false, institutions: ['Institut Caché Exemple'] })

    const props = await propsOf(client, '/authors')
    const labels = props.institutionOptions.map((o: any) => o.label)
    assert.deepEqual(labels, ['Université Fictive de Test'])
    for (const option of props.institutionOptions)
      assert.deepEqual(Object.keys(option), ['value', 'label'])
  })

  test('filtre institution sur toutes les affiliations, libellé normalisé', async ({
    client,
    assert,
  }) => {
    const { author: secondary } = await visibleAuthor({
      institutions: ['Institut Premier Exemple', 'École Seconde Exemple'],
    })
    const { author: other } = await visibleAuthor({ institutions: ['Institut Premier Exemple'] })

    const props = await propsOf(
      client,
      `/authors?institution=${encodeURIComponent('ecole SECONDE exemple')}`
    )
    assert.deepEqual(slugsOf(props), [secondary.slug])
    assert.notInclude(slugsOf(props), other.slug)
    assert.deepEqual(
      props.institutionOptions.map((o: any) => o.label),
      ['École Seconde Exemple', 'Institut Premier Exemple']
    )
    // Libellé canonique renvoyé pour la sélection.
    assert.equal(props.filters.institution, 'École Seconde Exemple')
  })

  test('facette et filtre domaine', async ({ client, assert }) => {
    const { author: agro } = await visibleAuthor({ domain: 'Agronomie' })
    const { author: info } = await visibleAuthor({ domain: 'Informatique' })
    const hidden = await createAuthor({ consent: false })
    await link(await createProduction({ domain: 'Domaine Caché Test' }), hidden)

    const all = await propsOf(client, '/authors')
    assert.deepEqual(all.domainOptions, ['Agronomie', 'Informatique'])

    const props = await propsOf(client, '/authors?domain=Agronomie')
    assert.deepEqual(slugsOf(props), [agro.slug])
    assert.notInclude(slugsOf(props), info.slug)
    assert.equal(props.filters.domain, 'Agronomie')
  })

  test('facettes : un auteur consentant dont la seule production est un brouillon n’y figure pas', async ({
    client,
    assert,
  }) => {
    const { author: visible } = await visibleAuthor({
      domain: 'Agronomie',
      institutions: ['Institut Visible Test'],
    })
    const draftOnly = await createAuthor({ institutions: ['Institut Brouillon Test'] })
    await link(await createProduction({ status: 'draft', domain: 'Histoire' }), draftOnly)

    const props = await propsOf(client, '/authors')
    assert.deepEqual(slugsOf(props), [visible.slug])
    assert.deepEqual(
      props.institutionOptions.map((o: any) => o.label),
      ['Institut Visible Test']
    )
    assert.deepEqual(props.domainOptions, ['Agronomie'])
  })

  test('facette domaine : le domaine d’un brouillon d’un auteur visible en est absent', async ({
    client,
    assert,
  }) => {
    const { author } = await visibleAuthor({ domain: 'Informatique' })
    await link(await createProduction({ status: 'draft', domain: 'Histoire' }), author, 1)
    const props = await propsOf(client, '/authors')
    assert.deepEqual(props.domainOptions, ['Informatique'])
  })

  test('institution ou domaine inconnus → filtre ignoré, null dans les props', async ({
    client,
    assert,
  }) => {
    const { author: a } = await visibleAuthor({
      domain: 'Agronomie',
      institutions: ['Institut A Test'],
    })
    const { author: b } = await visibleAuthor({ domain: 'Informatique' })
    const expected = [a.slug, b.slug].sort()

    for (const qs of ['institution=Institut+Inconnu', 'domain=Histoire', 'domain=agronomie']) {
      const props = await propsOf(client, `/authors?${qs}`)
      assert.deepEqual(props.filters, { q: null, institution: null, domain: null }, qs)
      assert.deepEqual([...slugsOf(props)].sort(), expected, qs)
    }
  })

  test('page hors limites : un filtre inconnu disparaît de la redirection', async ({
    client,
    assert,
  }) => {
    await visibleAuthor({ domain: 'Agronomie' })
    const response = await client.get('/authors?domain=Inconnu&sort=name&page=5').redirects(0)
    response.assertStatus(302)
    assert.equal(response.header('location'), '/authors?sort=name')
  })

  test('filtres combinés en ET, paramètres non chaînes ignorés', async ({ client, assert }) => {
    const { author } = await visibleAuthor({
      lastNames: 'Combinezz',
      domain: 'Agronomie',
      institutions: ['Institut Combiné Test'],
    })
    await visibleAuthor({ lastNames: 'Combinezz', domain: 'Informatique' })
    const props = await propsOf(
      client,
      `/authors?q=combinezz&domain=Agronomie&institution=${encodeURIComponent('Institut Combiné Test')}`
    )
    assert.deepEqual(slugsOf(props), [author.slug])

    const arrays = await propsOf(client, '/authors?q[]=x&domain[]=y&sort[]=name')
    assert.deepEqual(arrays.filters, { q: null, institution: null, domain: null })
    assert.equal(arrays.sort, 'views')
  })
})

test.group('Public | liste des auteurs — tris et pagination', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    // Isolation : seuls les auteurs de ce test sont visibles.
    await db.from('production_authors').delete()
    return () => db.rollbackGlobalTransaction()
  })

  test('défaut : vues 365 j ↓, vues hors fenêtre ignorées, 0 vue en fin, ex æquo dernière publication puis nom', async ({
    client,
    assert,
  }) => {
    const { author: old, production: oldFirst } = await visibleAuthor({ lastNames: 'Aancien' })
    await oldFirst.merge({ antaPublishedAt: DateTime.now().minus({ days: 400 }) }).save()
    const oldProduction = await createProduction()
    await oldProduction.merge({ antaPublishedAt: DateTime.now().minus({ days: 400 }) }).save()
    await link(oldProduction, old, 1)
    await addViews(oldProduction, 10, 366)
    const { author: recent } = await visibleAuthor({ lastNames: 'Recent', views: 2 })
    const tie = { lastNames: 'Egal', views: 1 }
    const { author: tieB, production: tieBProd } = await visibleAuthor({
      ...tie,
      firstNames: 'Bea',
    })
    const { author: tieA, production: tieAProd } = await visibleAuthor({
      ...tie,
      firstNames: 'Ada',
    })
    const { author: zero } = await visibleAuthor({ lastNames: 'Zero' })
    // Même dernière publication pour les ex æquo → nom puis prénom.
    const sameDay = DateTime.now().minus({ days: 2 })
    await tieBProd.merge({ antaPublishedAt: sameDay }).save()
    await tieAProd.merge({ antaPublishedAt: sameDay }).save()

    const props = await propsOf(client, '/authors')
    // 0 vue dans la fenêtre : « Zero » (publié après « Aancien ») passe devant (D36, PO 2026-11-25).
    assert.deepEqual(slugsOf(props), [recent.slug, tieA.slug, tieB.slug, zero.slug, old.slug])
    // Le total de l'ancien compte toutes ses vues.
    assert.equal(props.authors.find((a: any) => a.slug === old.slug).viewsCount, 10)
  })

  test('name : nom de famille puis prénom', async ({ client, assert }) => {
    const { author: c } = await visibleAuthor({ firstNames: 'Zoe', lastNames: 'Charlie' })
    const { author: a2 } = await visibleAuthor({ firstNames: 'Yann', lastNames: 'Alpha' })
    const { author: a1 } = await visibleAuthor({ firstNames: 'Anne', lastNames: 'Alpha', views: 5 })
    const props = await propsOf(client, '/authors?sort=name')
    assert.deepEqual(slugsOf(props), [a1.slug, a2.slug, c.slug])
    assert.equal(props.sort, 'name')
  })

  test('productions : nombre de productions publiées ↓ puis nom', async ({ client, assert }) => {
    const { author: one } = await visibleAuthor({ lastNames: 'Aun', views: 9 })
    const { author: two } = await visibleAuthor({ lastNames: 'Zdeux' })
    await link(await createProduction(), two)
    await link(await createProduction({ status: 'draft' }), one)
    await link(await createProduction({ status: 'draft' }), one)
    const { author: oneB } = await visibleAuthor({ lastNames: 'Bun' })
    const props = await propsOf(client, '/authors?sort=productions')
    assert.deepEqual(slugsOf(props), [two.slug, one.slug, oneB.slug])
  })

  test('tri views : ex æquo départagés par la dernière publication, puis le nom (D36, PO 2026-11-25)', async ({
    client,
    assert,
  }) => {
    const { author: older, production: olderProd } = await visibleAuthor({
      lastNames: 'Departageexemple A',
      views: 2,
    })
    const { author: newer, production: newerProd } = await visibleAuthor({
      lastNames: 'Departageexemple B',
      views: 2,
    })
    const { author: newerTwin, production: twinProd } = await visibleAuthor({
      lastNames: 'Departageexemple C',
      views: 2,
    })
    const { author: top } = await visibleAuthor({ lastNames: 'Departageexemple D', views: 3 })
    const recent = DateTime.now().minus({ days: 1 })
    await olderProd.merge({ antaPublishedAt: DateTime.now().minus({ days: 30 }) }).save()
    await newerProd.merge({ antaPublishedAt: recent }).save()
    await twinProd.merge({ antaPublishedAt: recent }).save()
    const props = await propsOf(client, '/authors?q=Departageexemple')
    // newer et newerTwin : même date → nom (B avant C) ; older (publication plus ancienne) en dernier.
    assert.deepEqual(slugsOf(props), [top.slug, newer.slug, newerTwin.slug, older.slug])
  })

  test('tri inconnu → défaut', async ({ client, assert }) => {
    await visibleAuthor()
    const props = await propsOf(client, '/authors?sort=popularite')
    assert.equal(props.sort, 'views')
  })

  test('24 par page, pages disjointes et stables', async ({ client, assert }) => {
    for (let i = 0; i < 25; i++) await visibleAuthor({ lastNames: 'Memenom' })
    const p1 = await propsOf(client, '/authors?sort=name')
    const p2 = await propsOf(client, '/authors?sort=name&page=2')
    assert.lengthOf(p1.authors, 24)
    assert.lengthOf(p2.authors, 1)
    assert.equal(p1.pagination.total, 25)
    assert.equal(p1.pagination.lastPage, 2)
    assert.notInclude(slugsOf(p1), p2.authors[0].slug)
  })

  test('page hors limites → 302 vers la dernière page, paramètres conservés', async ({
    client,
    assert,
  }) => {
    await visibleAuthor({ lastNames: 'Redirectzz', domain: 'Agronomie' })
    const response = await client
      .get('/authors?q=redirectzz&domain=Agronomie&sort=name&page=9')
      .redirects(0)
    response.assertStatus(302)
    assert.equal(response.header('location'), '/authors?q=redirectzz&domain=Agronomie&sort=name')
  })

  test('page invalide → page 1', async ({ client, assert }) => {
    await visibleAuthor()
    for (const page of ['0', '-1', 'abc', '1.5', '1e21']) {
      const response = await client.get(`/authors?page=${page}`).redirects(0)
      response.assertStatus(200)
      assert.equal(extractPage(response.text())!.props.pagination.currentPage, 1, page)
    }
  })

  test('aucun profil visible → hasAuthors false, liste vide', async ({ client, assert }) => {
    await createAuthor({ consent: false })
    const props = await propsOf(client, '/authors')
    assert.lengthOf(props.authors, 0)
    assert.isFalse(props.hasAuthors)
  })

  test('filtres sans résultat → liste vide, hasAuthors true', async ({ client, assert }) => {
    await visibleAuthor()
    const props = await propsOf(client, '/authors?q=aucunauteurneressemble')
    assert.lengthOf(props.authors, 0)
    assert.isTrue(props.hasAuthors)
  })

  test('page > 1 sans aucun résultat → 302 vers /authors (paramètres conservés)', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/authors?q=rienrien&page=3').redirects(0)
    response.assertStatus(302)
    assert.equal(response.header('location'), '/authors?q=rienrien')
  })
})

test.group('Migration | index des fenêtres de statistiques', () => {
  test('les trois index existent', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT indexname FROM pg_indexes WHERE indexname IN (?, ?, ?)`,
      [
        'idx_stats_views_production_id_recorded_at',
        'idx_stats_downloads_production_id_downloaded_at',
        'idx_stats_downloads_downloaded_at',
      ]
    )
    assert.lengthOf(result.rows, 3)
  })
})
