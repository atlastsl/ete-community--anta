import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import RankingService, { RankingCache, RANKING_TTL_MS } from '#services/ranking_service'

/** Fake clock: tests never depend on the wall clock. */
function clock(start = 1_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

test.group('RankingCache | TTL', () => {
  test('TTL de 10 min', ({ assert }) => {
    assert.equal(RANKING_TTL_MS, 10 * 60 * 1000)
  })

  test('mémorise le résultat jusqu’à l’expiration, puis recalcule', async ({ assert }) => {
    const time = clock()
    const cache = new RankingCache(RANKING_TTL_MS, time.now)
    let calls = 0
    const compute = async () => {
      calls++
      return [`id-${calls}`]
    }

    assert.deepEqual(await cache.get('mostViewed', compute), ['id-1'])
    time.advance(RANKING_TTL_MS - 1)
    assert.deepEqual(await cache.get('mostViewed', compute), ['id-1'])
    assert.equal(calls, 1)

    time.advance(1)
    assert.deepEqual(await cache.get('mostViewed', compute), ['id-2'])
    assert.equal(calls, 2)
  })

  test('une entrée par clé', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    await cache.get('mostViewed', async () => ['a'])
    assert.deepEqual(await cache.get('mostDownloaded', async () => ['b']), ['b'])
    assert.sameMembers(cache.keys(), ['mostViewed', 'mostDownloaded'])
  })

  test('une liste vide est aussi mémorisée', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    let calls = 0
    const compute = async () => {
      calls++
      return []
    }
    await cache.get('mostViewed', compute)
    await cache.get('mostViewed', compute)
    assert.equal(calls, 1)
  })
})

test.group('RankingCache | invalidate', () => {
  test('invalidate() vide toutes les clés', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    await cache.get('mostViewed', async () => ['a'])
    await cache.get('mostDownloaded', async () => ['b'])
    cache.invalidate()
    assert.deepEqual(cache.keys(), [])
    assert.deepEqual(await cache.get('mostViewed', async () => ['c']), ['c'])
  })

  test('un calcul commencé avant invalidate() n’est pas mémorisé (D-12.2-2)', async ({
    assert,
  }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    let release!: () => void
    const pending = cache.get(
      'mostViewed',
      () =>
        new Promise<string[]>((resolve) => {
          release = () => resolve(['stale'])
        })
    )
    cache.invalidate()
    release()
    assert.deepEqual(await pending, ['stale']) // served once…
    assert.deepEqual(cache.keys(), []) // …never cached
    assert.deepEqual(await cache.get('mostViewed', async () => ['fresh']), ['fresh'])
  })

  test('appels concurrents sur une clé froide → un seul calcul partagé', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    let calls = 0
    let release!: () => void
    const compute = () => {
      calls++
      return new Promise<string[]>((resolve) => {
        release = () => resolve(['a'])
      })
    }
    const pending = [1, 2, 3].map(() => cache.get('mostViewed', compute))
    release()
    assert.deepEqual(await Promise.all(pending), [['a'], ['a'], ['a']])
    assert.equal(calls, 1)
    // Another key is not shared.
    await cache.get('mostDownloaded', async () => ['b'])
    assert.equal(calls, 1)
  })

  test('calcul en vol rejeté : partagé par les appelants, puis oublié', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    let calls = 0
    let fail!: () => void
    const failing = () => {
      calls++
      return new Promise<string[]>((_, reject) => {
        fail = () => reject(new Error('boom'))
      })
    }
    const first = cache.get('mostViewed', failing)
    const second = cache.get('mostViewed', failing)
    fail()
    await assert.rejects(() => first)
    await assert.rejects(() => second)
    assert.equal(calls, 1)
    assert.deepEqual(await cache.get('mostViewed', async () => ['ok']), ['ok'])
  })

  test('invalidate() pendant un calcul : les nouveaux appelants en lancent un autre', async ({
    assert,
  }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    const releases: Array<() => void> = []
    const compute = (value: string) => () =>
      new Promise<string[]>((resolve) => {
        releases.push(() => resolve([value]))
      })
    const stale = cache.get('mostViewed', compute('stale'))
    cache.invalidate()
    const fresh = cache.get('mostViewed', compute('fresh'))
    const shared = cache.get('mostViewed', compute('never'))
    assert.lengthOf(releases, 2) // stale + fresh; the third caller joined `fresh`
    releases[0]()
    releases[1]()
    assert.deepEqual(await stale, ['stale'])
    assert.deepEqual(await fresh, ['fresh'])
    assert.deepEqual(await shared, ['fresh'])
    assert.deepEqual(await cache.get('mostViewed', compute('later')), ['fresh']) // cached
  })

  test('une erreur de calcul ne mémorise rien', async ({ assert }) => {
    const cache = new RankingCache(RANKING_TTL_MS, clock().now)
    await assert.rejects(() =>
      cache.get('mostViewed', async () => {
        throw new Error('boom')
      })
    )
    assert.deepEqual(cache.keys(), [])
  })
})

test.group('RankingService | invalidateAfterCommit', (group) => {
  group.each.setup(async () => {
    RankingService.invalidate()
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sans transaction → invalidation immédiate', async ({ assert }) => {
    await RankingService.mostViewedIds()
    assert.include(RankingService.cachedKeys(), 'mostViewed')
    RankingService.invalidateAfterCommit()
    assert.deepEqual(RankingService.cachedKeys(), [])
  })

  test('dans une transaction → après le commit seulement', async ({ assert }) => {
    await RankingService.mostViewedIds()
    await db.transaction(async (trx) => {
      RankingService.invalidateAfterCommit(trx)
      assert.include(RankingService.cachedKeys(), 'mostViewed')
    })
    assert.deepEqual(RankingService.cachedKeys(), [])
  })

  test('transaction annulée → cache conservé', async ({ assert }) => {
    await RankingService.mostViewedIds()
    await assert.rejects(() =>
      db.transaction(async (trx) => {
        RankingService.invalidateAfterCommit(trx)
        throw new Error('rollback')
      })
    )
    assert.include(RankingService.cachedKeys(), 'mostViewed')
  })
})

// Without the global test transaction: a real outer COMMIT / ROLLBACK (no data written).
test.group('RankingService | invalidateAfterCommit dans un savepoint', (group) => {
  group.each.setup(() => RankingService.invalidate())

  test('savepoint relâché puis COMMIT externe → invalidé aux deux moments', async ({ assert }) => {
    await RankingService.mostViewedIds()
    await db.transaction(async (outer) => {
      await outer.transaction(async (inner) => {
        RankingService.invalidateAfterCommit(inner)
      })
      // Released savepoint: Lucid's hook already ran.
      assert.deepEqual(RankingService.cachedKeys(), [])
      // A render between the release and the outer COMMIT re-caches the old state…
      await RankingService.mostViewedIds()
      assert.include(RankingService.cachedKeys(), 'mostViewed')
    })
    // …and the outermost COMMIT empties it again (knex `executionPromise`).
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(RankingService.cachedKeys(), [])
  })

  test('savepoint annulé → ni le hook de commit ni d’invalidation immédiate', async ({
    assert,
  }) => {
    await RankingService.mostViewedIds()
    await db.transaction(async (outer) => {
      await assert.rejects(() =>
        outer.transaction(async (inner) => {
          RankingService.invalidateAfterCommit(inner)
          throw new Error('rollback')
        })
      )
      assert.include(RankingService.cachedKeys(), 'mostViewed')
    })
  })
})
