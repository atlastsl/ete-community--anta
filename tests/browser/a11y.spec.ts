import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { AxeBuilder } from '@axe-core/playwright'
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
 * Story 13.1 (NFR16, P2-16) — axe WCAG 2.1 A/AA audit of every public page, in French and in
 * English (`i18n_lang` cookie). One test per page × language; each must report 0 violation.
 *
 * Data: created here inside a global transaction. The HTTP server runs in this process, so the
 * pages it renders read the same (uncommitted) transaction; everything is rolled back at the end.
 * Files: `drive.fake('r2')` (no R2 call); the thumbnails and the author photo are real WebP images
 * written to the fake disk, so `/media` serves them as in production. The browser may only reach
 * the local server: every other request (Google Fonts, signed URLs, embedded players…) is aborted.
 * Fictitious names only (public repository).
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const LOCALES = ['fr', 'en'] as const
type Locale = (typeof LOCALES)[number]

const TOKEN = 'AbCdEfGhIjKlMnOp_-12'
/** Desktop then mobile (375 px, D35): both layouts are audited in each test. */
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 800 },
]
/**
 * axe `incomplete` results ("needs review") allowed, each justified in the story (13-1, « Résultats
 * de l'audit », D-13.1-10): any other incomplete rule fails the test, like a violation.
 * - `color-contrast`: text on the hero gradient / partially covered `dt`, ratios computed by hand;
 * - `video-caption`: hosted videos have no captions track (PO question 1).
 */
const ALLOWED_INCOMPLETE = new Set(['color-contrast', 'video-caption'])

/** Public translations: proves the client rendered the requested language, not only `<html lang>`. */
const TRANSLATIONS = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(`inertia/locales/public/${locale}.json`, 'utf-8')),
  ])
) as Record<Locale, { a11y: { skip_to_content: string }; footer: { explore: string } }>

const baseUrl = () => `http://${process.env.HOST}:${process.env.PORT}`

type Fixtures = {
  author: Author
  pdf: Production
  epub: Production
  video: Production
  audio: Production
}

let fixtures: Fixtures
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

async function createAuthor(firstNames: string, lastNames: string, photo = false) {
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

async function createPublished(
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
 * photo), detail pages for each media type sharing tags / authors (suggestions).
 */
async function seed(): Promise<Fixtures> {
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

  return { author, pdf, epub, video, audio }
}

/** Only the local server may be reached; the interface language comes from `i18n_lang`. */
async function prepareContext(context: BrowserContext, locale: Locale) {
  const origin = new URL(baseUrl()).origin
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.abort()
  )
  await context.addCookies([{ name: 'i18n_lang', value: locale, url: baseUrl() }])
}

type PageCase = {
  name: string
  url: () => string
  status?: number
  /** Extra wait / coverage check once the page is idle (suggestions, banner, blocks…). */
  ready?: (page: Page) => Promise<void>
}

/** Fails when the test data no longer reaches the page (the audit would silently shrink). */
async function atLeast(page: Page, selector: string, min: number) {
  const count = await page.locator(selector).count()
  if (count < min) throw new Error(`expected at least ${min} "${selector}", found ${count}`)
}

const SUGGESTION_CARDS = 'section:has(> p[aria-live]) article'

/**
 * Suggestions loaded with cards (otherwise they were not audited). The fetch is abandoned after
 * 2 s by design (D22): under load (cold Vite, CI) the section may be dropped → one reload.
 */
async function suggestionsLoaded(page: Page) {
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

const detail = (key: keyof Omit<Fixtures, 'author'>) => () => `/productions/${fixtures[key].slug}`

const PAGES: PageCase[] = [
  {
    name: 'accueil',
    url: () => '/',
    // Banner with 3 productions + the 4 blocks (3 production blocks, top authors).
    ready: async (page) => {
      await atLeast(page, 'main section:has(> h2.sr-only) article', 3)
      await atLeast(page, 'main section[aria-labelledby] h2', 5)
    },
  },
  {
    name: 'listing avec filtres actifs',
    url: () =>
      `/productions?q=fictive&category=article&domain=mathematics&author=${fixtures.author.slug}`,
    // Results and the 3 active filters (category, domain, author) rendered as pressed toggles:
    // a renamed query parameter must not silently audit a plain listing.
    ready: async (page) => {
      await atLeast(page, 'main article', 1)
      await atLeast(page, 'main a[role="button"][aria-pressed="true"]', 3)
    },
  },
  { name: 'détail PDF', url: detail('pdf'), ready: suggestionsLoaded },
  { name: 'détail EPUB', url: detail('epub'), ready: suggestionsLoaded },
  {
    name: 'détail vidéo',
    url: detail('video'),
    ready: async (page) => {
      await suggestionsLoaded(page)
      await atLeast(page, 'main video', 1)
      // Links section: embedded player (titled iframe) + external link.
      await atLeast(page, 'main iframe[sandbox][title]', 1)
      await atLeast(page, 'main a[href="https://example.org/source-fictive"]', 1)
    },
  },
  { name: 'détail audio', url: detail('audio'), ready: suggestionsLoaded },
  {
    name: 'liste des auteurs',
    url: () => '/authors',
    ready: (page) => atLeast(page, 'main a[href^="/authors/"]', 3),
  },
  {
    name: 'profil',
    url: () => `/authors/${fixtures.author.slug}`,
    ready: (page) => atLeast(page, 'main img[alt]:not([alt=""])', 1),
  },
  { name: 'politique de confidentialité', url: () => '/privacy-policy' },
  { name: 'page 404', url: () => '/cette-page-n-existe-pas', status: 404 },
]

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations
    .map(
      (violation) =>
        `- [${violation.impact}] ${violation.id}: ${violation.help}\n` +
        violation.nodes
          .slice(0, 5)
          .map(
            (node) => `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[1] ?? ''}`
          )
          .join('\n')
    )
    .join('\n')
}

test.group('Accessibilité | axe WCAG 2.1 A/AA des pages publiques (13.1)', (group) => {
  group.setup(async () => {
    drive.fake('r2')
    await db.beginGlobalTransaction()
    fixtures = await seed()
    return async () => {
      await db.rollbackGlobalTransaction()
      drive.restore('r2')
    }
  })

  for (const pageCase of PAGES) {
    for (const locale of LOCALES) {
      test(`${pageCase.name} (${locale}) : 0 violation A/AA`, async ({
        assert,
        browserContext,
      }) => {
        await prepareContext(browserContext, locale)
        const page = await browserContext.newPage()
        const response = await page.goto(pageCase.url())
        assert.equal(response?.status(), pageCase.status ?? 200)

        await page.waitForLoadState('networkidle')
        // React rendered (not an empty shell) in the requested language.
        await page.locator('main').first().waitFor()
        assert.equal(await page.locator('html').getAttribute('lang'), locale)
        // Client-side strings in the requested language (skip link, footer heading).
        const strings = TRANSLATIONS[locale]
        await atLeast(page, `a:text-is("${strings.a11y.skip_to_content}")`, 1)
        await atLeast(page, `footer h2:text-is("${strings.footer.explore}")`, 1)
        if (pageCase.ready) await pageCase.ready(page)

        const failures: string[] = []
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport)
          const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
          const where = `${pageCase.url()} (${locale}, ${viewport.width} px)`
          if (results.violations.length > 0) {
            failures.push(
              `${results.violations.length} violation(s) on ${where}:\n` +
                formatViolations(results.violations)
            )
          }
          const unexpected = results.incomplete.filter((r) => !ALLOWED_INCOMPLETE.has(r.id))
          if (unexpected.length > 0) {
            failures.push(
              `${unexpected.length} unexpected incomplete rule(s) on ${where}:\n` +
                formatViolations(unexpected)
            )
          }
        }
        assert.isTrue(failures.length === 0, failures.join('\n'))
      })
    }
  }
})
