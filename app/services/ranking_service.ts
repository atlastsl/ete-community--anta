import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import ProductionStatus from '#enums/production_status'

/** Items of a ranked home block (FR45). */
export const RANKING_SIZE = 3
/** Lifetime of a cached ranking (P2.3, P2-06). */
export const RANKING_TTL_MS = 10 * 60 * 1000

/** Cached rankings: productions (Story 12.2) and authors (Story 12.3), same invalidation. */
export type RankingKey = 'mostViewed' | 'mostDownloaded' | 'topAuthors'

type Entry = { ids: string[]; expiresAt: number }

/**
 * Process-local cache of ordered ids with a TTL (P2.3: one Node process per environment).
 * - Concurrent misses on one key share the same in-flight computation (no stampede after an
 *   expiry or an invalidation); a rejected computation is forgotten, never cached.
 * - `invalidate()` bumps a generation: a computation that started before it is served to its
 *   callers but never stored, and later callers start a fresh one, so a render racing a commit
 *   cannot cache the state from before it (D-12.2-2).
 * The clock is injectable for the tests.
 */
export class RankingCache {
  private entries = new Map<RankingKey, Entry>()
  private inflight = new Map<RankingKey, { generation: number; promise: Promise<string[]> }>()
  private generation = 0

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {}

  get(key: RankingKey, compute: () => Promise<string[]>): Promise<string[]> {
    const entry = this.entries.get(key)
    if (entry && entry.expiresAt > this.now()) return Promise.resolve(entry.ids)
    const flight = this.inflight.get(key)
    if (flight && flight.generation === this.generation) return flight.promise

    const generation = this.generation
    let started: Promise<string[]>
    try {
      started = compute() // started synchronously: concurrent callers find it in `inflight`
    } catch (error) {
      started = Promise.reject(error)
    }
    const promise = started.then((ids) => {
      if (generation === this.generation) {
        this.entries.set(key, { ids, expiresAt: this.now() + this.ttlMs })
      }
      return ids
    })
    const current = { generation, promise }
    this.inflight.set(key, current)
    // Settled (resolved or rejected): forgotten, unless a newer flight replaced it.
    const forget = () => {
      if (this.inflight.get(key) === current) this.inflight.delete(key)
    }
    promise.then(forget, forget)
    return promise
  }

  invalidate(): void {
    this.entries.clear()
    this.inflight.clear()
    this.generation++
  }

  /** Keys holding a live entry (tests, diagnostics). */
  keys(): RankingKey[] {
    const now = this.now()
    return [...this.entries].filter(([, entry]) => entry.expiresAt > now).map(([key]) => key)
  }
}

/** Knex transactor: `parentTransaction` (set by knex on a savepoint) and `executionPromise`. */
type KnexTransactor = {
  parentTransaction?: KnexTransactor
  executionPromise?: Promise<unknown>
}

const cache = new RankingCache(RANKING_TTL_MS)

/** Stats table of a production ranking and its date column. */
const WINDOWS = {
  mostViewed: { table: 'stats_views', column: 'recorded_at' },
  mostDownloaded: { table: 'stats_downloads', column: 'downloaded_at' },
} as const satisfies Record<'mostViewed' | 'mostDownloaded', { table: string; column: string }>

/**
 * Home rankings (Story 12.2, P2.3, FR45, FR46, D4, D5): views or downloads of the last 365
 * rolling days, computed by Postgres. Only ordered ids are cached; the cards are hydrated on
 * every render with the totals (`HomeController`). No static model or service import: the
 * mutation services import this one (no cycle); `topAuthorIds` loads its query lazily.
 */
export default class RankingService {
  /** Published productions most viewed over 365 days (0 in the window: excluded). */
  static mostViewedIds(): Promise<string[]> {
    return cache.get('mostViewed', () => this.windowRanking('mostViewed'))
  }

  /** Published productions most downloaded over 365 days (0 in the window: excluded). */
  static mostDownloadedIds(): Promise<string[]> {
    return cache.get('mostDownloaded', () => this.windowRanking('mostDownloaded'))
  }

  /**
   * Visible authors most viewed over 365 days (Story 12.3, D36). The query lives with the
   * visibility rule (`PublicAuthorService.topViewedAuthorIds`, `Author.visibleOnSite`), imported
   * lazily: a static import would close the cycle `PublicAuthorService` → `AuthorService` → here
   * (D-12.3-1).
   */
  static topAuthorIds(): Promise<string[]> {
    return cache.get('topAuthors', async () => {
      const { default: PublicAuthorService } = await import('#services/public_author_service')
      return PublicAuthorService.topViewedAuthorIds(RANKING_SIZE)
    })
  }

  /** Empties every cached ranking now. Prefer `invalidateAfterCommit` inside a transaction. */
  static invalidate(): void {
    cache.invalidate()
  }

  /**
   * Invalidates once the caller's transaction commits (nothing on rollback): invalidating
   * inside it would let a concurrent render cache the state from before the commit
   * (D-12.2-3). Without a pending transaction: immediately.
   *
   * Savepoints: Lucid runs `after('commit')` of a nested transaction when the savepoint is
   * released, before the outer COMMIT, and a Lucid transaction keeps no link to its parent.
   * Knex does (`parentTransaction`, undocumented), and exposes `executionPromise`, settled by
   * the outermost COMMIT or ROLLBACK (indistinguishable: `doNotRejectOnRollback`). So a nested
   * call invalidates twice: on the release, then once the outermost transaction ends (a
   * rollback only costs a cache miss). If a knex upgrade drops these fields, only the release
   * hook remains (pinned by `ranking_service.spec.ts`).
   */
  static invalidateAfterCommit(client?: QueryClientContract | TransactionClientContract): void {
    if (!client?.isTransaction || (client as TransactionClientContract).isCompleted) {
      this.invalidate()
      return
    }
    const trx = client as TransactionClientContract
    trx.after('commit', () => this.invalidate())

    const own = trx.knexClient as unknown as KnexTransactor
    let root = own
    while (root.parentTransaction) root = root.parentTransaction
    if (root !== own && root.executionPromise) {
      const invalidate = () => this.invalidate()
      root.executionPromise.then(invalidate, invalidate)
    }
  }

  /** Keys currently cached (tests). */
  static cachedKeys(): RankingKey[] {
    return cache.keys()
  }

  /**
   * Inner join on the window (D5), order: window count ↓, `anta_published_at` ↓, `id` ↑
   * (P2.3). Table and column names come from `WINDOWS`, never from input.
   */
  private static async windowRanking(key: keyof typeof WINDOWS): Promise<string[]> {
    const { table, column } = WINDOWS[key]
    const result = await db.rawQuery(
      `SELECT p.id, count(*) AS window_count
         FROM productions p
         JOIN ${table} s ON s.production_id = p.id AND s.${column} >= now() - interval '365 days'
        WHERE p.status = ?
        GROUP BY p.id
        ORDER BY window_count DESC, p.anta_published_at DESC NULLS LAST, p.id ASC
        LIMIT ?`,
      [ProductionStatus.PUBLISHED, RANKING_SIZE]
    )
    return (result.rows as { id: string }[]).map((row) => row.id)
  }
}
