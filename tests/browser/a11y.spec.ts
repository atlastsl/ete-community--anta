import { test } from '@japa/runner'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from 'playwright'
import {
  LOCALES,
  TRANSLATIONS,
  atLeast,
  prepareContext,
  createAuthor,
  createPublished,
  setupData,
  suggestionsLoaded,
  type Fixtures,
} from './helpers/public_fixtures.js'

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

let fixtures: Fixtures

type PageCase = {
  name: string
  url: () => string
  status?: number
  /** Extra wait / coverage check once the page is idle (suggestions, banner, blocks…). */
  ready?: (page: Page) => Promise<void>
}

const detail = (key: 'pdf' | 'epub' | 'video' | 'audio') => () =>
  `/productions/${fixtures[key].slug}`

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

/** axe A/AA on the current state of the page: violations and unexpected incomplete rules. */
async function audit(
  page: Page,
  where: string,
  disabledRules: string[] = [],
  include?: string
): Promise<string[]> {
  const failures: string[] = []
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(disabledRules)
  if (include) builder = builder.include(include)
  const results = await builder.analyze()
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
  return failures
}

/**
 * Story 13.4 — interactive structure, beyond axe (`nested-interactive` ignores links): no link,
 * button or other control inside a link or a button (no nested links in cards), and on cards with
 * a stretched link (`::after` covering the card) every other control of the card stays clickable
 * above the overlay (hit test at its centre). Today only the banner cards have such controls (their
 * author links); author cards hold a single link, so nothing is hit-tested there.
 * Passed as a string: the server `lib` of the typecheck has no DOM types.
 */
const structureScript = (hitTest: boolean) => `(() => {
  const HIT_TEST = ${hitTest}
  const CONTROLS = 'a[href], button, input, select, textarea, summary, iframe, ' +
    'video[controls], audio[controls], [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
  const label = (el) => '<' + el.tagName.toLowerCase() + '> "' +
    (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40) + '"'
  const failures = []
  let stretched = 0
  let hitTested = 0
  for (const outer of document.querySelectorAll('a[href], button, [role="button"], [role="link"]')) {
    const inner = outer.querySelector(CONTROLS)
    if (inner) failures.push('nested control: ' + label(inner) + ' inside ' + label(outer))
  }
  for (const link of HIT_TEST ? document.querySelectorAll('a[href]') : []) {
    const after = getComputedStyle(link, '::after')
    if (after.content === 'none' || after.position !== 'absolute') continue
    const card = link.closest('article')
    if (!card) continue
    stretched++
    for (const control of card.querySelectorAll(CONTROLS)) {
      if (control === link) continue
      control.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
      const box = control.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      hitTested++
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      if (!hit || (hit !== control && !control.contains(hit))) {
        failures.push('control covered by the stretched link: ' + label(control) +
          ' (hit ' + (hit ? label(hit) : 'nothing') + ') in card ' + label(link))
      }
    }
  }
  return { failures, stretched, hitTested }
})()`

type Structure = { failures: string[]; stretched: number; hitTested: number }

async function structure(page: Page, where: string, hitTest = true): Promise<Structure> {
  const result = (await page.evaluate(structureScript(hitTest))) as Structure
  return { ...result, failures: result.failures.map((failure) => `${failure} on ${where}`) }
}

/**
 * Coverage guard of the hit test: the home page has 3 banner cards whose author links are
 * hit-tested (a renamed class or a banner without bylines must not empty the check silently).
 */
const HIT_TEST_COVERAGE: Record<string, { stretched: number; hitTested: number }> = {
  accueil: { stretched: 3, hitTested: 1 },
}

test.group('Accessibilité | axe WCAG 2.1 A/AA des pages publiques (13.1)', (group) => {
  group.setup(() =>
    setupData((seeded) => {
      fixtures = seeded
    })
  )

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
          const where = `${pageCase.url()} (${locale}, ${viewport.width} px)`
          failures.push(...(await audit(page, where)))
          const checked = await structure(page, where)
          failures.push(...checked.failures)
          const expected = HIT_TEST_COVERAGE[pageCase.name]
          if (expected && checked.stretched < expected.stretched) {
            failures.push(
              `${checked.stretched} stretched-link card(s) < ${expected.stretched} on ${where}`
            )
          }
          if (expected && checked.hitTested < expected.hitTested) {
            failures.push(
              `${checked.hitTested} hit-tested control(s) < ${expected.hitTested} on ${where}`
            )
          }
        }
        assert.isTrue(failures.length === 0, failures.join('\n'))
      })
    }
  }
})

/**
 * Story 13.2 — states not audited by 13.1 (its review defers): opened mobile filter panel with
 * every group expanded, grid view, inert row once 20 authors are selected, opened sort listbox,
 * suggestions while loading. Each state is reached like a user would (clicks, keys, URL).
 */
type StateCase = {
  name: string
  url: () => string
  viewport: { width: number; height: number }
  /** Puts the page in the audited state, and checks it was reached. */
  reach: (page: Page) => Promise<void>
  /** Before the visit (e.g. delayed route). */
  before?: (page: Page) => Promise<void>
  /**
   * Rules not applicable to this state, each justified in the story (D-13.2-n) and asked to the
   * PO; the state itself must prove why (e.g. focus trapped in the open listbox).
   */
  disabledRules?: string[]
  /** Audit restricted to this selector (state too short-lived for a full-page audit). */
  include?: string
  /** After the audit: the state must still be there (it was audited, not its end). */
  stillThere?: (page: Page) => Promise<void>
  /** Cleanup after the audit (e.g. release a held request). */
  after?: () => void
}

/** Held suggestions requests, released once the audit is over. */
let releaseSuggestions: (() => void)[] = []

/** 21 visible authors: selecting 20 of them leaves an inert 21st row (MAX_AUTHOR_FILTERS). */
let crowd: { slug: string }[] = []

const STATES: StateCase[] = [
  {
    name: 'listing mobile, panneau de filtres ouvert, groupes dépliés',
    url: () => '/productions?q=fictive',
    viewport: { width: 375, height: 800 },
    reach: async (page) => {
      const toggle = page.locator('main aside > button[aria-expanded]')
      await toggle.click()
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') throw new Error('panel closed')
      const summaries = page.locator('main aside details:not([open]) > summary')
      // Bounded: a summary that does not open must fail clearly, not loop forever.
      for (let clicks = 0; (await summaries.count()) > 0; clicks++) {
        if (clicks >= 20) throw new Error('filter groups do not open on click (20 clicks)')
        await summaries.first().click()
      }
      await atLeast(page, 'main aside details[open]', 3)
    },
  },
  {
    name: 'listing en vue grille',
    url: () => '/productions',
    viewport: { width: 1280, height: 800 },
    reach: async (page) => {
      await page.locator('main [role="group"] button[aria-pressed="false"]').first().click()
      await atLeast(page, 'main [role="group"] button[aria-pressed="true"]', 1)
      await atLeast(page, 'main .grid article', 1)
    },
  },
  {
    name: 'listing, limite de 20 auteurs (ligne inerte)',
    url: () =>
      `/productions?${crowd
        .slice(0, 20)
        .map((a) => `author=${a.slug}`)
        .join('&')}`,
    viewport: { width: 1280, height: 800 },
    reach: async (page) => {
      // Each inert row explains why it is unavailable (Story 13.4).
      await atLeast(
        page,
        'main span[role="button"][aria-disabled="true"][aria-describedby="author-filter-limit"]',
        1
      )
      await atLeast(page, '#author-filter-limit', 1)
    },
  },
  {
    name: 'liste des auteurs, liste de tri ouverte',
    url: () => '/authors',
    viewport: { width: 1280, height: 800 },
    reach: async (page) => {
      await page.locator('#authors-sort').focus()
      await page.keyboard.press('Enter')
      await page.locator('[role="option"]:focus').waitFor()
      await atLeast(page, '[role="listbox"] [role="option"]', 2)
      // Radix hides the rest of the page (`aria-hidden`) while its listbox is open, and keeps the
      // focus in it: Tab never reaches the hidden controls (axe `aria-hidden-focus` cannot see
      // the trap, D-13.2-6); Escape closes it and gives the focus back to the trigger.
      await page.keyboard.press('Tab')
      const inListbox = await page.evaluate(
        `!!document.activeElement && !!document.activeElement.closest('[role="listbox"]')`
      )
      if (!inListbox) throw new Error('Tab left the open sort listbox')
    },
    disabledRules: ['aria-hidden-focus'],
  },
  {
    name: 'détail, suggestions en cours de chargement',
    url: () => `/productions/${fixtures.pdf.slug}`,
    viewport: { width: 1280, height: 800 },
    // The suggestions answer is held until the audit is over, and the client's 2 s abandon timer
    // (D22, another state: section removed) is postponed for this page only, so a loaded machine
    // cannot end the state mid-audit. Only the busy section is audited (the full page is audited
    // by 13.1), and it must still be busy afterwards.
    // 2000 = SUGGESTIONS_TIMEOUT_MS (inertia/lib/suggestions.ts, not importable: TS6305).
    before: async (page) => {
      await page.addInitScript(`{
        const original = window.setTimeout
        window.setTimeout = (handler, delay, ...rest) =>
          original(handler, delay === 2000 ? 2147483647 : delay, ...rest)
      }`)
      // Only the suggestions endpoint (a glob would also hold the `lib/suggestions.ts` module).
      await page.route(
        (url) => /^\/productions\/[^/]+\/suggestions$/.test(url.pathname),
        async (route) => {
          await new Promise<void>((resolve) => releaseSuggestions.push(resolve))
          await route.continue().catch(() => {})
        }
      )
    },
    reach: async (page) => {
      await atLeast(page, 'section[aria-busy="true"]', 1)
    },
    include: 'main section[aria-busy="true"]',
    stillThere: async (page) => {
      await atLeast(page, 'section[aria-busy="true"]', 1)
    },
    after: () => {
      for (const release of releaseSuggestions) release()
      releaseSuggestions = []
    },
  },
]

test.group('Accessibilité | axe sur les états ouverts / fermés (13.2)', (group) => {
  group.setup(() =>
    setupData(async (seeded) => {
      fixtures = seeded
      const authors = []
      for (let index = 0; index < 21; index++) {
        authors.push(await createAuthor(`Auteur${String.fromCharCode(65 + index)}`, 'Foule'))
      }
      await createPublished('Ouvrage collectif fictif', { authors, daysAgo: 6 })
      crowd = authors
    })
  )

  for (const state of STATES) {
    for (const locale of LOCALES) {
      test(`${state.name} (${locale}) : 0 violation A/AA`, async ({ assert, browserContext }) => {
        await prepareContext(browserContext, locale)
        const page = await browserContext.newPage()
        await page.setViewportSize(state.viewport)
        if (state.before) await state.before(page)
        await page.goto(state.url())
        // No `networkidle` here: the held suggestions request would end the busy state.
        await page.locator('main').first().waitFor()
        await atLeast(page, `a:text-is("${TRANSLATIONS[locale].a11y.skip_to_content}")`, 1)
        await state.reach(page)
        try {
          const failures = await audit(
            page,
            `${state.name} (${locale})`,
            state.disabledRules,
            state.include
          )
          // No nested control in any state (Story 13.4), whole document; the hit test is left to
          // the full pages (an open listbox or panel legitimately covers the cards).
          const nested = await structure(page, `${state.name} (${locale})`, false)
          failures.push(...nested.failures)
          if (state.stillThere) await state.stillThere(page)
          assert.isTrue(failures.length === 0, failures.join('\n'))
        } finally {
          state.after?.()
        }
      })
    }
  }
})
