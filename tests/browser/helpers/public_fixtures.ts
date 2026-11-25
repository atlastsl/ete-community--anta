import { readFileSync } from 'node:fs'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import type { BrowserContext, Page } from 'playwright'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'
import StatsDownload from '#models/stats_download'
import StatsView from '#models/stats_view'
import ProductionAuthorService from '#services/production_author_service'

/**
 * Shared data and browser helpers of the `browser` suite (Stories 13.1, 13.2). Data are created
 * by each group inside a global transaction (the HTTP server runs in this process and reads it),
 * files on `drive.fake('r2')` (real WebP images, served by `/media`). Fictitious names only.
 */

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

const TOKEN = 'AbCdEfGhIjKlMnOp_-12'

type PublicTranslations = {
  a11y: { skip_to_content: string }
  footer: { explore: string }
  filters: { dimensions: { author: string } }
  media: { download: string }
  productions: { results_count: string }
  home: { hero: { advanced_search: string }; blocks: { recent: string; see_more_named: string } }
}

/** Public translations: proves the client rendered the requested language, not only `<html lang>`. */
export const TRANSLATIONS = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(`inertia/locales/public/${locale}.json`, 'utf-8')),
  ])
) as Record<Locale, PublicTranslations>

export const baseUrl = () => `http://${process.env.HOST}:${process.env.PORT}`

export type Fixtures = {
  author: Author
  second: Author
  third: Author
  pdf: Production
  epub: Production
  video: Production
  audio: Production
  extra: Production
}

let counter = 0

/** Writes the WebP variants of an image key to the fake R2 disk (served by `/media`). */
async function storeImage(
  key: string,
  variants: { name: string; width: number; height: number }[]
) {
  for (const variant of variants) {
    const buffer = await sharp({
      create: {
        width: variant.width,
        height: variant.height,
        channels: 3,
        background: { r: 21, g: 128, b: 61 },
      },
    })
      .webp()
      .toBuffer()
    await drive.use('r2').put(`${key}/${variant.name}`, buffer)
  }
}

export async function createAuthor(firstNames: string, lastNames: string, photo = false) {
  const author = await Author.create({
    firstNames,
    lastNames,
    googleScholarUrl: 'https://scholar.google.com/citations?user=FICTIF01',
    consentConfirmedAt: DateTime.now(),
  })
  await AuthorAffiliation.create({
    authorId: author.id,
    position: 1,
    institution: 'Université fictive de Dakar',
    department: 'Département de mathématiques',
  })
  if (photo) {
    author.photoKey = `authors/${author.id}/${TOKEN}`
    await author.save()
    await storeImage(author.photoKey, [
      { name: 'w128.webp', width: 128, height: 128 },
      { name: 'w384.webp', width: 384, height: 384 },
    ])
  }
  return author
}

export async function createPublished(
  title: string,
  opts: { authors: Author[]; daysAgo: number; language?: string; category?: string }
): Promise<Production> {
  const production = await Production.create({
    title,
    summary: `Résumé fictif de « ${title} », utilisé par l'audit d'accessibilité.`,
    authorNames: [],
    tags: ['essai', 'accessibilité'],
    category: opts.category ?? 'article',
    domain: 'mathematics',
    subdomain: ['topology'],
    language: opts.language ?? 'fr',
    publicationCountry: 'Sénégal',
    journal: 'Revue fictive',
    licenseStatus: 'member',
    status: 'published',
    workPublishedAt: DateTime.fromISO('2024-03-15'),
    antaPublishedAt: DateTime.now().minus({ days: opts.daysAgo }),
    createdById: null,
  })
  for (const [index, author] of opts.authors.entries()) {
    await db
      .table('production_authors')
      .insert({ production_id: production.id, author_id: author.id, position: index + 1 })
  }
  await ProductionAuthorService.refreshDenormalizedNames([production.id])
  return production
}

async function attachFile(production: Production, mimeType: string, name: string) {
  return ProductionFile.create({
    productionId: production.id,
    fileKey: `productions/${production.id}/${name}`,
    originalName: name,
    mimeType,
    sizeBytes: 123_456,
    storageProvider: 'r2',
  })
}

async function addStats(production: Production, views: number, downloads: number) {
  for (let i = 0; i < views; i++) {
    await StatsView.create({
      productionId: production.id,
      recordedAt: DateTime.now().minus({ days: (i % 30) + 1 }),
      ipHash: `a11y-view-${counter++}`,
      sessionId: null,
    })
  }
  for (let i = 0; i < downloads; i++) {
    await StatsDownload.create({
      productionId: production.id,
      downloadedAt: DateTime.now().minus({ days: (i % 30) + 1 }),
      ipHash: `a11y-download-${counter++}`,
    })
  }
}

/**
 * Banner with 3 productions (thumbnails), the 4 home blocks filled, visible authors (one with a
 * photo), detail pages for each media type sharing tags / authors (suggestions). The video is in
 * English (`lang` of the contents, 13.2), the others in French.
 */
export async function seed(): Promise<Fixtures> {
  const author = await createAuthor('Awa', 'Fictive', true)
  const second = await createAuthor('Moussa', 'Exemplaire')
  const third = await createAuthor('Fatou', 'Imaginaire')

  const pdf = await createPublished('Topologie des espaces fictifs', {
    authors: [author, second],
    daysAgo: 1,
  })
  await attachFile(pdf, 'application/pdf', 'topologie.pdf')
  const epub = await createPublished('Essai sur les nombres imaginaires', {
    authors: [second],
    daysAgo: 2,
    category: 'book',
  })
  await attachFile(epub, 'application/epub+zip', 'essai.epub')
  const video = await createPublished('A lecture on fictional geometry', {
    authors: [author],
    daysAgo: 3,
    language: 'en',
    category: 'video',
  })
  await attachFile(video, 'video/mp4', 'lecture.mp4')
  // Links section: an embedded player (iframe, title fallback = section label) and an external
  // link without label (fallback text). Their hosts are never reached (aborted by the browser).
  await ProductionLink.create({
    productionId: video.id,
    url: 'https://www.youtube-nocookie.com/embed/FICTIF00000',
    linkType: 'embed',
    label: null,
  })
  await ProductionLink.create({
    productionId: video.id,
    url: 'https://example.org/source-fictive',
    linkType: 'simple',
    label: null,
  })
  const audio = await createPublished('Entretien sonore sur les suites', {
    authors: [third],
    daysAgo: 4,
    category: 'podcast',
  })
  await attachFile(audio, 'audio/mpeg', 'entretien.mp3')
  const extra = await createPublished('Notes de cours fictives', {
    authors: [third, author],
    daysAgo: 5,
  })
  await attachFile(extra, 'application/pdf', 'notes.pdf')

  await addStats(pdf, 12, 5)
  await addStats(epub, 8, 9)
  await addStats(video, 5, 2)
  await addStats(audio, 3, 1)

  // Banner: 3 featured productions with a thumbnail (D37).
  await db.from('featured_productions').delete()
  for (const [index, production] of [pdf, video, audio].entries()) {
    production.thumbnailKey = `thumbnails/${production.id}/${'T'.repeat(16)}000${index}`
    await production.save()
    await storeImage(production.thumbnailKey, [
      { name: 'w400.webp', width: 400, height: 225 },
      { name: 'w800.webp', width: 800, height: 450 },
      { name: 'w1600.webp', width: 1600, height: 900 },
    ])
    await db
      .table('featured_productions')
      .insert({ position: index + 1, production_id: production.id, created_by_id: null })
  }

  return { author, second, third, pdf, epub, video, audio, extra }
}

/** Opens a global transaction, fakes R2 and seeds; returns the group cleanup. */
export async function setupData(onSeeded: (fixtures: Fixtures) => void | Promise<void>) {
  drive.fake('r2')
  await db.beginGlobalTransaction()
  await onSeeded(await seed())
  return async () => {
    await db.rollbackGlobalTransaction()
    drive.restore('r2')
  }
}

/** Only the local server may be reached; the interface language comes from `i18n_lang`. */
export async function prepareContext(context: BrowserContext, locale: Locale) {
  const origin = new URL(baseUrl()).origin
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.abort()
  )
  await context.addCookies([{ name: 'i18n_lang', value: locale, url: baseUrl() }])
}

/** Fails when the test data no longer reaches the page (the audit would silently shrink). */
export async function atLeast(page: Page, selector: string, min: number) {
  const count = await page.locator(selector).count()
  if (count < min) throw new Error(`expected at least ${min} "${selector}", found ${count}`)
}

export const SUGGESTION_CARDS = 'section:has(> p[aria-live]) article'

/**
 * Suggestions loaded with cards (otherwise they were not audited). The fetch is abandoned after
 * 2 s by design (D22): under load (cold Vite, CI) the section may be dropped → one reload.
 */
export async function suggestionsLoaded(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('[aria-busy="true"]').waitFor({ state: 'detached' })
    if ((await page.locator(SUGGESTION_CARDS).count()) > 0) return
    if (attempt === 0) {
      await page.reload()
      await page.waitForLoadState('networkidle')
    }
  }
  await atLeast(page, SUGGESTION_CARDS, 1)
}

/** New page on `url`, waits until React rendered it in `locale` (context already prepared). */
export async function visit(
  context: BrowserContext,
  locale: Locale,
  url: string
): Promise<{ page: Page; status: number | undefined }> {
  const page = await context.newPage()
  const response = await page.goto(url)
  await page.waitForLoadState('networkidle')
  await page.locator('main').first().waitFor()
  await atLeast(page, `a:text-is("${TRANSLATIONS[locale].a11y.skip_to_content}")`, 1)
  return { page, status: response?.status() }
}

/** Prepares the context (local origin only, `i18n_lang`) then opens `url`. */
export async function openPage(context: BrowserContext, locale: Locale, url: string) {
  await prepareContext(context, locale)
  return visit(context, locale, url)
}
