import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import Production from '#models/production'
import Author from '#models/author'
import ProductionAuthorService from '#services/production_author_service'

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
    authorNames: opts.authors ?? [],
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
    await createProduction({ title: 'Autre', authors: ['Albertine Fictivenom'] })

    const bySummary = await getProps(client, '/productions?q=mathématiques')
    assert.lengthOf(bySummary.results, 1)

    const byAuthor = await getProps(client, '/productions?q=Albertine')
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
    await db.from('production_authors').delete()
    await createProduction({ category: 'Livre', language: 'fr', authors: ['Nomlibre'] })
    await createProduction({
      category: 'Article',
      language: 'fr',
      authors: ['Nomlibre', 'Autrenom'],
    })
    await createProduction({ category: 'Livre', status: 'draft', language: 'en' })

    const props = await getProps(client, '/productions')
    assert.deepEqual([...props.facets.category].sort(), ['Article', 'Livre'])
    assert.deepEqual([...props.facets.language].sort(), ['fr'])
    // Story 10.6 : la facette auteur ne lit plus les noms libres du jsonb (profils seulement).
    assert.deepEqual(props.facets.author, [])
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

// ---------------------------------------------------------------------------
// Story 10.6 — filtre `author=<slug>` par profil public (FR5, D12, D28). Noms fictifs
// uniquement (dépôt public) ; lignes annulées par la transaction globale de chaque test.
// ---------------------------------------------------------------------------

let authorSequence = 0

async function createAuthor(
  options: { consent?: boolean; firstNames?: string; lastNames?: string } = {}
): Promise<Author> {
  authorSequence++
  return Author.create({
    firstNames: options.firstNames ?? 'Jeanne',
    lastNames: options.lastNames ?? `Filtreexemple${authorSequence}`,
    consentConfirmedAt: options.consent === false ? null : DateTime.now(),
  })
}

async function link(production: Production, ...authors: Author[]) {
  let position = 1
  for (const author of authors) {
    await db.table('production_authors').insert({
      production_id: production.id,
      author_id: author.id,
      position: position++,
    })
  }
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
}

test.group('Public search | filtre auteur par slug', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    // Isolation : seuls les auteurs de ce test sont visibles (aucune ligne pivot préexistante).
    await db.from('production_authors').delete()
    return () => db.rollbackGlobalTransaction()
  })

  test('un slug : seules les productions publiées liées à cet auteur', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    const other = await createAuthor()
    await link(await createProduction({ title: 'DeLui' }), author)
    await link(await createProduction({ title: 'CoEcrite' }), other, author)
    await link(await createProduction({ title: 'DeLautre' }), other)
    await link(await createProduction({ title: 'BrouillonDeLui', status: 'draft' }), author)
    await createProduction({ title: 'SansAuteur' })

    const props = await getProps(client, `/productions?author=${author.slug}`)
    assert.sameMembers(titles(props.results), ['DeLui', 'CoEcrite'])
    assert.equal(props.pagination.total, 2)
    assert.deepEqual(props.activeFilters.author, [author.slug])
  })

  test('deux slugs : OU entre auteurs, sans doublon', async ({ client, assert }) => {
    const a = await createAuthor()
    const b = await createAuthor()
    const c = await createAuthor()
    await link(await createProduction({ title: 'A' }), a)
    await link(await createProduction({ title: 'B' }), b)
    await link(await createProduction({ title: 'AB' }), a, b)
    await link(await createProduction({ title: 'C' }), c)

    const props = await getProps(client, `/productions?author=${a.slug}&author=${b.slug}`)
    assert.sameMembers(titles(props.results), ['A', 'B', 'AB'])
    assert.equal(props.pagination.total, 3)
    assert.deepEqual(props.activeFilters.author, [a.slug, b.slug])
  })

  test('ET avec une autre dimension (catégorie) et avec la recherche', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'Topologie livre', category: 'Livre' }), author)
    await link(await createProduction({ title: 'Cuisine article', category: 'Article' }), author)
    await createProduction({ title: 'Topologie autre', category: 'Livre' })

    const byCategory = await getProps(client, `/productions?author=${author.slug}&category=Livre`)
    assert.deepEqual(titles(byCategory.results), ['Topologie livre'])

    const byQuery = await getProps(client, `/productions?author=${author.slug}&q=topologie`)
    assert.deepEqual(titles(byQuery.results), ['Topologie livre'])
  })

  test('résultats approchants : le filtre auteur est conservé', async ({ client, assert }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'Topologie quantique' }), author)
    await createProduction({ title: 'Topologie classique' })

    const props = await getProps(client, `/productions?author=${author.slug}&q=topologgie`)
    assert.isTrue(props.approximate)
    assert.deepEqual(titles(props.results), ['Topologie quantique'])
  })

  test('slug non public (sans consentement) ignoré comme un slug inconnu, sans fuite', async ({
    client,
    assert,
  }) => {
    const hidden = await createAuthor({ consent: false })
    await link(await createProduction({ title: 'Liee' }), hidden)
    await createProduction({ title: 'Autre' })

    const response = await client.get(`/productions?author=${hidden.slug}`)
    response.assertStatus(200)
    const props = extractProps(response.text())
    const unknown = await getProps(client, '/productions?author=slug-qui-n-existe-pas')

    assert.sameMembers(titles(props.results), ['Liee', 'Autre'])
    assert.deepEqual(props.activeFilters.author, [])
    assert.deepEqual(props.activeFilters, unknown.activeFilters)
    assert.deepEqual(props.facets.author, unknown.facets.author)
    assert.deepEqual(props.pagination, unknown.pagination)
    // Le slug n'apparaît que dans l'URL demandée (`url` de la page), jamais comme lien de byline.
    assert.notInclude(response.text(), `/authors/${hidden.slug}`)
  })

  test('slug d’un profil public sans production publiée ignoré', async ({ client, assert }) => {
    const draftOnly = await createAuthor()
    await link(await createProduction({ title: 'Brouillon', status: 'draft' }), draftOnly)
    await createProduction({ title: 'Publiee' })

    const props = await getProps(client, `/productions?author=${draftOnly.slug}`)
    assert.deepEqual(titles(props.results), ['Publiee'])
    assert.deepEqual(props.activeFilters.author, [])
  })

  test('slug valide + slug inconnu : seul le slug valide filtre', async ({ client, assert }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'DeLui' }), author)
    await createProduction({ title: 'Autre' })

    const props = await getProps(
      client,
      `/productions?author=inconnu&author=${author.slug}&author=${author.slug}`
    )
    assert.deepEqual(titles(props.results), ['DeLui'])
    assert.deepEqual(props.activeFilters.author, [author.slug])
  })

  test('ancien lien par nom libre (jsonb) : 200, listing non filtré par auteur', async ({
    client,
    assert,
  }) => {
    await createProduction({ title: 'AvecNom', authors: ['Nom Ancienlien'] })
    await createProduction({ title: 'SansNom', authors: ['Personne'] })

    const props = await getProps(client, '/productions?author=Nom%20Ancienlien')
    assert.sameMembers(titles(props.results), ['AvecNom', 'SansNom'])
    assert.deepEqual(props.activeFilters.author, [])
  })

  test('plus de 20 valeurs inconnues, valeur vide ou indexée : 200, listing non filtré', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'Liee' }), author)
    await createProduction({ title: 'Libre' })

    const many = Array.from({ length: 21 }, (_, i) => `author=slug-${i}`).join('&')
    for (const query of [many, 'author=', 'author=%20', 'author[a]=x', 'author[]=x&author[]=y']) {
      const props = await getProps(client, `/productions?${query}`)
      assert.sameMembers(titles(props.results), ['Liee', 'Libre'], query)
      assert.deepEqual(props.activeFilters.author, [], query)
    }
  })

  test('21 auteurs visibles demandés : les 20 premiers filtrent (qs arrayLimit)', async ({
    client,
    assert,
  }) => {
    const authors: Author[] = []
    for (let i = 0; i < 21; i++) {
      const author = await createAuthor()
      await link(await createProduction({ title: `Oeuvre ${i}` }), author)
      authors.push(author)
    }

    const query = authors.map((author) => `author=${author.slug}`).join('&')
    const props = await getProps(client, `/productions?${query}`)
    assert.deepEqual(
      props.activeFilters.author,
      authors.slice(0, 20).map((author) => author.slug)
    )
    assert.equal(props.pagination.total, 20)
    assert.notInclude(titles(props.results), 'Oeuvre 20')
  })

  test('indexé author[x]=<slug> visible : retenu (valeurs de l’objet qs)', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'Liee' }), author)
    await createProduction({ title: 'Libre' })

    const props = await getProps(client, `/productions?author[x]=${author.slug}`)
    assert.deepEqual(titles(props.results), ['Liee'])
    assert.deepEqual(props.activeFilters.author, [author.slug])
  })

  test('approchants, étape OU relâché : le filtre auteur est conservé', async ({
    client,
    assert,
  }) => {
    const author = await createAuthor()
    await link(await createProduction({ title: 'Topologie quantique' }), author)
    await createProduction({ title: 'Topologie classique' })

    // « zzzmotabsent » rend la recherche exacte (ET) vide ; « topologie » passe au OU relâché.
    const props = await getProps(
      client,
      `/productions?author=${author.slug}&q=topologie zzzmotabsent`
    )
    assert.isTrue(props.approximate)
    assert.deepEqual(titles(props.results), ['Topologie quantique'])
  })

  test('facette : auteurs visibles seulement, { value: slug, label: "Prénom NOM" }, triés', async ({
    client,
    assert,
  }) => {
    // Noms de même casse, sans accent : ordre identique quelle que soit la collation.
    const zed = await createAuthor({ firstNames: 'Awa', lastNames: 'Zedexemple' })
    const abel = await createAuthor({ firstNames: 'Marc', lastNames: 'Abelexemple' })
    const abel2 = await createAuthor({ firstNames: 'Ana', lastNames: 'Abelexemple' })
    const noConsent = await createAuthor({ consent: false, lastNames: 'Sansconsentement' })
    const draftOnly = await createAuthor({ lastNames: 'Brouillonseul' })
    await createAuthor({ lastNames: 'Sansproduction' })
    await link(await createProduction(), zed, abel)
    await link(await createProduction(), abel2, noConsent)
    await link(await createProduction({ status: 'draft' }), draftOnly)
    await createProduction({ authors: ['Nom Libre'] })

    const response = await client.get('/productions')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.deepEqual(props.facets.author, [
      { value: abel2.slug, label: 'Ana ABELEXEMPLE' },
      { value: abel.slug, label: 'Marc ABELEXEMPLE' },
      { value: zed.slug, label: 'Awa ZEDEXEMPLE' },
    ])
    assert.notInclude(response.text(), noConsent.slug)
    assert.notInclude(response.text(), draftOnly.slug)
  })

  test('pagination : page 2 conserve le filtre auteur', async ({ client, assert }) => {
    const author = await createAuthor()
    for (let i = 0; i < 21; i++) await link(await createProduction(), author)
    await createProduction({ title: 'HorsFiltre' })

    const props = await getProps(client, `/productions?author=${author.slug}&page=2`)
    assert.lengthOf(props.results, 1)
    assert.equal(props.pagination.total, 21)
    assert.equal(props.pagination.currentPage, 2)
    assert.deepEqual(props.activeFilters.author, [author.slug])
  })
})
