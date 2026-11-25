import { test } from '@japa/runner'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from 'playwright'
import {
  LOCALES,
  TRANSLATIONS,
  atLeast,
  openPage,
  prepareContext,
  setupData,
  visit,
  suggestionsLoaded,
  type Fixtures,
  type Locale,
} from './helpers/public_fixtures.js'

/**
 * Story 13.2 (NFR16, D33, D36) — keyboard journeys and structure of the public pages, in French
 * and in English: skip link, full Tab sweep (visible focus on every stop, no keyboard trap),
 * single h1 / no skipped heading level / unique landmarks, `lang` of the contents, and the
 * automated parcours 1 (search → author filter → card → detail → download) and 2 (home → banner
 * → top authors → profile → production → suggestion → language switch).
 *
 * Data and browser confinement: `helpers/public_fixtures.ts` (global transaction, fake R2, only
 * the local origin reachable). Embedded players (`iframe`, `video`, `audio`) draw their own focus
 * inside the browser UI: they are counted as stops but their focus ring is not measured.
 */

let fixtures: Fixtures

const VIEWPORT = { width: 1280, height: 800 }
const MAX_STOPS = 150

type FocusState = {
  tag: string
  text: string
  href: string | null
  /** Outline ≥ 2 px, or a ring (box-shadow `0 0 0 ≥2px`) on the element, its `::after` or its card. */
  visible: boolean
  /** Rendered (not clipped to 1 px like `sr-only`). */
  width: number
  height: number
  embedded: boolean
  /** Overflow ancestor(s) cutting the element's own outline (diagnostic). */
  clippedBy: string
  inMain: boolean
  inFooter: boolean
}

/** Evaluated in the page (string: the server `lib` has no DOM types). */
const FOCUS_SCRIPT = `(() => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  // Zero-alpha colours: rgba(…, 0), oklch(… / 0), transparent.
  const transparent = (color) =>
    !color || color === 'transparent' || /,\\s*0\\)$/.test(color) || /\\/\\s*0\\)$/.test(color)
  // Outline (with its offset) of the node cut by an overflow ancestor?
  const clipped = (node, extent) => {
    const r = node.getBoundingClientRect()
    for (let p = node.parentElement; p && p !== document.body; p = p.parentElement) {
      const st = getComputedStyle(p)
      if (st.overflowX === 'visible' && st.overflowY === 'visible') continue
      const b = p.getBoundingClientRect()
      const left = b.left + p.clientLeft, top = b.top + p.clientTop
      const right = left + p.clientWidth, bottom = top + p.clientHeight
      if (r.left - extent < left - 0.5 || r.right + extent > right + 0.5 ||
          r.top - extent < top - 0.5 || r.bottom + extent > bottom + 0.5) return p
    }
    return null
  }
  const clips = []
  const ring = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo)
    if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 &&
        !transparent(style.outlineColor)) {
      if (pseudo) return true
      const extent = Math.max(0, parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth))
      const cut = clipped(node, extent)
      if (!cut) return true
      clips.push(cut.tagName.toLowerCase() + '.' + String(cut.className).split(' ').slice(0, 3).join('.'))
      return false
    }
    // Rings: a solid "0 0 0 ≥2px" box-shadow that is neither transparent nor the white offset.
    const shadows = (style.boxShadow || '').split(/,(?![^(]*\\))/)
    return shadows.some((shadow) => {
      const spread = /0px 0px 0px ([0-9.]+)px/.exec(shadow)
      const color = shadow.replace(/\\s*(-?[0-9.]+px\\s*)+(inset)?\\s*$/, '').trim()
      return !!spread && parseFloat(spread[1]) >= 2 && !transparent(color) &&
        !shadow.includes('rgb(255, 255, 255)')
    })
  }
  const card = el.closest('article')
  const rect = el.getBoundingClientRect()
  return {
    tag: el.tagName,
    text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
    href: el.getAttribute('href'),
    visible: ring(el) || ring(el, '::after') || (!!card && ring(card)),
    clippedBy: clips.join(', '),
    width: rect.width,
    height: rect.height,
    embedded: ['IFRAME', 'VIDEO', 'AUDIO'].includes(el.tagName),
    inMain: !!el.closest('main'),
    inFooter: !!el.closest('footer'),
  }
})()`

/** Focus state, polled briefly: shadcn rings animate their box-shadow (150 ms transition). */
async function focusState(page: Page): Promise<FocusState | null> {
  let state = (await page.evaluate(FOCUS_SCRIPT)) as FocusState | null
  for (let attempt = 0; state && !state.visible && !state.embedded && attempt < 5; attempt++) {
    await page.waitForTimeout(80)
    state = (await page.evaluate(FOCUS_SCRIPT)) as FocusState | null
  }
  return state
}

/** Does the focused element satisfy a JS predicate on `el` (evaluated in the page)? */
async function focused(page: Page, predicate: string): Promise<boolean> {
  return (await page.evaluate(
    `(() => { const el = document.activeElement; return !!el && el !== document.body && !!(${predicate}) })()`
  )) as boolean
}

const describe = (state: FocusState | null) =>
  state
    ? `<${state.tag.toLowerCase()}> « ${state.text} »${state.href ? ` (${state.href})` : ''}`
    : 'body'

/**
 * Presses Tab until the focused element satisfies `predicate`; every stop on the way must show
 * a visible focus (embedded players excepted). Returns the stops, the last one being the target.
 */
async function tabTo(
  page: Page,
  predicate: string,
  label: string,
  max = MAX_STOPS
): Promise<FocusState[]> {
  const stops: FocusState[] = []
  for (let index = 0; index < max; index++) {
    await page.keyboard.press('Tab')
    const state = await focusState(page)
    // Body: Tab left the document (after its last stop) or started from a removed element (after
    // an Inertia visit); the next Tab wraps to the first stop.
    if (!state) continue
    if (!state.embedded && !state.visible) {
      const cut = state.clippedBy ? `, outline clipped by ${state.clippedBy}` : ''
      throw new Error(`no visible focus on ${describe(state)}${cut} (looking for ${label})`)
    }
    stops.push(state)
    if (await focused(page, predicate)) return stops
  }
  throw new Error(
    `${label} not reached in ${max} Tab presses; last stops: ${stops
      .slice(-5)
      .map(describe)
      .join(' → ')}`
  )
}

async function waitForPath(page: Page, prefix: string) {
  await page.waitForURL((url) => url.pathname.startsWith(prefix))
  await page.waitForLoadState('networkidle')
  await page.locator('main').first().waitFor()
}

type PageCase = { name: string; url: () => string; ready?: (page: Page) => Promise<void> }

const PAGES: PageCase[] = [
  { name: 'accueil', url: () => '/' },
  {
    name: 'listing avec filtres actifs',
    url: () => `/productions?q=fictive&category=article&author=${fixtures.author.slug}`,
  },
  { name: 'détail PDF', url: () => `/productions/${fixtures.pdf.slug}`, ready: suggestionsLoaded },
  {
    name: 'détail EPUB',
    url: () => `/productions/${fixtures.epub.slug}`,
    ready: suggestionsLoaded,
  },
  {
    name: 'détail vidéo',
    url: () => `/productions/${fixtures.video.slug}`,
    ready: suggestionsLoaded,
  },
  {
    name: 'détail audio',
    url: () => `/productions/${fixtures.audio.slug}`,
    ready: suggestionsLoaded,
  },
  { name: 'liste des auteurs', url: () => '/authors' },
  { name: 'profil', url: () => `/authors/${fixtures.author.slug}` },
  { name: 'politique de confidentialité', url: () => '/privacy-policy' },
  { name: 'page 404', url: () => '/cette-page-n-existe-pas' },
]

/** Heading levels in document order, landmarks counted outside sectioning content. */
const STRUCTURE_SCRIPT = `(() => {
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({
    level: Number(h.tagName[1]),
    text: (h.textContent || '').trim().slice(0, 60),
  }))
  const top = (selector) =>
    [...document.querySelectorAll(selector)].filter(
      (el) => !el.parentElement.closest('article, aside, main, nav, section')
    ).length
  return {
    headings,
    banner: top('header'),
    main: document.querySelectorAll('main').length,
    contentinfo: top('footer'),
  }
})()`

/** axe best-practice rules about landmarks and headings (13.1 review defer). */
const STRUCTURE_RULES = [
  'region',
  'landmark-one-main',
  'landmark-unique',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-no-duplicate-main',
  'landmark-banner-is-top-level',
  'landmark-contentinfo-is-top-level',
  'landmark-main-is-top-level',
  'landmark-complementary-is-top-level',
  'page-has-heading-one',
  'heading-order',
  'empty-heading',
  'skip-link',
]

type Structure = {
  headings: { level: number; text: string }[]
  banner: number
  main: number
  contentinfo: number
}

function structureErrors(structure: Structure): string[] {
  const errors: string[] = []
  const h1 = structure.headings.filter((h) => h.level === 1)
  if (h1.length !== 1) errors.push(`${h1.length} h1 (${h1.map((h) => h.text).join(' | ')})`)
  if (structure.headings[0]?.level !== 1) errors.push(`first heading is not the h1`)
  structure.headings.forEach((heading, index) => {
    const previous = structure.headings[index - 1]
    if (previous && heading.level > previous.level + 1) {
      errors.push(`h${previous.level} « ${previous.text} » → h${heading.level} « ${heading.text} »`)
    }
  })
  if (structure.banner !== 1) errors.push(`${structure.banner} header landmark(s)`)
  if (structure.main !== 1) errors.push(`${structure.main} main`)
  if (structure.contentinfo !== 1) errors.push(`${structure.contentinfo} footer landmark(s)`)
  return errors
}

test.group('Accessibilité | clavier et structure des pages publiques (13.2)', (group) => {
  group.setup(() =>
    setupData((seeded) => {
      fixtures = seeded
    })
  )

  for (const locale of LOCALES) {
    test(`lien d'évitement, balayage Tab sans piège, titres et landmarks (${locale})`, async ({
      assert,
      browserContext,
    }) => {
      const failures: string[] = []
      await prepareContext(browserContext, locale)
      for (const pageCase of PAGES) {
        const { page } = await visit(browserContext, locale, pageCase.url())
        await page.setViewportSize(VIEWPORT)
        if (pageCase.ready) await pageCase.ready(page)
        const where = `${pageCase.name} (${locale})`

        // Structure.
        const structure = (await page.evaluate(STRUCTURE_SCRIPT)) as Structure
        for (const error of structureErrors(structure)) failures.push(`${where}: ${error}`)
        // axe best-practice structure rules (outside the WCAG tags of 13.1, deferred to 13.2).
        // Embedded frames excluded: with the fake disk, the PDF frame shows a local Anta page
        // (its own header / footer), an artefact of the test data.
        const practice = await new AxeBuilder({ page })
          .withRules(STRUCTURE_RULES)
          .exclude('iframe')
          .analyze()
        for (const violation of practice.violations) {
          failures.push(
            `${where}: axe ${violation.id} on ${violation.nodes.map((n) => n.target.join(' ')).join(', ')}`
          )
        }

        // Skip link: first Tab stop, visible, moves the focus to <main>.
        await page.keyboard.press('Tab')
        const first = await focusState(page)
        if (first?.href !== '#main-content' || first.width < 10 || first.height < 10) {
          failures.push(`${where}: first Tab stop is ${describe(first)}, not a visible skip link`)
        } else if (first.text !== TRANSLATIONS[locale].a11y.skip_to_content) {
          failures.push(`${where}: skip link text « ${first.text} »`)
        }
        await page.keyboard.press('Enter')
        if (!(await focused(page, `el.id === 'main-content'`))) {
          failures.push(`${where}: the skip link does not move the focus to <main>`)
        }
        // Next stop: after <main>'s start (in it, or the footer when it has no control), never
        // back in the header.
        await page.keyboard.press('Tab')
        if (!(await focused(page, `el.closest('main, footer')`))) {
          failures.push(`${where}: the Tab after the skip link does not continue from <main>`)
        }
        const afterSkip = await focusState(page)
        if (afterSkip && !afterSkip.embedded && !afterSkip.visible) {
          failures.push(`${where}: no visible focus on ${describe(afterSkip)}`)
        }

        // Full sweep: every stop shows its focus, the last footer link is reached (no trap).
        try {
          await tabTo(page, `el.matches('footer a[href^="mailto:"]')`, 'the footer contact link')
        } catch (error) {
          failures.push(`${where}: ${(error as Error).message}`)
        }
        await page.close()
      }
      assert.isTrue(failures.length === 0, failures.join('\n'))
    })

    test(`langue des contenus : attribut lang et <html lang> (${locale})`, async ({
      assert,
      browserContext,
    }) => {
      const other = locale === 'fr' ? 'en' : 'fr'
      // Home: the video (English) in French, the French productions in English.
      const { page } = await openPage(browserContext, locale, '/')
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      await atLeast(page, `main section:has(> h2.sr-only) article h3[lang="${other}"]`, 1)
      await atLeast(page, `main article h3 a[lang="${other}"]`, 1)
      assert.equal(await page.locator(`main [lang="${locale}"]`).count(), 0)

      // Detail: h1, summary and breadcrumb only when the language differs.
      const differs = locale === 'fr' ? fixtures.video : fixtures.pdf
      const same = locale === 'fr' ? fixtures.pdf : fixtures.video
      await page.goto(`/productions/${differs.slug}`)
      await page.locator('main h1').waitFor()
      assert.equal(await page.locator('main h1').getAttribute('lang'), other)
      await atLeast(page, `main p[lang="${other}"]`, 1)
      await atLeast(page, `nav li[aria-current="page"][lang="${other}"]`, 1)
      await page.goto(`/productions/${same.slug}`)
      await page.locator('main h1').waitFor()
      assert.isNull(await page.locator('main h1').getAttribute('lang'))

      // Language switch without reload: <html lang> follows, the contents swap their `lang`.
      await page.locator(`header button:text-is("${other.toUpperCase()}")`).click()
      await page.waitForFunction(`document.documentElement.lang === '${other}'`)
      assert.equal(await page.locator('main h1').getAttribute('lang'), locale)
      await atLeast(page, `footer h2:text-is("${TRANSLATIONS[other].footer.explore}")`, 1)
      await page.close()
    })

    test(`liste de tri : ouverte, parcourue et choisie au clavier, Échap sans piège (${locale})`, async ({
      assert,
      browserContext,
    }) => {
      const { page } = await openPage(browserContext, locale, '/authors')
      await page.setViewportSize(VIEWPORT)
      await tabTo(page, `el.id === 'authors-sort'`, 'the sort trigger')
      // Escape closes the listbox and gives the focus back to its trigger (no trap).
      await page.keyboard.press('Enter')
      await page.locator('[role="option"]:focus').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('[role="listbox"]').waitFor({ state: 'detached' })
      assert.isTrue(await focused(page, `el.id === 'authors-sort'`))
      // Arrows + Enter choose another sort (URL updated); the focus stays on the trigger.
      await page.keyboard.press('Enter')
      // Radix focuses the selected option once the listbox is positioned (possibly twice):
      // let it settle, as a person would, before moving.
      await page.locator('[role="option"][aria-selected="true"]:focus').waitFor()
      await page.waitForTimeout(300)
      const current = await page.locator('[role="option"]:focus').textContent()
      await page.keyboard.press('ArrowDown')
      await page.locator(`[role="option"]:focus:not(:text-is("${current}"))`).waitFor()
      // The focused option shows a 2 px outline, not only a faint background (review 13.2).
      const option = await focusState(page)
      assert.isTrue(option?.visible, `no visible focus on the option ${describe(option)}`)
      const chosen = await page.locator('[role="option"]:focus').textContent()
      await page.keyboard.press('Enter')
      await page
        .waitForFunction(`location.search.includes('sort=')`, undefined, { timeout: 10_000 })
        .catch(async () => {
          const state = await focusState(page)
          throw new Error(
            `sort « ${chosen} » not applied: ${page.url()}, focus on ${describe(state)}`
          )
        })
      await page.waitForLoadState('networkidle')
      assert.isTrue(
        await focused(page, `el.id === 'authors-sort'`),
        'the focus must stay on the sort trigger after the visit'
      )
      await page.close()
    })

    test(`parcours 1 au clavier : recherche → filtre auteur → carte → détail → téléchargement (${locale})`, async ({
      assert,
      browserContext,
    }) => {
      const strings = TRANSLATIONS[locale]
      const { page } = await openPage(browserContext, locale, '/')
      await page.setViewportSize(VIEWPORT)

      // Home → « Recherche avancée » (FR44) → /productions.
      await tabTo(
        page,
        `el.matches('main a[href="/productions"]') && el.textContent.trim() === ${JSON.stringify(strings.home.hero.advanced_search)}`,
        'Recherche avancée'
      )
      await page.keyboard.press('Enter')
      await waitForPath(page, '/productions')

      // Search.
      await tabTo(
        page,
        `el.matches('main form[role="search"] input[type="search"]')`,
        'the search field'
      )
      await page.keyboard.type('espaces')
      await page.keyboard.press('Enter')
      await page.waitForURL((url) => url.searchParams.get('q') === 'espaces')
      await page.waitForLoadState('networkidle')

      // Author dimension expanded (Enter on the summary), facet search, toggle with Space (flux 5).
      await tabTo(
        page,
        `el.matches('main aside summary') && el.textContent.includes(${JSON.stringify(strings.filters.dimensions.author)})`,
        'the author filter group'
      )
      await page.keyboard.press('Enter')
      await page.keyboard.press('Tab')
      assert.isTrue(
        await focused(page, `el.matches('main aside details[open] input[type="search"]')`)
      )
      await page.keyboard.type('Awa')
      await page.keyboard.press('Tab')
      assert.isTrue(
        await focused(
          page,
          `el.matches('a[role="button"][aria-pressed="false"]') && el.textContent.includes('Awa')`
        )
      )
      await page.keyboard.press(' ')
      await page.waitForURL((url) =>
        url.searchParams.getAll('author').includes(fixtures.author.slug)
      )
      await page.waitForLoadState('networkidle')
      await atLeast(page, 'main a[role="button"][aria-pressed="true"]', 1)
      // The result count is announced (polite status region).
      const status = await page.locator('main p[role="status"]').textContent()
      assert.equal(status, strings.productions.results_count.replace('{{count}}', '1'))

      // First card: the title, then its authors (reading order).
      await tabTo(page, `el.matches('main article h3 a')`, 'the first card title')
      const title = await focusState(page)
      await page.keyboard.press('Tab')
      assert.isTrue(
        await focused(page, `el.matches('main article a[href^="/authors/"]')`),
        'the Tab after a card title must reach its authors'
      )
      await page.keyboard.press('Shift+Tab')
      assert.isTrue(await focused(page, `el.matches('main article h3 a')`))
      await page.keyboard.press('Enter')
      await waitForPath(page, `/productions/${fixtures.pdf.slug}`)
      assert.equal(await page.locator('main h1').textContent(), title?.text)

      // Detail: Tab through the PDF reader up to « Télécharger ».
      const stops = await tabTo(
        page,
        `el.matches('main a[href$="/download"]') && el.textContent.trim() === ${JSON.stringify(strings.media.download)}`,
        'the download link'
      )
      assert.isTrue(
        stops.some((stop) => stop.tag === 'IFRAME'),
        `the PDF reader is not a Tab stop: ${stops.map(describe).join(' → ')}`
      )
      const download = stops.at(-1)!
      assert.isTrue(download.visible)
      assert.isAtLeast(download.height, 44)
      await page.close()
    })

    test(`parcours 2 au clavier : accueil → bannière → auteurs → profil → production → suggestion (${locale})`, async ({
      assert,
      browserContext,
    }) => {
      const other: Locale = locale === 'fr' ? 'en' : 'fr'
      const { page } = await openPage(browserContext, locale, '/')
      await page.setViewportSize(VIEWPORT)

      // Banner: the title (stretched link, the card is outlined), then its authors.
      await tabTo(page, `el.matches('[data-featured-link]')`, 'the first banner title')
      const outlined = (await page.evaluate(
        `getComputedStyle(document.activeElement.closest('article')).outlineStyle`
      )) as string
      assert.equal(outlined, 'solid', 'the banner card is outlined when its title is focused')
      await page.keyboard.press('Tab')
      assert.isTrue(
        await focused(page, `el.matches('main article a[href^="/authors/"]') && !el.closest('h3')`),
        'the Tab after a banner title must reach its authors'
      )

      // Home blocks (flux 1, step 2): « Voir plus » of « Récemment publiées » with its full
      // accessible name, then a card title of the block, then its authors.
      const strings = TRANSLATIONS[locale]
      const seeMore = strings.home.blocks.see_more_named.replace(
        '{{title}}',
        strings.home.blocks.recent
      )
      await tabTo(
        page,
        `el.matches('main section[aria-labelledby] a[href="/productions?sort=date"]') && el.querySelector('.sr-only').textContent === ${JSON.stringify(seeMore)}`,
        'Voir plus : Récemment publiées'
      )
      await tabTo(
        page,
        `el.matches('main section[aria-labelledby] article h3 a') && !el.closest('section:has(> h2.sr-only)')`,
        'a card title of the home blocks'
      )
      await page.keyboard.press('Tab')
      assert.isTrue(
        await focused(page, `el.matches('main article a[href^="/authors/"]') && !el.closest('h3')`),
        'the Tab after a block card title must reach its authors'
      )

      // « Auteurs les plus consultés » → profile (stretched link, ring on the card).
      await tabTo(page, `el.matches('main section h3 > a[href^="/authors/"]')`, 'a top author card')
      const ringed = (await page.evaluate(
        `getComputedStyle(document.activeElement, '::after').boxShadow`
      )) as string
      assert.match(
        ringed,
        /oklch\([^)]*\) 0px 0px 0px [3-9]px/,
        'the author card is outlined when focused'
      )
      const authorCard = await focusState(page)
      const authorName = authorCard?.text
      await page.keyboard.press('Enter')
      await waitForPath(page, '/authors/')
      assert.equal(await page.locator('main h1').textContent(), authorName)

      // Profile: Google Scholar (new tab announced), then a production.
      await tabTo(page, `el.matches('main a[target="_blank"][href*="scholar"]')`, 'Google Scholar')
      await tabTo(page, `el.matches('main article h3 a')`, 'a production of the profile')
      await page.keyboard.press('Enter')
      await waitForPath(page, '/productions/')
      const firstDetail = page.url()
      await suggestionsLoaded(page)
      const announce = await page.locator('main section p[aria-live]').textContent()
      assert.match(announce ?? '', /\d/, 'the suggestions count is announced')

      // Download (flux 1, step 5), through the reader: reached, focus visible, ≥ 44 px.
      const toDownload = await tabTo(
        page,
        `el.matches('main a[href$="/download"]') && el.textContent.trim() === ${JSON.stringify(strings.media.download)}`,
        'the download link'
      )
      const download = toDownload.at(-1)!
      assert.isTrue(download.visible)
      assert.isAtLeast(download.height, 44)

      // A suggestion (compact card), reached through the reader(s) and the download links.
      await tabTo(
        page,
        `el.matches('main section article h3 a') && el.closest('section').querySelector('p[aria-live]')`,
        'a suggestion'
      )
      await page.keyboard.press('Enter')
      await page.waitForURL(
        (url) => url.href !== firstDetail && url.pathname.startsWith('/productions/')
      )
      await page.locator('main h1').waitFor()

      // Language switch by keyboard (FR41): <html lang> and the interface follow.
      await tabTo(
        page,
        `el.matches('header button') && el.textContent.trim() === '${other.toUpperCase()}'`,
        'the language switcher'
      )
      await page.keyboard.press('Enter')
      await page.waitForFunction(`document.documentElement.lang === '${other}'`)
      await atLeast(page, `footer h2:text-is("${TRANSLATIONS[other].footer.explore}")`, 1)
      await page.close()
    })
  }
})
