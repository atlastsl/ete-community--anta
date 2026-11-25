import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
import Production from '#models/production'
import PublicBylineService from '#services/public_byline_service'

// Story 10.4 — noms d'auteurs liés vers leur profil (FR59, D12, D24, P2.7).
// Noms fictifs uniquement (dépôt public). Lignes annulées par la transaction globale.

function extractPage(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
}

async function propsOf(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  return extractPage(response.text())!.props
}

let sequence = 0

async function createAuthor(
  options: { consent?: boolean; firstNames?: string; lastNames?: string } = {}
): Promise<Author> {
  sequence++
  return Author.create({
    firstNames: options.firstNames ?? 'Jeanne',
    lastNames: options.lastNames ?? `Exemple${sequence}`,
    consentConfirmedAt: options.consent === false ? null : DateTime.now(),
  })
}

async function createProduction(
  overrides: { authorNames?: string[]; title?: string; status?: 'draft' | 'published' } = {}
): Promise<Production> {
  sequence++
  return Production.create({
    title: overrides.title ?? `Oeuvre byline ${sequence}`,
    summary: 'Résumé de test.',
    authorNames: overrides.authorNames ?? [],
    tags: [],
    category: 'Livre',
    domain: 'Informatique',
    subdomain: [],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: overrides.status ?? 'published',
    antaPublishedAt: overrides.status === 'draft' ? null : DateTime.now(),
  })
}

/** Links the authors in the given order (positions 1..n) and writes the jsonb like 9.7. */
async function linkAll(production: Production, authors: Author[]) {
  let position = 1
  for (const author of authors) {
    await db.table('production_authors').insert({
      production_id: production.id,
      author_id: author.id,
      position: position++,
    })
  }
  production.authorNames = authors.map((a) => `${a.firstNames} ${a.lastNames}`)
  await production.save()
}

test.group('Public | bylines — page de détail', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('ordre du pivot ; slug seulement pour un profil public', async ({ client, assert }) => {
    const publicA = await createAuthor({ firstNames: 'Clarisse', lastNames: 'Fictive' })
    const privateB = await createAuthor({ firstNames: 'Paul', lastNames: 'Essai', consent: false })
    const publicC = await createAuthor({ firstNames: 'Awa', lastNames: 'Modèle' })
    const production = await createProduction()
    // Positions volontairement différentes de l'ordre de création.
    await linkAll(production, [publicC, privateB, publicA])

    const props = await propsOf(client, `/productions/${production.slug}`)
    assert.deepEqual(props.production.authors, [
      { name: 'Awa MODÈLE', slug: publicC.slug },
      { name: 'Paul ESSAI', slug: null },
      { name: 'Clarisse FICTIVE', slug: publicA.slug },
    ])
  })

  test('aucune donnée d’un auteur non public dans la réponse', async ({ client, assert }) => {
    const hidden = await createAuthor({ firstNames: 'Paul', lastNames: 'Cache', consent: false })
    const production = await createProduction()
    await linkAll(production, [hidden])

    const response = await client.get(`/productions/${production.slug}`)
    response.assertStatus(200)
    const body = response.text()
    assert.notInclude(body, hidden.slug)
    assert.notInclude(body, hidden.id)
    const props = extractPage(body)!.props
    assert.deepEqual(Object.keys(props.production.authors[0]).sort(), ['name', 'slug'])
  })

  test('production non convertie : noms jsonb en texte simple', async ({ client, assert }) => {
    const production = await createProduction({
      authorNames: ['Nom Libre', 'Autre Nom Libre', 'Nom Libre', ' '],
    })
    const props = await propsOf(client, `/productions/${production.slug}`)
    assert.deepEqual(props.production.authors, [
      { name: 'Nom Libre', slug: null },
      { name: 'Autre Nom Libre', slug: null },
    ])
  })

  test('production partielle : pivot puis noms jsonb non rattachés', async ({ client, assert }) => {
    const linked = await createAuthor({ firstNames: 'Jeanne', lastNames: 'Rattachée' })
    const production = await createProduction()
    await linkAll(production, [linked])
    production.authorNames = ['Nom Ancien', 'Jeanne Rattachée']
    await production.save()

    const props = await propsOf(client, `/productions/${production.slug}`)
    assert.deepEqual(props.production.authors, [
      { name: 'Jeanne RATTACHÉE', slug: linked.slug },
      { name: 'Nom Ancien', slug: null },
    ])
  })

  test('retrait du consentement → nom sans lien au rechargement', async ({ client, assert }) => {
    const author = await createAuthor()
    const production = await createProduction()
    await linkAll(production, [author])
    const before = await propsOf(client, `/productions/${production.slug}`)
    assert.equal(before.production.authors[0].slug, author.slug)

    author.consentConfirmedAt = null
    await author.save()
    const after = await propsOf(client, `/productions/${production.slug}`)
    assert.isNull(after.production.authors[0].slug)
  })

  test('meta de la production : noms affichés', async ({ client, assert }) => {
    const author = await createAuthor({ firstNames: 'Jeanne', lastNames: 'Meta' })
    const production = await createProduction()
    await linkAll(production, [author])
    const props = await propsOf(client, `/productions/${production.slug}`)
    assert.include(props.meta.description, 'Jeanne META')
  })
})

test.group('Public | bylines — cartes', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('listing : slug public, null sinon, ordre du pivot', async ({ client, assert }) => {
    const token = `Bylinelisting${Date.now()}`
    const pub = await createAuthor({ firstNames: 'Awa', lastNames: 'Carte' })
    const priv = await createAuthor({ firstNames: 'Paul', lastNames: 'Carte', consent: false })
    const production = await createProduction({ title: `${token} oeuvre` })
    await linkAll(production, [priv, pub])
    const free = await createProduction({ title: `${token} libre`, authorNames: ['Nom Libre'] })

    const props = await propsOf(client, `/productions?q=${token}`)
    const card = props.results.find((r: { id: string }) => r.id === production.id)
    assert.deepEqual(card.authors, [
      { name: 'Paul CARTE', slug: null },
      { name: 'Awa CARTE', slug: pub.slug },
    ])
    const freeCard = props.results.find((r: { id: string }) => r.id === free.id)
    assert.deepEqual(freeCard.authors, [{ name: 'Nom Libre', slug: null }])
  })

  test('listing, résultats approchants (pg_trgm seul) : lien du profil public', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor({ firstNames: 'Awa', lastNames: 'Approchée' })
    const production = await createProduction({ title: 'Xylophonique Brumaire' })
    await linkAll(production, [author])

    // Faute de frappe : aucun mot ne correspond en préfixe, seule la similarité trigram trouve.
    const props = await propsOf(client, '/productions?q=Xylofonnique')
    assert.isTrue(props.approximate)
    const card = props.results.find((r: { id: string }) => r.id === production.id)
    assert.deepEqual(card.authors, [{ name: 'Awa APPROCHÉE', slug: author.slug }])
  })

  test('accueil : cartes au format { name, slug }', async ({ client, assert }) => {
    const author = await createAuthor()
    const production = await createProduction()
    await linkAll(production, [author])
    const props = await propsOf(client, '/')
    const card = [...props.recent, ...props.mostViewed].find(
      (r: { id: string }) => r.id === production.id
    )
    assert.exists(card)
    assert.deepEqual(card.authors, [
      { name: `Jeanne ${author.lastNames.toUpperCase()}`, slug: author.slug },
    ])
  })

  test('profil : cartes liées, co-auteur non public sans slug', async ({ client, assert }) => {
    const author = await createAuthor()
    const coAuthor = await createAuthor({
      firstNames: 'Paul',
      lastNames: 'Coauteur',
      consent: false,
    })
    const production = await createProduction()
    await linkAll(production, [author, coAuthor])
    const props = await propsOf(client, `/authors/${author.slug}`)
    assert.deepEqual(props.productions[0].authors, [
      { name: `Jeanne ${author.lastNames.toUpperCase()}`, slug: author.slug },
      { name: 'Paul COAUTEUR', slug: null },
    ])
  })
})

test.group('PublicBylineService', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  /** Queries sent through knex (the global transaction forwards its events to the instance). */
  async function countQueries(fn: () => Promise<void>): Promise<number> {
    let count = 0
    const listener = () => count++
    const knex = db.connection().getWriteClient()
    knex.on('query', listener)
    try {
      await fn()
    } finally {
      knex.removeListener('query', listener)
    }
    return count
  }

  test('au plus 2 requêtes, quel que soit le nombre de productions', async ({ assert }) => {
    const productions: Production[] = []
    for (let i = 0; i < 6; i++) {
      const production = await createProduction()
      await linkAll(production, [await createAuthor(), await createAuthor({ consent: false })])
      productions.push(production)
    }
    const few = await countQueries(() => PublicBylineService.attach(productions.slice(0, 1)))
    const many = await countQueries(() => PublicBylineService.attach(productions))
    assert.isAtMost(few, 2)
    assert.isAtMost(many, 2)
    assert.lengthOf(productions[5].$extras.byline, 2)
  })

  test('liste vide : aucune requête', async ({ assert }) => {
    assert.equal(await countQueries(() => PublicBylineService.attach([])), 0)
  })
})
