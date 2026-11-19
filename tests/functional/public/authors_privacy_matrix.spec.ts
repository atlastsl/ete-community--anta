import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import sharp from 'sharp'
import AdminUser from '#models/admin_user'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import ProductionLink from '#models/production_link'
import AuthorService from '#services/author_service'
import ProductionAuthorService from '#services/production_author_service'

// Story 10.8 — matrice de confidentialité des auteurs sur TOUTES les surfaces publiques à la
// fois (profil, liste, facettes, filtre, bylines, /media, <head>), puis transitions pilotées par
// les vraies routes admin. Les specs 10.1–10.7 couvrent chaque surface isolément ; celle-ci
// vérifie qu'un même état est appliqué partout. Noms fictifs uniquement (dépôt public) ;
// lignes annulées par la transaction globale, disque R2 factice restauré après chaque test.

const TOKEN = 'AbCdEfGhIjKlMnOp_-12'
const APP_URL = String(env.get('APP_URL')).replace(/\/$/, '')

function extractPage(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
}

async function getPage(client: ApiClient, url: string) {
  const response = await client.get(url)
  response.assertStatus(200)
  const body = response.text()
  return { body, props: extractPage(body)!.props }
}

async function statusOf(client: ApiClient, url: string): Promise<number> {
  const response = await client.get(url)
  return response.status()
}

function headOf(html: string): string {
  return html.split('</head>')[0]
}

function metaContent(head: string, attr: 'property' | 'name', key: string): string | null {
  const match = head.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))
  return match ? match[1] : null
}

let sequence = 0

/** Letters only: the slug is derived from the name, a unique name gives a unique slug. */
function uniqueName(prefix: string): string {
  sequence++
  const letters = `${Date.now()}${sequence}`.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  return `${prefix}${letters}`
}

async function createAuthor(options: { consent: boolean; photo: boolean }): Promise<Author> {
  const author = await Author.create({
    firstNames: 'Jeanne',
    lastNames: uniqueName('Matrice'),
    consentConfirmedAt: options.consent ? DateTime.now() : null,
  })
  await AuthorAffiliation.create({
    authorId: author.id,
    position: 1,
    institution: 'Université Exemple',
    department: null,
  })
  if (options.photo) {
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
    await putVariants(author.photoKey)
  }
  return author
}

async function putVariants(prefix: string) {
  for (const key of AuthorService.photoKeys(prefix)) {
    await drive.use('r2').put(key, Buffer.from(`bytes of ${key}`), {
      contentType: key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
    })
  }
}

/** A production complete enough to be republished from the admin (fields + external link). */
async function createProduction(status: 'draft' | 'published'): Promise<Production> {
  const production = await Production.create({
    title: uniqueName('Oeuvrematrice'),
    summary: 'Résumé de test.',
    authorNames: [],
    tags: ['test'],
    category: 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status,
    workPublishedAt: DateTime.fromISO('2024-03-15'),
    antaPublishedAt: status === 'published' ? DateTime.now() : null,
    createdById: null,
  })
  await ProductionLink.create({
    productionId: production.id,
    url: 'https://example.com',
    linkType: 'simple',
    label: null,
  })
  return production
}

async function link(production: Production, author: Author) {
  await db
    .table('production_authors')
    .insert({ production_id: production.id, author_id: author.id, position: 1 })
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
}

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

type Surfaces = {
  profileStatus: number
  profilePhotoBase: string | null
  profileOgImage: string | null
  inAuthorsList: boolean
  inFacet: boolean
  filterApplied: boolean
  /** Slug of the author in the byline of the host production (detail, listing, home). */
  bylineSlugs: (string | null)[]
  mediaStatus: number | null
  /** Public bodies (outside the profile and the `author=` URL) quoting the slug, id or photo key. */
  leaks: string[]
}

/**
 * Every public surface for one author, in one pass. `host` is a published production signed by
 * the author (bylines), when there is one.
 */
async function surfacesOf(
  client: ApiClient,
  author: Author,
  host: Production | null
): Promise<Surfaces> {
  await author.refresh()
  const bodies: Record<string, string> = {}

  const profile = await client.get(`/authors/${author.slug}`)
  const profileProps = profile.status() === 200 ? extractPage(profile.text())!.props : null
  const profileHead = profile.status() === 200 ? headOf(profile.text()) : ''

  const list = await getPage(client, `/authors?q=${encodeURIComponent(author.lastNames)}`)
  bodies['/authors?q='] = list.body
  const fullList = await getPage(client, '/authors')
  bodies['/authors'] = fullList.body

  const listing = await getPage(client, '/productions')
  bodies['/productions'] = listing.body
  const filtered = await getPage(client, `/productions?author=${author.slug}`)

  const home = await getPage(client, '/')
  bodies['/'] = home.body

  const bylineSlugs: (string | null)[] = []
  if (host) {
    const detail = await getPage(client, `/productions/${host.slug}`)
    bodies['/productions/:slug'] = detail.body
    bylineSlugs.push(detail.props.production.authors[0].slug)
    const search = await getPage(client, `/productions?q=${host.title}`)
    bodies['/productions?q='] = search.body
    const card = search.props.results.find((r: { id: string }) => r.id === host.id)
    bylineSlugs.push(card.authors[0].slug)
    const homeCard = [...home.props.recent, ...home.props.mostViewed].find(
      (r: { id: string }) => r.id === host.id
    )
    bylineSlugs.push(homeCard.authors[0].slug)
  }

  let mediaStatus: number | null = null
  if (author.photoKey) {
    const media = await client.get(`/media/${author.photoKey}/w128.webp`)
    mediaStatus = media.status()
  }

  const needles = [author.slug, author.id, TOKEN]
  const leaks: string[] = []
  for (const [url, body] of Object.entries(bodies)) {
    for (const needle of needles) if (body.includes(needle)) leaks.push(`${url}:${needle}`)
  }

  return {
    profileStatus: profile.status(),
    profilePhotoBase: profileProps ? profileProps.author.photoBase : null,
    profileOgImage: profileProps ? metaContent(profileHead, 'property', 'og:image') : null,
    inAuthorsList: list.props.authors.some((a: { slug: string }) => a.slug === author.slug),
    inFacet: listing.props.facets.author.some((f: { value: string }) => f.value === author.slug),
    filterApplied:
      JSON.stringify(filtered.props.activeFilters.author) === JSON.stringify([author.slug]),
    bylineSlugs,
    mediaStatus,
    leaks,
  }
}

/** Expected exposure of a visible author (consent + published production). */
function visibleSurfaces(author: Author, withPhoto: boolean, host: boolean) {
  const base = `/media/authors/${author.id}/${TOKEN}`
  return {
    profileStatus: 200,
    profilePhotoBase: withPhoto ? base : null,
    profileOgImage: withPhoto ? `${APP_URL}${base}/og.jpg` : null,
    inAuthorsList: true,
    inFacet: true,
    filterApplied: true,
    bylineSlugs: host ? [author.slug, author.slug, author.slug] : [],
    mediaStatus: withPhoto ? 200 : null,
  }
}

function hiddenSurfaces(consent: boolean, withPhoto: boolean, host: boolean) {
  return {
    profileStatus: 404,
    profilePhotoBase: null,
    profileOgImage: null,
    inAuthorsList: false,
    inFacet: false,
    filterApplied: false,
    bylineSlugs: host ? [null, null, null] : [],
    // Story 10.2: /media serves a public (consented) profile's current key, published
    // production or not; the key itself is never exposed while the profile is not visible.
    mediaStatus: withPhoto ? (consent ? 200 : 404) : null,
    leaks: [],
  }
}

function withoutLeaks(surfaces: Surfaces): Omit<Surfaces, 'leaks'> {
  const rest: Partial<Surfaces> = { ...surfaces }
  delete rest.leaks
  return rest as Omit<Surfaces, 'leaks'>
}

test.group('Public | matrice de confidentialité des auteurs (Story 10.8)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    drive.fake('r2')
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  const productionStates = ['published', 'draft', 'none'] as const
  for (const consent of [true, false]) {
    for (const productionState of productionStates) {
      for (const photo of [true, false]) {
        const label = `consentement ${consent ? 'oui' : 'non'} × production ${productionState} × photo ${photo ? 'oui' : 'non'}`
        const visible = consent && productionState === 'published'
        test(`${label} → ${visible ? 'visible partout' : 'absent partout'}`, async ({
          client,
          assert,
        }) => {
          const author = await createAuthor({ consent, photo })
          let host: Production | null = null
          if (productionState !== 'none') {
            const production = await createProduction(productionState)
            await link(production, author)
            if (productionState === 'published') host = production
          }

          const surfaces = await surfacesOf(client, author, host)
          if (visible) {
            assert.deepEqual(withoutLeaks(surfaces), visibleSurfaces(author, photo, true))
          } else {
            assert.deepEqual(surfaces, hiddenSurfaces(consent, photo, host !== null))
          }
        })
      }
    }
  }
})

const TMP = join(tmpdir(), 'anta-test-privacy-matrix')
mkdirSync(TMP, { recursive: true })

async function makeJpeg(name: string): Promise<string> {
  const path = join(TMP, name)
  const buffer = await sharp({
    create: { width: 480, height: 480, channels: 3, background: { r: 40, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer()
  writeFileSync(path, buffer)
  return path
}

test.group('Public | transitions pilotées par l’admin (Story 10.8)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    drive.fake('r2')
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('retrait puis reconfirmation du consentement : disparition puis retour partout', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor({ consent: true, photo: true })
    const production = await createProduction('published')
    await link(production, author)
    assert.deepEqual(
      withoutLeaks(await surfacesOf(client, author, production)),
      visibleSurfaces(author, true, true)
    )

    const withdraw = await client
      .post(`/admin/authors/${author.id}/withdraw-consent`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    withdraw.assertStatus(302)
    assert.deepEqual(
      await surfacesOf(client, author, production),
      hiddenSurfaces(false, true, true)
    )

    // L'admin voit toujours la fiche, non publique, et peut l'ouvrir.
    const adminList = await client
      .get(`/admin/authors?q=${encodeURIComponent(author.lastNames)}`)
      .loginAs(admin)
    adminList.assertStatus(200)
    const row = extractPage(adminList.text())!.props.authors.find(
      (a: { lastNames: string }) => a.lastNames === author.lastNames
    )
    assert.isFalse(row.isPublic)
    const edit = await client.get(`/admin/authors/${author.id}/edit`).loginAs(admin)
    edit.assertStatus(200)

    const confirm = await client
      .post(`/admin/authors/${author.id}/confirm-consent`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    confirm.assertStatus(302)
    assert.deepEqual(
      withoutLeaks(await surfacesOf(client, author, production)),
      visibleSurfaces(author, true, true)
    )
  })

  test('dépublication puis republication de la dernière production : idem', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor({ consent: true, photo: false })
    const production = await createProduction('published')
    await link(production, author)

    const unpublish = await client
      .post(`/admin/productions/${production.id}/unpublish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    unpublish.assertStatus(302)
    await production.refresh()
    assert.equal(production.status, 'draft')
    // Plus aucune production publiée : la production elle-même n'est plus une surface.
    assert.deepEqual(await surfacesOf(client, author, null), hiddenSurfaces(true, false, false))
    assert.equal(await statusOf(client, `/productions/${production.slug}`), 404)

    const publish = await client
      .post(`/admin/productions/${production.id}/publish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    publish.assertStatus(302)
    await production.refresh()
    assert.equal(production.status, 'published')
    assert.deepEqual(
      withoutLeaks(await surfacesOf(client, author, production)),
      visibleSurfaces(author, false, true)
    )
  })

  test('photo remplacée puis retirée depuis l’admin : ancienne clé 404, profil à jour', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const author = await createAuthor({ consent: true, photo: true })
    await link(await createProduction('published'), author)
    const oldPrefix = author.photoKey!

    const replace = await client
      .put(`/admin/authors/${author.id}`)
      .field('lastNames', author.lastNames)
      .field('firstNames', 'Jeanne')
      .field('affiliations[0][institution]', 'Université Exemple')
      .file('photo', await makeJpeg('replace.jpg'))
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    replace.assertStatus(302)
    await author.refresh()
    const newPrefix = author.photoKey!
    assert.notEqual(newPrefix, oldPrefix)

    // Suppression R2 de l'ancien préfixe best-effort : même si elle échoue, la clé est refusée.
    await putVariants(oldPrefix)
    assert.equal(await statusOf(client, `/media/${oldPrefix}/w128.webp`), 404)
    for (const variant of ['w128.webp', 'w384.webp', 'og.jpg']) {
      assert.equal(await statusOf(client, `/media/${newPrefix}/${variant}`), 200)
    }
    let profile = await client.get(`/authors/${author.slug}`)
    assert.equal(extractPage(profile.text())!.props.author.photoBase, `/media/${newPrefix}`)
    assert.notInclude(profile.text(), oldPrefix)
    assert.equal(
      metaContent(headOf(profile.text()), 'property', 'og:image'),
      `${APP_URL}/media/${newPrefix}/og.jpg`
    )
    const list = await getPage(client, `/authors?q=${encodeURIComponent(author.lastNames)}`)
    assert.equal(list.props.authors[0].photoBase, `/media/${newPrefix}`)

    const remove = await client
      .put(`/admin/authors/${author.id}`)
      .json({
        lastNames: author.lastNames,
        firstNames: 'Jeanne',
        affiliations: [{ institution: 'Université Exemple' }],
        removePhoto: '1',
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    remove.assertStatus(302)
    await author.refresh()
    assert.isNull(author.photoKey)
    assert.equal(await statusOf(client, `/media/${newPrefix}/w128.webp`), 404)
    profile = await client.get(`/authors/${author.slug}`)
    assert.isNull(extractPage(profile.text())!.props.author.photoBase)
    assert.isNull(metaContent(headOf(profile.text()), 'property', 'og:image'))
    assert.equal(metaContent(headOf(profile.text()), 'name', 'twitter:card'), 'summary')
  })

  test('renommage depuis l’admin : slug figé, nouveau nom partout', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const author = await createAuthor({ consent: true, photo: false })
    const production = await createProduction('published')
    await link(production, author)
    const slug = author.slug
    const renamed = uniqueName('Renommee')

    const update = await client
      .put(`/admin/authors/${author.id}`)
      .json({
        lastNames: renamed,
        firstNames: 'Awa',
        affiliations: [{ institution: 'Université Exemple' }],
      })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    update.assertStatus(302)
    await author.refresh()
    assert.equal(author.slug, slug)

    const fullName = `Awa ${renamed.toUpperCase()}`
    const profile = await getPage(client, `/authors/${slug}`)
    assert.equal(profile.props.author.lastNames, renamed)
    assert.include(headOf(profile.body), `${fullName} — Anta`)
    const detail = await getPage(client, `/productions/${production.slug}`)
    assert.deepEqual(detail.props.production.authors, [{ name: fullName, slug }])
    const list = await getPage(client, `/authors?q=${renamed}`)
    assert.deepEqual(
      list.props.authors.map((a: { slug: string }) => a.slug),
      [slug]
    )
    const listing = await getPage(client, '/productions')
    assert.deepInclude(listing.props.facets.author, { value: slug, label: fullName })
  })
})
