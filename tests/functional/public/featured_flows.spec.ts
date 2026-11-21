import { test } from '@japa/runner'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import sharp from 'sharp'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import Author from '#models/author'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import PosterService from '#services/poster_service'
import ProductionAuthorService from '#services/production_author_service'
import ThumbnailService from '#services/thumbnail_service'
import { makeMp4 } from '../../video_fixtures.js'

// Story 11.7 — cohérence de la bannière à la une et de ses images sur toutes les surfaces.
// Les specs 11.1–11.6 vérifient chacune une route (souvent avec des clés factices posées en
// base) ; ici, les transitions passent par les vraies routes admin (image sharp, vidéo ffmpeg)
// et chaque étape est relue partout : prop `featured` de l'accueil, `/media` (les 3 variantes de
// l'image affichée), page « À la une », journal, cartes et détail (D37). Données fictives.

const YEAR = 'public, max-age=31536000, immutable'
const VARIANTS = ['w400.webp', 'w800.webp', 'w1600.webp']

let counter = 0
let imageDir: string

type HttpClient = any
type BannerItem = { id: string; imageUrl: string; title: string }

async function createAdmin(): Promise<AdminUser> {
  return AdminUser.create({
    email: `featured-flow-${Date.now()}-${counter++}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: 'super_admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

/**
 * Production brouillon complète (pivot vers un auteur consentant, donc profil public dès la
 * publication) ; `withPdf` ajoute le fichier exigé par la licence `member`.
 */
async function createDraft(title: string, withPdf = true): Promise<Production> {
  const production = await Production.create({
    title,
    summary: 'Résumé fictif.',
    authorNames: [],
    tags: ['essai'],
    category: 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: 'fr',
    publicationCountry: 'Sénégal',
    licenseStatus: 'member',
    status: 'draft',
    workPublishedAt: DateTime.fromISO('2024-03-15'),
    createdById: null,
  })
  const author = await Author.create({
    firstNames: 'Awa',
    lastNames: `Parcoursfictif${counter++}`,
    consentConfirmedAt: DateTime.now(),
  })
  await db
    .table('production_authors')
    .insert({ production_id: production.id, author_id: author.id, position: 1 })
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
  if (withPdf) {
    await ProductionFile.create({
      productionId: production.id,
      fileKey: `productions/${production.id}/document.pdf`,
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
      storageProvider: 'r2',
    })
  }
  return production
}

async function makeJpeg(color: { r: number; g: number; b: number }): Promise<string> {
  const path = join(imageDir, `image-${counter++}.jpg`)
  const buffer = await sharp({
    create: { width: 640, height: 480, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer()
  writeFileSync(path, buffer)
  return path
}

function flashedErrors(flash: Record<string, any>): Record<string, string> {
  const raw = (flash.errors ?? flash.inputErrorsBag ?? {}) as Record<string, string | string[]>
  return Object.fromEntries(
    Object.entries(raw).map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
  )
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) throw new Error('data-page absent')
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).props
}

async function pageHtml(client: HttpClient, url: string, admin?: AdminUser): Promise<string> {
  const request = client.get(url)
  if (admin) request.loginAs(admin)
  const response = await request
  response.assertStatus(200)
  return response.text()
}

async function pageProps(client: HttpClient, url: string, admin?: AdminUser) {
  return extractProps(await pageHtml(client, url, admin))
}

async function banner(client: HttpClient): Promise<BannerItem[]> {
  const props = await pageProps(client, '/')
  return props.featured
}

async function bannerIds(client: HttpClient): Promise<string[]> {
  const items = await banner(client)
  return items.map((item) => item.id)
}

async function storedSelection(): Promise<string[]> {
  const rows = await db.from('featured_productions').orderBy('position', 'asc')
  return rows.map((row: { production_id: string }) => row.production_id)
}

async function adminSelection(client: HttpClient, admin: AdminUser) {
  const props = await pageProps(client, '/admin/featured', admin)
  return props.selection as {
    id: string
    imageState: string
    requiresThumbnail: boolean
    unavailable: boolean
  }[]
}

/** Each variant of an image base (`/media/<prefix>`) is served: 200, WebP, one-year cache. */
async function assertServed(client: HttpClient, assert: any, imageUrl: string) {
  assert.match(imageUrl, /^\/media\/(thumbnails|posters)\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{20}$/)
  for (const variant of VARIANTS) {
    const response = await client.get(`${imageUrl}/${variant}`)
    assert.equal(response.status(), 200, `${imageUrl}/${variant}`)
    response.assertHeader('content-type', 'image/webp')
    response.assertHeader('cache-control', YEAR)
  }
}

/**
 * Refused by the rule, not by a missing object (review lesson of 10.8): the variants are
 * written back to the fake disk before each request.
 */
async function assertRefused(client: HttpClient, assert: any, prefix: string) {
  const disk = drive.use('r2')
  for (const variant of VARIANTS) {
    await disk.put(`${prefix}/${variant}`, Buffer.from('bytes'), { contentType: 'image/webp' })
  }
  for (const variant of VARIANTS) {
    const response = await client.get(`/media/${prefix}/${variant}`)
    assert.equal(response.status(), 404, `/media/${prefix}/${variant}`)
    response.assertHeader('cache-control', 'no-store')
  }
}

/** Without the `featured` prop: every other piece of the home page (blocks, categories…). */
function homeWithoutBanner(props: Record<string, unknown>): string {
  return JSON.stringify({ ...props, featured: undefined })
}

/**
 * D37 for a published production: no thumbnail or poster key in the cards (home blocks,
 * listing, author profile) nor in the detail page (apart from `posterUrl` of the video player,
 * D-11.3-5); no `og:image` / `twitter:image` in the detail page `<head>`.
 */
async function assertD37(client: HttpClient, assert: any, production: Production) {
  await production.refresh()
  await production.load('files')
  const keys = [production.thumbnailKey, ...production.files.map((f) => f.posterKey)].filter(
    (key): key is string => key !== null
  )
  const tokens = keys.map((key) => key.split('/').pop()!)
  const author = await Author.query()
    .whereIn(
      'id',
      db.from('production_authors').where('production_id', production.id).select('author_id')
    )
    .firstOrFail()

  const home = await pageProps(client, '/')
  const listing = await pageProps(client, `/productions?q=${encodeURIComponent(production.title)}`)
  const profile = await pageProps(client, `/authors/${author.slug}`)
  const cards: Record<string, string> = {
    'accueil (hors bannière)': homeWithoutBanner(home),
    'listing': JSON.stringify(listing),
    'profil': JSON.stringify(profile),
  }
  // Present in the home blocks (outside the banner), so the checks below are not vacuous.
  assert.include(cards['accueil (hors bannière)'], production.slug!, 'production dans les blocs')
  assert.include(cards.listing, production.slug!, 'production listée')
  assert.include(cards.profil, production.slug!, 'production sur le profil')
  for (const [surface, json] of Object.entries(cards)) {
    assert.notInclude(json, 'thumbnails/', surface)
    assert.notInclude(json, 'posters/', surface)
    assert.notInclude(json, 'imageUrl', surface)
    for (const token of tokens) assert.notInclude(json, token, surface)
  }

  const detailHtml = await pageHtml(client, `/productions/${production.slug}`)
  const head = detailHtml.slice(0, detailHtml.indexOf('</head>'))
  assert.notInclude(head, 'og:image')
  assert.notInclude(head, 'twitter:image')
  const twitterCard = head.match(/<meta[^>]*twitter:card[^>]*>/)?.[0] ?? ''
  assert.include(twitterCard, 'content="summary"')
  for (const token of tokens) assert.notInclude(head, token)
  const detail = extractProps(detailHtml)
  for (const file of detail.production.files as { id: string; posterUrl?: string | null }[]) {
    // The only image of the detail page: the poster of its own video (player, D-11.3-5).
    const posterKey = production.files.find((f) => f.id === file.id)?.posterKey ?? null
    assert.equal(file.posterUrl, posterKey ? `/media/${posterKey}/w1600.webp` : null)
    delete file.posterUrl
  }
  const detailJson = JSON.stringify(detail)
  assert.notInclude(detailJson, 'thumbnails/', 'détail')
  assert.notInclude(detailJson, 'posters/', 'détail hors posterUrl')
  if (production.thumbnailKey) {
    assert.notInclude(detailHtml, production.thumbnailKey, 'détail')
  }
}

const post = (client: HttpClient, admin: AdminUser, url: string) =>
  client.post(url).loginAs(admin).withCsrfToken().redirects(0)

const destroy = (client: HttpClient, admin: AdminUser, url: string) =>
  client.delete(url).loginAs(admin).withCsrfToken().redirects(0)

const putFeatured = (client: HttpClient, admin: AdminUser, productionIds: string[]) =>
  client
    .put('/admin/featured')
    .header('referer', '/admin/featured')
    .json({ productionIds })
    .loginAs(admin)
    .withCsrfToken()
    .redirects(0)

async function uploadThumbnail(
  client: HttpClient,
  assert: any,
  admin: AdminUser,
  production: Production,
  color = { r: 30, g: 90, b: 160 }
): Promise<string> {
  const response = await client
    .post(`/admin/productions/${production.id}/thumbnail`)
    .header('referer', '/admin/featured')
    .file('thumbnail', await makeJpeg(color))
    .loginAs(admin)
    .withCsrfToken()
    .redirects(0)
  response.assertStatus(302)
  assert.deepEqual(flashedErrors(response.flashMessages()), {})
  await production.refresh()
  assert.isString(production.thumbnailKey)
  return production.thumbnailKey!
}

async function publish(client: HttpClient, assert: any, admin: AdminUser, production: Production) {
  const response = await post(client, admin, `/admin/productions/${production.id}/publish`)
  response.assertStatus(302)
  await production.refresh()
  assert.equal(production.status, 'published')
}

async function logsOf(actionType: string, resourceId?: string) {
  // Millisecond timestamps may tie: id as a stable tie-break; order-sensitive checks compare members.
  const query = AdminActivityLog.query()
    .where('actionType', actionType)
    .orderBy('createdAt', 'asc')
    .orderBy('id', 'asc')
  if (resourceId) query.where('resourceId', resourceId)
  return query
}

function withIsolation(group: any) {
  group.setup(() => {
    imageDir = mkdtempSync(join(tmpdir(), 'anta-featured-flows-'))
    return () => rmSync(imageDir, { recursive: true, force: true })
  })
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })
}

test.group('Featured flows | vignettes par les routes admin (11.7)', (group) => {
  withIsolation(group)

  test('téléversement → une → accueil → remplacement → dépublication → republication → suppression', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdmin()
    const a = await createDraft('Parcours Alpha')
    const b = await createDraft('Parcours Beta')
    const c = await createDraft('Parcours Gamma')
    for (const production of [a, b, c]) await publish(client, assert, admin, production)
    const keyOf = new Map<string, string>()
    for (const production of [a, b, c]) {
      keyOf.set(production.id, await uploadThumbnail(client, assert, admin, production))
    }

    // Publiée avec vignette mais hors de la une : servable (D-11.2-2), exposée nulle part.
    assert.deepEqual(await banner(client), [])
    await assertServed(client, assert, `/media/${keyOf.get(a.id)}`)
    assert.notInclude(await pageHtml(client, '/'), keyOf.get(a.id)!)
    await assertD37(client, assert, a)

    // Mise à la une : bannière ordonnée, chaque image réellement servie, journal.
    let response = await putFeatured(client, admin, [a.id, b.id, c.id])
    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    let items = await banner(client)
    assert.deepEqual(
      items.map((item) => [item.id, item.imageUrl]),
      [a, b, c].map((p) => [p.id, `/media/${keyOf.get(p.id)}`])
    )
    for (const item of items) await assertServed(client, assert, item.imageUrl)
    const updates = await logsOf('featured_update')
    assert.lengthOf(updates, 1)
    assert.equal(updates[0].resourceType, 'featured_selection')
    assert.deepEqual(updates[0].metadata, { before: [], after: [a.id, b.id, c.id] })
    await assertD37(client, assert, a)

    // Remplacement de la vignette de A : la bannière suit, l'ancienne clé est refusée et supprimée.
    const oldA = keyOf.get(a.id)!
    const newA = await uploadThumbnail(client, assert, admin, a, { r: 200, g: 120, b: 20 })
    assert.notEqual(newA, oldA)
    items = await banner(client)
    assert.equal(items[0].imageUrl, `/media/${newA}`)
    await assertServed(client, assert, items[0].imageUrl)
    fakeDisk.assertMissing(ThumbnailService.keys(oldA))
    await assertRefused(client, assert, oldA)
    const thumbnailLogs = await logsOf('update', a.id)
    assert.deepEqual(
      thumbnailLogs.map((log) => log.metadata),
      [
        { field: 'thumbnail', op: 'set' },
        { field: 'thumbnail', op: 'set' },
      ]
    )

    // Retrait de la vignette de B refusé tant qu'elle est à la une (aucune vidéo).
    response = await destroy(client, admin, `/admin/productions/${b.id}/thumbnail`).header(
      'referer',
      '/admin/featured'
    )
    response.assertStatus(302)
    assert.equal(
      flashedErrors(response.flashMessages()).thumbnail,
      'thumbnail.errors.required_for_featured'
    )
    await b.refresh()
    assert.equal(b.thumbnailKey, keyOf.get(b.id))
    assert.deepEqual(await bannerIds(client), [a.id, b.id, c.id])

    // Dépublication de A : retirée, positions recompactées, image refusée, page admin à jour.
    response = await post(client, admin, `/admin/productions/${a.id}/unpublish`)
    response.assertStatus(302)
    assert.deepEqual(await bannerIds(client), [b.id, c.id])
    assert.deepEqual(await storedSelection(), [b.id, c.id])
    const positions = await db.from('featured_productions').orderBy('position').select('position')
    assert.deepEqual(
      positions.map((row: { position: number }) => row.position),
      [1, 2]
    )
    fakeDisk.assertExists(ThumbnailService.keys(newA)) // conservée (P2.1), seulement plus servie
    await assertRefused(client, assert, newA)
    const selectionAfter = await adminSelection(client, admin)
    assert.deepEqual(
      selectionAfter.map((item) => item.id),
      [b.id, c.id]
    )
    let removals = await logsOf('featured_auto_remove', a.id)
    assert.lengthOf(removals, 1)
    assert.equal(removals[0].adminUserId, admin.id)
    assert.deepEqual(removals[0].metadata, { position: 1, cause: 'unpublish' })

    // Republication : la vignette redevient servable, mais A ne revient pas à la une (D-11.7-4).
    await publish(client, assert, admin, a)
    await assertServed(client, assert, `/media/${newA}`)
    assert.deepEqual(await bannerIds(client), [b.id, c.id])
    assert.deepEqual(await storedSelection(), [b.id, c.id])
    assert.notInclude(await pageHtml(client, '/'), newA)
    await assertD37(client, assert, a)

    // Suppression de C (position 2) : retirée, variantes supprimées de R2, journal.
    const keyC = keyOf.get(c.id)!
    response = await destroy(client, admin, `/admin/productions/${c.id}`)
    response.assertStatus(302)
    assert.deepEqual(await bannerIds(client), [b.id])
    fakeDisk.assertMissing(ThumbnailService.keys(keyC))
    await assertRefused(client, assert, keyC)
    removals = await logsOf('featured_auto_remove', c.id)
    assert.deepEqual(
      removals.map((log) => log.metadata),
      [{ position: 2, cause: 'delete' }]
    )
    await assertServed(client, assert, `/media/${keyOf.get(b.id)}`)

    // Page Journal (super admin) : filtres par type d'action.
    const removalsPage = await pageProps(
      client,
      '/admin/activity?actionType=featured_auto_remove',
      admin
    )
    assert.sameMembers(
      removalsPage.logs.map((log: { resourceId: string }) => log.resourceId),
      [a.id, c.id]
    )
    const updatesPage = await pageProps(client, '/admin/activity?actionType=featured_update', admin)
    assert.lengthOf(updatesPage.logs, 1)
    assert.equal(updatesPage.logs[0].resourceType, 'featured_selection')
    assert.isNull(updatesPage.logs[0].resourceId)
  }).timeout(60_000)

  test('sélection vidée par l’admin → bannière absente, images toujours servies hors une', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdmin()
    const a = await createDraft('Parcours Delta')
    await publish(client, assert, admin, a)
    const key = await uploadThumbnail(client, assert, admin, a)
    let response = await putFeatured(client, admin, [a.id])
    response.assertStatus(302)
    assert.deepEqual(await bannerIds(client), [a.id])
    response = await putFeatured(client, admin, [])
    response.assertStatus(302)
    assert.deepEqual(await banner(client), [])
    assert.notInclude(await pageHtml(client, '/'), key)
    await assertServed(client, assert, `/media/${key}`)
    const updates = await logsOf('featured_update')
    assert.sameDeepMembers(
      updates.map((log) => log.metadata),
      [
        { before: [], after: [a.id] },
        { before: [a.id], after: [] },
      ]
    )
    // Hors de la une, le retrait de la vignette est permis.
    response = await destroy(client, admin, `/admin/productions/${a.id}/thumbnail`)
    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    await assertRefused(client, assert, key)
  }).timeout(30_000)
})

test.group('Featured flows | vidéo hébergée par les routes admin (11.7)', (group) => {
  let mp4: string
  withIsolation(group)
  group.setup(() => {
    mp4 = makeMp4('featured-flow-2s.mp4', 2)
  })

  test('MP4 → poster → une sans vignette → vignette posée puis retirée → vidéo supprimée', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdmin()
    const production = await createDraft('Parcours Video', false)

    let response = await client
      .post(`/admin/productions/${production.id}/files`)
      .file('file', mp4)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    response.assertStatus(302)
    const video = await ProductionFile.query().where('productionId', production.id).firstOrFail()
    assert.equal(video.mimeType, 'video/mp4')
    const posterKey = video.posterKey!
    assert.match(posterKey, new RegExp(`^posters/${video.id}/[A-Za-z0-9_-]{20}$`))
    await publish(client, assert, admin, production)

    // Vidéo hébergée avec image extraite : mise à la une sans vignette acceptée.
    response = await putFeatured(client, admin, [production.id])
    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    let items = await banner(client)
    assert.deepEqual(
      items.map((item) => item.imageUrl),
      [`/media/${posterKey}`]
    )
    await assertServed(client, assert, items[0].imageUrl)
    const detail = await pageProps(client, `/productions/${production.slug}`)
    assert.equal(detail.production.files[0].posterUrl, `/media/${posterKey}/w1600.webp`)
    await assertD37(client, assert, production)
    let selection = await adminSelection(client, admin)
    assert.equal(selection[0].imageState, 'poster')
    assert.isFalse(selection[0].requiresThumbnail)

    // Vignette posée : elle prime dans la bannière ; le poster reste servi (lecteur vidéo).
    const thumbnailKey = await uploadThumbnail(client, assert, admin, production)
    items = await banner(client)
    assert.equal(items[0].imageUrl, `/media/${thumbnailKey}`)
    await assertServed(client, assert, items[0].imageUrl)
    await assertServed(client, assert, `/media/${posterKey}`)
    await assertD37(client, assert, production)

    // Vignette retirée (permis grâce au poster) : retour au même poster, sans retraitement.
    response = await destroy(client, admin, `/admin/productions/${production.id}/thumbnail`)
    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    fakeDisk.assertMissing(ThumbnailService.keys(thumbnailKey))
    await video.refresh()
    assert.equal(video.posterKey, posterKey)
    items = await banner(client)
    assert.equal(items[0].imageUrl, `/media/${posterKey}`)
    await assertRefused(client, assert, thumbnailKey)

    // Vidéo supprimée : poster supprimé et refusé ; production écartée de la bannière mais
    // toujours dans la sélection, signalée « Vignette manquante » (D-11.5-6, D-11.6-2).
    response = await destroy(client, admin, `/admin/productions/${production.id}/files/${video.id}`)
    response.assertStatus(302)
    fakeDisk.assertMissing(PosterService.keys(posterKey))
    await assertRefused(client, assert, posterKey)
    assert.deepEqual(await banner(client), [])
    assert.notInclude(await pageHtml(client, '/'), posterKey)
    assert.deepEqual(await storedSelection(), [production.id])
    selection = await adminSelection(client, admin)
    assert.equal(selection[0].imageState, 'missing')
    assert.isTrue(selection[0].requiresThumbnail)
    assert.lengthOf(await logsOf('featured_auto_remove', production.id), 0)

    // Ré-enregistrer cette sélection est refusé (vignette requise, emplacement 1 nommé).
    response = await putFeatured(client, admin, [production.id])
    response.assertStatus(302)
    const errors = flashedErrors(response.flashMessages())
    assert.equal(errors.productionIds, 'featured.errors.thumbnail_required')
    assert.equal(errors.position, '1')
    assert.lengthOf(await logsOf('featured_update'), 1)
  }).timeout(60_000)
})

// Matrice : statut × à la une × image. Présence dans la bannière ⇔ publiée ∧ à la une ∧ image ;
// `imageUrl` = vignette, sinon poster ; vignette servie ⇔ publiée ∧ vignette (à la une ou non,
// D-11.2-2) ; poster servi ⇔ publiée ∧ poster ; une ancienne clé n'est jamais servie ; aucune clé
// d'une production hors bannière dans la page d'accueil ; D37 pour toute production publiée.
const STATUSES = ['published', 'draft', 'unpublished'] as const
const IMAGES = ['none', 'thumbnail', 'poster', 'both'] as const

const token = (seed: string) => `${seed}${'x'.repeat(20)}`.slice(0, 20)

async function putVariants(prefix: string) {
  const disk = drive.use('r2')
  for (const variant of VARIANTS) {
    await disk.put(`${prefix}/${variant}`, Buffer.from(`bytes of ${prefix}`), {
      contentType: 'image/webp',
    })
  }
}

async function mediaStatuses(client: HttpClient, prefix: string): Promise<number[]> {
  const statuses: number[] = []
  for (const variant of VARIANTS) {
    const response = await client.get(`/media/${prefix}/${variant}`)
    statuses.push(response.status())
  }
  return statuses
}

test.group('Featured flows | matrice /media × bannière × D37 (11.7)', (group) => {
  withIsolation(group)

  for (const status of STATUSES) {
    for (const featured of [true, false]) {
      for (const image of IMAGES) {
        const label = `${status} × ${featured ? 'à la une' : 'hors une'} × ${image}`
        test(label, async ({ client, assert }) => {
          drive.fake('r2')
          const admin = await createAdmin()
          const production = await createDraft(`Matrice ${counter++}`)
          production.status = status
          production.antaPublishedAt = status === 'draft' ? null : DateTime.now()
          const hasThumbnail = image === 'thumbnail' || image === 'both'
          const hasPoster = image === 'poster' || image === 'both'
          const oldThumbnail = `thumbnails/${production.id}/${token('oldthumb')}`
          await putVariants(oldThumbnail)
          let thumbnailKey: string | null = null
          if (hasThumbnail) {
            thumbnailKey = `thumbnails/${production.id}/${token('currthumb')}`
            await putVariants(thumbnailKey)
            production.thumbnailKey = thumbnailKey
          }
          await production.save()
          const video = await ProductionFile.create({
            productionId: production.id,
            fileKey: `productions/${production.id}/video.mp4`,
            originalName: 'video.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 10,
            storageProvider: 'r2',
            posterKey: null,
          })
          const oldPoster = `posters/${video.id}/${token('oldposter')}`
          await putVariants(oldPoster)
          let posterKey: string | null = null
          if (hasPoster) {
            posterKey = `posters/${video.id}/${token('currposter')}`
            await putVariants(posterKey)
            video.posterKey = posterKey
            await video.save()
          }
          if (featured) {
            await db
              .table('featured_productions')
              .insert({ position: 1, production_id: production.id, created_by_id: admin.id })
          }

          const published = status === 'published'
          const inBanner = published && featured && image !== 'none'
          const items = await banner(client)
          if (inBanner) {
            assert.deepEqual(
              items.map((item) => [item.id, item.imageUrl]),
              [[production.id, `/media/${thumbnailKey ?? posterKey}`]]
            )
            await assertServed(client, assert, items[0].imageUrl)
          } else {
            assert.deepEqual(items, [])
          }

          const ok = (served: boolean) => VARIANTS.map(() => (served ? 200 : 404))
          if (thumbnailKey) {
            assert.deepEqual(await mediaStatuses(client, thumbnailKey), ok(published), 'vignette')
          }
          if (posterKey) {
            assert.deepEqual(await mediaStatuses(client, posterKey), ok(published), 'poster')
          }
          assert.deepEqual(
            await mediaStatuses(client, oldThumbnail),
            ok(false),
            'ancienne vignette'
          )
          assert.deepEqual(await mediaStatuses(client, oldPoster), ok(false), 'ancien poster')

          // Accueil : seule l'image affichée par la bannière y figure, jamais une autre clé.
          const homeHtml = await pageHtml(client, '/')
          const shown = inBanner ? (thumbnailKey ?? posterKey) : null
          for (const key of [thumbnailKey, posterKey, oldThumbnail, oldPoster]) {
            if (key && key !== shown) assert.notInclude(homeHtml, key.split('/').pop()!, key)
          }

          // Page « À la une » : l'état périmé reste visible de l'admin, signalé.
          const selection = await adminSelection(client, admin)
          if (featured) {
            assert.lengthOf(selection, 1)
            assert.equal(selection[0].unavailable, !published)
            assert.equal(
              selection[0].imageState,
              hasThumbnail ? 'thumbnail' : hasPoster ? 'poster' : 'missing'
            )
          } else {
            assert.deepEqual(selection, [])
          }

          if (published) {
            await assertD37(client, assert, production)
          } else {
            const response = await client.get(`/productions/${production.slug}`)
            response.assertStatus(404)
          }
        })
      }
    }
  }
})
