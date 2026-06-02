import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import Production from '#models/production'

type ProductionFixture = {
  title?: string
  summary?: string | null
  authors?: string[]
  status?: 'draft' | 'published' | 'unpublished'
  category?: string | null
  domain?: string | null
  subdomain?: string[]
  language?: string | null
  publicationCountry?: string | null
  licenseStatus?: 'member' | 'free_license' | 'external_link'
}

async function createProduction(opts: ProductionFixture = {}): Promise<Production> {
  return Production.create({
    title: opts.title ?? `Production ${Math.floor(Math.random() * 1_000_000)}`,
    summary: opts.summary ?? null,
    authors: opts.authors ?? [],
    tags: [],
    status: opts.status ?? 'published',
    category: opts.category ?? null,
    domain: opts.domain ?? null,
    subdomain: opts.subdomain ?? [],
    language: opts.language ?? null,
    publicationCountry: opts.publicationCountry ?? null,
    licenseStatus: opts.licenseStatus ?? 'member',
    antaPublishedAt: DateTime.now(),
    createdById: null,
  })
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

async function getProps(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  return extractProps(response.text())
}

function titles(results: { title: string }[]): string[] {
  return results.map((r) => r.title)
}

test.group('Public search | full-text', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('?q matche le titre', async ({ client, assert }) => {
    await createProduction({ title: 'Topologie quantique' })
    await createProduction({ title: 'Cuisine traditionnelle' })

    const props = await getProps(client, '/productions?q=topologie')
    assert.deepEqual(titles(props.results), ['Topologie quantique'])
  })

  test('?q matche le résumé et les auteurs', async ({ client, assert }) => {
    await createProduction({ title: 'Sans rapport', summary: 'étude sur les mathématiques' })
    await createProduction({ title: 'Autre', authors: ['Cheikh Anta Diop'] })

    const bySummary = await getProps(client, '/productions?q=mathématiques')
    assert.lengthOf(bySummary.results, 1)

    const byAuthor = await getProps(client, '/productions?q=Cheikh')
    assert.lengthOf(byAuthor.results, 1)
  })

  test('?q multi-mots ne lève pas une erreur SQL', async ({ client }) => {
    await createProduction({ title: 'Topologie quantique avancée' })
    const response = await client.get('/productions?q=topologie quantique')
    response.assertStatus(200)
  })

  test('un brouillon est exclu de la recherche', async ({ client, assert }) => {
    await createProduction({ title: 'Secret brouillon', status: 'draft' })
    const props = await getProps(client, '/productions?q=secret')
    assert.lengthOf(props.results, 0)
  })

  test('aucun résultat → results vide + pagination.total 0', async ({ client, assert }) => {
    await createProduction({ title: 'Topologie quantique' })
    const props = await getProps(client, '/productions?q=zzzaucunecorrespondance')
    assert.lengthOf(props.results, 0)
    assert.equal(props.pagination.total, 0)
  })
})

test.group('Public search | filtres', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('OR intra-dimension : ?category=A&category=B', async ({ client, assert }) => {
    await createProduction({ title: 'PA', category: 'Article' })
    await createProduction({ title: 'PL', category: 'Livre' })
    await createProduction({ title: 'PT', category: 'Thèse' })

    const props = await getProps(client, '/productions?category=Article&category=Livre')
    assert.sameMembers(titles(props.results), ['PA', 'PL'])
  })

  test('AND inter-dimensions : ?category=A&language=fr', async ({ client, assert }) => {
    await createProduction({ title: 'Match', category: 'Livre', language: 'fr' })
    await createProduction({ title: 'WrongLang', category: 'Livre', language: 'en' })
    await createProduction({ title: 'WrongCat', category: 'Article', language: 'fr' })

    const props = await getProps(client, '/productions?category=Livre&language=fr')
    assert.deepEqual(titles(props.results), ['Match'])
  })

  test('filtre auteur sur le tableau jsonb', async ({ client, assert }) => {
    await createProduction({ title: 'AvecAuteur', authors: ['Kofi Annan', 'Autre'] })
    await createProduction({ title: 'SansAuteur', authors: ['Personne'] })

    const props = await getProps(client, '/productions?author=Kofi Annan')
    assert.deepEqual(titles(props.results), ['AvecAuteur'])
  })

  test('filtre licence (enum)', async ({ client, assert }) => {
    await createProduction({ title: 'Member', licenseStatus: 'member' })
    await createProduction({ title: 'Free', licenseStatus: 'free_license' })

    const props = await getProps(client, '/productions?license=member')
    assert.deepEqual(titles(props.results), ['Member'])
  })

  test('licence invalide ignorée (toutes les productions)', async ({ client, assert }) => {
    await createProduction({ title: 'A' })
    await createProduction({ title: 'B' })

    const props = await getProps(client, '/productions?license=bogus')
    assert.lengthOf(props.results, 2)
    assert.deepEqual(props.activeFilters.license, [])
  })

  test('facettes : valeurs distinctes des productions publiées', async ({ client, assert }) => {
    await createProduction({ category: 'Livre', language: 'fr', authors: ['Diop'] })
    await createProduction({ category: 'Article', language: 'fr', authors: ['Diop', 'Senghor'] })
    await createProduction({ category: 'Livre', status: 'draft', language: 'en' })

    const props = await getProps(client, '/productions')
    assert.deepEqual([...props.facets.category].sort(), ['Article', 'Livre'])
    assert.deepEqual([...props.facets.language].sort(), ['fr'])
    assert.sameMembers(props.facets.author, ['Diop', 'Senghor'])
  })
})

test.group('Public search | pagination + persistance', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('?page=2 respecté + filtres conservés', async ({ client, assert }) => {
    for (let i = 0; i < 21; i++) await createProduction({ category: 'Livre' })

    const props = await getProps(client, '/productions?category=Livre&page=2')
    assert.lengthOf(props.results, 1)
    assert.equal(props.pagination.currentPage, 2)
    assert.equal(props.pagination.total, 21)
    assert.deepEqual(props.activeFilters.category, ['Livre'])
  })
})
