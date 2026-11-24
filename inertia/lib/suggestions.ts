/**
 * Suggestions de productions similaires (Story 12.4, FR61, D22, P2.4) : chargement par
 * `fetch` après le rendu de la page, abandon à 2 000 ms, mémoïsation par slug dans une `Map`
 * du module (aucun nouveau chargement au retour arrière). Module pur, sans import : chargé
 * tel quel par les tests à l'exécution (frontière TS6305).
 */

/** Délai au-delà duquel la section est retirée sans message (D22). */
export const SUGGESTIONS_TIMEOUT_MS = 2000

/** Cartes affichées au plus (FR61) ; aussi le nombre de squelettes. */
export const SUGGESTIONS_MAX = 4

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>

export type LoadSuggestionsOptions = {
  /** URL de l'endpoint (`urlFor('production.suggestions', { slug })`). */
  url: string
  /** Injecté par les tests ; `fetch` global par défaut. */
  fetchImpl?: FetchLike
  timeoutMs?: number
  /** Abandon par l'appelant (démontage) : résultat `null`, rien de mémorisé. */
  signal?: AbortSignal
}

// Vit jusqu'au rechargement complet de la page (navigation Inertia = même module).
const cache = new Map<string, unknown[]>()

/** Résultat mémorisé pour ce slug, `undefined` s'il n'a jamais été chargé. */
export function cachedSuggestions<T = unknown>(slug: string): T[] | undefined {
  return cache.get(slug) as T[] | undefined
}

/** Vide la mémoïsation (tests). */
export function clearSuggestionsCache(): void {
  cache.clear()
}

/** `{ results: [...] }` → au plus 4 objets ; toute autre forme → `[]`. */
function parseResults(body: unknown): unknown[] {
  if (typeof body !== 'object' || body === null) return []
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results
    .filter((item) => typeof item === 'object' && item !== null)
    .slice(0, SUGGESTIONS_MAX)
}

/**
 * Charge les suggestions d'un slug. Succès → cartes (≤ 4) ; erreur HTTP, réseau, JSON
 * invalide ou délai dépassé → `[]` (la section est retirée, D22) ; dans les deux cas le
 * résultat est mémorisé (D-12.4-5). Abandon par l'appelant → `null`, non mémorisé : la
 * prochaine visite recharge.
 */
export async function loadSuggestions<T = unknown>(
  slug: string,
  options: LoadSuggestionsOptions
): Promise<T[] | null> {
  const cached = cache.get(slug)
  if (cached) return cached as T[]
  if (options.signal?.aborted) return null

  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(onAbort, options.timeoutMs ?? SUGGESTIONS_TIMEOUT_MS)

  let results: unknown[]
  try {
    const response = await fetchImpl(options.url, { signal: controller.signal })
    results = response.ok ? parseResults(await response.json()) : []
  } catch {
    results = []
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }

  if (options.signal?.aborted) return null
  cache.set(slug, results)
  return results as T[]
}
