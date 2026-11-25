import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Story 12.4 — comportement du helper pur `inertia/lib/suggestions.ts` (fetch, abandon à
 * 2 000 ms, mémoïsation par slug, D22, D-12.4-5). Chargé à l'exécution par une URL calculée
 * (frontière TS6305) ; `fetch` et le délai sont injectés : aucune horloge réelle serrée.
 */
type Card = { id: string; title: string }
type LoadOptions = {
  url: string
  fetchImpl?: (input: string, init?: { signal?: AbortSignal }) => Promise<Response>
  timeoutMs?: number
  signal?: AbortSignal
}
type SuggestionsModule = {
  SUGGESTIONS_TIMEOUT_MS: number
  SUGGESTIONS_MAX: number
  cachedSuggestions: (slug: string) => Card[] | undefined
  clearSuggestionsCache: () => void
  loadSuggestions: (slug: string, options: LoadOptions) => Promise<Card[] | null>
}

const load = async (): Promise<SuggestionsModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/suggestions.ts')).href)

const card = (n: number): Card => ({ id: `id-${n}`, title: `Titre ${n}` })
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Counts calls and records the signal given to `fetch`. */
function fakeFetch(answer: (signal?: AbortSignal) => Promise<Response>) {
  const calls: { url: string; signal?: AbortSignal }[] = []
  const impl = (url: string, init?: { signal?: AbortSignal }) => {
    calls.push({ url, signal: init?.signal })
    return answer(init?.signal)
  }
  return { impl, calls }
}

/** A `fetch` that never answers until its signal aborts (then rejects like the real one). */
const hanging = (signal?: AbortSignal) =>
  new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })

test.group('suggestions | helper pur (12.4)', (group) => {
  group.each.setup(async () => {
    const { clearSuggestionsCache } = await load()
    clearSuggestionsCache()
  })

  test('constantes : délai de 2 000 ms, 4 cartes au plus', async ({ assert }) => {
    const { SUGGESTIONS_TIMEOUT_MS, SUGGESTIONS_MAX } = await load()
    assert.equal(SUGGESTIONS_TIMEOUT_MS, 2000)
    assert.equal(SUGGESTIONS_MAX, 4)
  })

  test('succès : résultats renvoyés, mémorisés par slug, un seul fetch au retour', async ({
    assert,
  }) => {
    const { loadSuggestions, cachedSuggestions } = await load()
    const fetch = fakeFetch(async () => json({ results: [card(1), card(2)] }))
    const url = '/productions/a/suggestions'

    assert.isUndefined(cachedSuggestions('a'))
    assert.deepEqual(await loadSuggestions('a', { url, fetchImpl: fetch.impl }), [card(1), card(2)])
    assert.deepEqual(cachedSuggestions('a'), [card(1), card(2)])
    assert.deepEqual(await loadSuggestions('a', { url, fetchImpl: fetch.impl }), [card(1), card(2)])
    assert.lengthOf(fetch.calls, 1)
    assert.equal(fetch.calls[0].url, url)
    assert.instanceOf(fetch.calls[0].signal, AbortSignal)
    assert.isUndefined(cachedSuggestions('b'))
  })

  test('0 résultat → [] mémorisé', async ({ assert }) => {
    const { loadSuggestions, cachedSuggestions } = await load()
    const fetch = fakeFetch(async () => json({ results: [] }))
    assert.deepEqual(await loadSuggestions('z', { url: '/z', fetchImpl: fetch.impl }), [])
    assert.deepEqual(cachedSuggestions('z'), [])
  })

  test('coupé à 4 cartes ; éléments non objets ignorés', async ({ assert }) => {
    const { loadSuggestions } = await load()
    const fetch = fakeFetch(async () =>
      json({ results: [card(1), null, 'x', card(2), card(3), card(4), card(5)] })
    )
    const results = await loadSuggestions('c', { url: '/c', fetchImpl: fetch.impl })
    assert.deepEqual(results, [card(1), card(2), card(3), card(4)])
  })

  test('erreur HTTP, réseau ou JSON invalide → [] (section retirée), mémorisé', async ({
    assert,
  }) => {
    const { loadSuggestions, cachedSuggestions } = await load()
    const cases: [string, () => Promise<Response>][] = [
      ['http', async () => json({ error: 'not_found' }, 404)],
      ['server', async () => json({ results: [card(1)] }, 500)],
      ['network', async () => Promise.reject(new TypeError('Failed to fetch'))],
      ['invalid', async () => new Response('<html>', { status: 200 })],
      ['shape', async () => json({ data: [card(1)] })],
    ]
    for (const [slug, answer] of cases) {
      const fetch = fakeFetch(answer)
      assert.deepEqual(await loadSuggestions(slug, { url: '/x', fetchImpl: fetch.impl }), [], slug)
      assert.deepEqual(cachedSuggestions(slug), [], slug)
    }
  })

  test('délai dépassé → abandon du fetch, [] (aucun nouveau chargement ensuite)', async ({
    assert,
  }) => {
    const { loadSuggestions, cachedSuggestions } = await load()
    const fetch = fakeFetch(hanging)
    const results = await loadSuggestions('slow', {
      url: '/s',
      fetchImpl: fetch.impl,
      timeoutMs: 5,
    })
    assert.deepEqual(results, [])
    assert.isTrue(fetch.calls[0].signal?.aborted)
    assert.deepEqual(cachedSuggestions('slow'), [])
  })

  test('abandon par l’appelant (démontage) → null, rien de mémorisé', async ({ assert }) => {
    const { loadSuggestions, cachedSuggestions } = await load()
    const fetch = fakeFetch(hanging)
    const controller = new AbortController()
    const pending = loadSuggestions('gone', {
      url: '/g',
      fetchImpl: fetch.impl,
      signal: controller.signal,
      timeoutMs: 60_000,
    })
    controller.abort()
    assert.isNull(await pending)
    assert.isTrue(fetch.calls[0].signal?.aborted)
    assert.isUndefined(cachedSuggestions('gone'))
  })

  test('signal déjà abandonné → null sans fetch', async ({ assert }) => {
    const { loadSuggestions } = await load()
    const fetch = fakeFetch(async () => json({ results: [card(1)] }))
    const controller = new AbortController()
    controller.abort()
    assert.isNull(
      await loadSuggestions('pre', { url: '/p', fetchImpl: fetch.impl, signal: controller.signal })
    )
    assert.lengthOf(fetch.calls, 0)
  })
})
