import { test } from '@japa/runner'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import type { ApiClient } from '@japa/api-client'
import Author from '#models/author'
import Production from '#models/production'
import SitemapService from '#services/sitemap_service'

// Story 13.3 — plan du site : inclusions (pages fixes, productions publiées, profils visibles),
// exclusions (brouillon, retirée, auteur sans consentement ou sans production publiée, admin),
// format et en-têtes. Noms fictifs (dépôt public) ; lignes annulées par la transaction globale.

const APP_URL = String(env.get('APP_URL')).replace(/\/+$/, '')

/** Corps texte d'une réponse GET. */
async function fetchText(client: ApiClient, path: string): Promise<string> {
  const response = await client.get(path)
  return response.text()
}

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: string }

/** Requête brute vers le serveur de test (même processus) : en-têtes exacts, aucun cookie. */
function rawRequest(path: string, method = 'GET'): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: process.env.HOST || 'localhost', port: Number(process.env.PORT), path, method },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        )
        res.on('error', reject)
      }
    )
    req.setTimeout(5000, () => req.destroy(new Error(`timeout on ${path}`)))
    req.on('error', reject)
    req.end()
  })
}

let sequence = 0

/** Lettres seulement : un nom unique donne un slug unique. */
function uniqueName(prefix: string): string {
  sequence++
  const letters = `${Date.now()}${sequence}`.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  return `${prefix}${letters}`
}

async function createProduction(
  status: 'draft' | 'published' | 'unpublished',
  overrides: Partial<Production> = {}
): Promise<Production> {
  return Production.create({
    title: uniqueName('Plansite'),
    summary: 'Résumé de test.',
    authorNames: [],
    tags: ['test'],
    category: 'article',
    domain: 'mathematics',
    subdomain: [],
    language: 'fr',
    licenseStatus: 'member',
    status,
    antaPublishedAt: status === 'draft' ? null : DateTime.now(),
    createdById: null,
    ...overrides,
  })
}

async function createAuthor(consent: boolean): Promise<Author> {
  return Author.create({
    firstNames: 'Awa',
    lastNames: uniqueName('Plansite'),
    consentConfirmedAt: consent ? DateTime.now() : null,
  })
}

async function link(production: Production, author: Author, position = 1) {
  await db
    .table('production_authors')
    .insert({ production_id: production.id, author_id: author.id, position })
}

async function setUpdatedAt(table: 'productions' | 'authors', id: string, iso: string) {
  await db
    .from(table)
    .where('id', id)
    .update({ updated_at: DateTime.fromISO(iso).toJSDate() })
}

/** `<url>` blocks by `loc` → `lastmod` (null when absent). */
function urls(xml: string): Map<string, string | null> {
  const map = new Map<string, string | null>()
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]*)<\/loc>/)![1]
    const lastmod = block.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? null
    map.set(loc, lastmod)
  }
  return map
}

test.group('Public | sitemap.xml (Story 13.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('liste en URL absolues l’accueil, /productions, /authors, les productions publiées et les profils visibles', async ({
    client,
    assert,
  }) => {
    const published = await createProduction('published')
    const visible = await createAuthor(true)
    await link(published, visible)

    const response = await client.get('/sitemap.xml')
    response.assertStatus(200)
    assert.include(response.header('content-type') ?? '', 'application/xml')
    const body = response.text()
    assert.isTrue(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
    assert.include(body, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

    const locs = urls(body)
    for (const path of ['/', '/productions', '/authors']) {
      assert.isTrue(locs.has(`${APP_URL}${path}`), `page fixe ${path}`)
    }
    assert.isTrue(locs.has(`${APP_URL}/productions/${published.slug}`))
    assert.isTrue(locs.has(`${APP_URL}/authors/${visible.slug}`))
    for (const loc of locs.keys()) assert.isTrue(loc.startsWith(`${APP_URL}/`), loc)
  })

  test('exclut brouillons, productions retirées, profils non publics et URL du panel admin', async ({
    client,
    assert,
  }) => {
    const published = await createProduction('published')
    const draft = await createProduction('draft')
    const unpublished = await createProduction('unpublished')
    const visible = await createAuthor(true)
    await link(published, visible)
    // Consentement mais aucune production publiée (brouillon et retirée seulement).
    const withoutPublished = await createAuthor(true)
    await link(draft, withoutPublished)
    await link(unpublished, withoutPublished)
    // Production publiée mais aucun consentement.
    const withoutConsent = await createAuthor(false)
    await link(published, withoutConsent, 2)
    // Consentement, aucune production du tout.
    const alone = await createAuthor(true)

    const body = await fetchText(client, '/sitemap.xml')
    const locs = [...urls(body).keys()]
    assert.include(locs, `${APP_URL}/productions/${published.slug}`)
    assert.include(locs, `${APP_URL}/authors/${visible.slug}`)
    for (const hidden of [draft, unpublished]) {
      assert.notInclude(body, `/productions/${hidden.slug}<`)
    }
    for (const hidden of [withoutPublished, withoutConsent, alone]) {
      assert.notInclude(body, `/authors/${hidden.slug}<`)
    }
    assert.notInclude(body, '/admin')
    for (const technical of [
      '/media',
      '/health',
      '/stats',
      '/download',
      '/suggestions',
      '/login',
    ]) {
      assert.notInclude(body, technical)
    }
    // Chaque URL listée répond 200 (rien de ce qui est en 404 sur le site n'est listé).
    for (const loc of locs) {
      const response = await client.get(loc.slice(APP_URL.length))
      assert.equal(response.status(), 200, loc)
    }
  })

  test('lastmod W3C (UTC) : production, profil (plus récent de la fiche et de ses productions publiées), pages fixes', async ({
    client,
    assert,
  }) => {
    const older = await createProduction('published')
    const newer = await createProduction('published')
    const draft = await createProduction('draft')
    const author = await createAuthor(true)
    await link(older, author)
    await link(draft, author, 2)
    await setUpdatedAt('productions', older.id, '2026-03-01T08:00:00Z')
    await setUpdatedAt('productions', newer.id, '2026-04-02T09:30:15.250Z')
    // Le brouillon (plus récent) n'entre pas dans le lastmod du profil.
    await setUpdatedAt('productions', draft.id, '2026-09-09T00:00:00Z')
    await setUpdatedAt('authors', author.id, '2026-02-01T00:00:00+02:00')

    const locs = urls(await fetchText(client, '/sitemap.xml'))
    assert.equal(locs.get(`${APP_URL}/productions/${older.slug}`), '2026-03-01T08:00:00Z')
    assert.equal(locs.get(`${APP_URL}/productions/${newer.slug}`), '2026-04-02T09:30:15Z')
    assert.equal(locs.get(`${APP_URL}/authors/${author.slug}`), '2026-03-01T08:00:00Z')

    await setUpdatedAt('authors', author.id, '2026-05-05T05:05:05Z')
    const after = urls(await fetchText(client, '/sitemap.xml'))
    assert.equal(after.get(`${APP_URL}/authors/${author.slug}`), '2026-05-05T05:05:05Z')
    assert.equal(after.get(`${APP_URL}/authors`), '2026-05-05T05:05:05Z')
    // Accueil et listing : production publiée la plus récente du jeu (d'autres lignes de la base
    // de test peuvent être plus récentes) — au moins aussi récente que `newer`.
    for (const path of ['/', '/productions']) {
      const lastmod = after.get(`${APP_URL}${path}`)
      assert.match(lastmod ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      assert.isTrue((lastmod ?? '') >= '2026-04-02T09:30:15Z', path)
    }
  })

  test('slugs encodés et XML échappé', async ({ client, assert }) => {
    const odd = await createProduction('published', { slug: `plan-site-a&b<c>'${Date.now()}` })
    const body = await fetchText(client, '/sitemap.xml')
    const expected = `${APP_URL}/productions/${encodeURIComponent(odd.slug)}`
    assert.include(expected, `a%26b%3Cc%3E'`)
    assert.include(body, `<loc>${expected.replace(/'/g, '&apos;')}</loc>`)
    assert.notInclude(body, 'a&b')
    assert.notInclude(body, '<c>')
  })

  test('limite de 50 000 URL : troncature dans l’ordre pages fixes, productions, profils', async ({
    assert,
  }) => {
    const production = await createProduction('published')
    const author = await createAuthor(true)
    await link(production, author)

    const all = await SitemapService.entries(APP_URL)
    assert.isAtMost(all.length, 50_000)
    assert.deepEqual(
      all.slice(0, 3).map((e) => e.loc),
      [`${APP_URL}/`, `${APP_URL}/productions`, `${APP_URL}/authors`]
    )
    const truncated = await SitemapService.entries(APP_URL, all.length - 1)
    assert.lengthOf(truncated, all.length - 1)
    assert.deepEqual(
      truncated.map((e) => e.loc),
      all.slice(0, -1).map((e) => e.loc)
    )
    // Les profils viennent après toutes les productions.
    const lastProduction = all.findLastIndex((e) => e.loc.includes('/productions/'))
    const firstAuthor = all.findIndex((e) => e.loc.includes('/authors/'))
    assert.isBelow(lastProduction, firstAuthor)
  })

  test('servi sans session ni cookies, cachable publiquement ; HEAD et barre oblique finale', async ({
    assert,
  }) => {
    await createProduction('published')
    for (const path of ['/sitemap.xml', '/sitemap.xml/', '/sitemap.xml?x=1']) {
      const response = await rawRequest(path)
      assert.equal(response.status, 200, path)
      assert.equal(response.headers['content-type'], 'application/xml; charset=utf-8')
      assert.equal(response.headers['cache-control'], 'public, max-age=3600')
      assert.equal(response.headers['x-content-type-options'], 'nosniff')
      assert.isUndefined(response.headers['set-cookie'], path)
      assert.include(response.body, '</urlset>')
    }
    const head = await rawRequest('/sitemap.xml', 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.body, '')
    assert.isUndefined(head.headers['set-cookie'])

    const post = await rawRequest('/sitemap.xml', 'POST')
    assert.notEqual(post.status, 200)
  })
})
