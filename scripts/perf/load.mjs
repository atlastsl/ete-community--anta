#!/usr/bin/env node
/**
 * Load test of the public site (Story 12.5, NFR20: 50 simultaneous visitors on search and
 * filters, p95 < 1 s). No dependency: Node >= 18 (global `fetch`, `performance`).
 *
 * Usage:
 *   node scripts/perf/load.mjs <baseUrl> [visitors=50] [requestsPerVisitor=20] [pool=mix]
 *                              [thinkMinMs=0] [thinkMaxMs=0] [wave=0]
 *   BASE_URL=<baseUrl> node scripts/perf/load.mjs   (base URL from the environment instead)
 *
 *   pool   search | filters | mix (search + filters) | home | detail | suggestions
 *          detail / suggestions need SLUGS=slug-a,slug-b,... (published productions).
 *   think  pause between two requests of a visitor, uniform in [thinkMinMs, thinkMaxMs]
 *          (0 0 = saturation: every visitor always has a request in flight).
 *   wave   1 = the visitors fire together, then all wait for the slowest (synchronized bursts).
 *
 * Examples (as measured in story 12.5):
 *   node scripts/perf/load.mjs http://127.0.0.1:3333 50 20 search 1000 3000   # visitors with pauses
 *   node scripts/perf/load.mjs http://127.0.0.1:3333 50 40 filters            # saturation
 *   node scripts/perf/load.mjs http://127.0.0.1:3333 50 10 mix 1000 1000 1    # bursts of 50
 *
 * Prints one JSON line: requests, errors (non-200 or network), throughput, p50 / p95 / p99 / max
 * in ms. Only GET requests; never point it at a shared environment without its owner's consent.
 *
 * URLs (relative to the base URL):
 *   search : /productions?q=topologie, ?q=histoire, ?q=intelligence%20artificielle,
 *            ?q=genetique&sort=views, ?q=economie&page=2, ?q=manuel%20ecologie,
 *            ?q=algebre&sort=downloads, ?q=linguistique%20bantoue
 *   filters: /productions?category=thesis, ?domain=mathematics&sort=views,
 *            ?domain=history&language=fr, ?category=report&category=article&sort=downloads,
 *            ?language=en&page=3, ?country=Mali&sort=date,
 *            ?domain=linguistics&category=conference_proceedings, ?license=free_license&q=analyse
 *   home   : /
 *   detail : /productions/<slug> ; suggestions : /productions/<slug>/suggestions
 */
const args = process.argv.slice(2)
const base = (args[0] && /^https?:\/\//.test(args[0]) ? args.shift() : process.env.BASE_URL) ?? ''
const [visitors = '50', perVisitor = '20', poolName = 'mix', tmin = '0', tmax = '0', wave = '0'] =
  args
if (!/^https?:\/\//.test(base)) {
  console.error('Base URL required: first argument or BASE_URL (e.g. http://127.0.0.1:3333).')
  process.exit(2)
}

const slugs = (process.env.SLUGS ?? '').split(',').filter(Boolean)
const pools = {
  search: [
    '/productions?q=topologie',
    '/productions?q=histoire',
    '/productions?q=intelligence%20artificielle',
    '/productions?q=genetique&sort=views',
    '/productions?q=economie&page=2',
    '/productions?q=manuel%20ecologie',
    '/productions?q=algebre&sort=downloads',
    '/productions?q=linguistique%20bantoue',
  ],
  filters: [
    '/productions?category=thesis',
    '/productions?domain=mathematics&sort=views',
    '/productions?domain=history&language=fr',
    '/productions?category=report&category=article&sort=downloads',
    '/productions?language=en&page=3',
    '/productions?country=Mali&sort=date',
    '/productions?domain=linguistics&category=conference_proceedings',
    '/productions?license=free_license&q=analyse',
  ],
  home: ['/'],
  detail: slugs.map((slug) => `/productions/${encodeURIComponent(slug)}`),
  suggestions: slugs.map((slug) => `/productions/${encodeURIComponent(slug)}/suggestions`),
}
pools.mix = [...pools.search, ...pools.filters]
const pool = pools[poolName]
if (!pool || pool.length === 0) {
  console.error(`Unknown or empty pool "${poolName}" (detail / suggestions need SLUGS).`)
  process.exit(2)
}

const root = base.replace(/\/+$/, '')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const think = () => sleep(Number(tmin) + Math.random() * (Number(tmax) - Number(tmin)))
const latencies = []
let errors = 0

async function hit(path) {
  const start = performance.now()
  try {
    const response = await fetch(root + path)
    await response.arrayBuffer()
    if (response.status !== 200) errors++
  } catch {
    errors++
  }
  latencies.push(performance.now() - start)
}

async function visitor(index) {
  await sleep(Math.random() * Number(tmax)) // staggered arrivals
  for (let i = 0; i < Number(perVisitor); i++) {
    if (i > 0) await think()
    await hit(pool[(index + i) % pool.length])
  }
}

const started = performance.now()
if (wave === '1') {
  for (let i = 0; i < Number(perVisitor); i++) {
    await Promise.all(
      Array.from({ length: Number(visitors) }, (_, w) => hit(pool[(w + i) % pool.length]))
    )
    await think()
  }
} else {
  await Promise.all(Array.from({ length: Number(visitors) }, (_, w) => visitor(w)))
}
const seconds = (performance.now() - started) / 1000

latencies.sort((a, b) => a - b)
const quantile = (p) =>
  Math.round(latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)])
console.log(
  JSON.stringify({
    pool: poolName,
    visitors: Number(visitors),
    think: `${tmin}-${tmax}`,
    wave: wave === '1',
    requests: latencies.length,
    errors,
    rps: Number((latencies.length / seconds).toFixed(1)),
    p50: quantile(50),
    p95: quantile(95),
    p99: quantile(99),
    max: Math.round(latencies.at(-1)),
  })
)
