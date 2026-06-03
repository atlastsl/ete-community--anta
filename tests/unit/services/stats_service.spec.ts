import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import StatsDownload from '#models/stats_download'
import StatsView from '#models/stats_view'
import StatsService from '#services/stats_service'

async function createProduction() {
  return Production.create({
    title: `Stats ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'published',
    authors: [],
    tags: [],
    subdomain: [],
    licenseStatus: 'member',
  })
}

test.group('StatsService | recordDownload', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('insère une ligne avec ip_hash sha256 (jamais l’IP brute)', async ({ assert }) => {
    const prod = await createProduction()
    await StatsService.recordDownload(prod.id, '203.0.113.42')

    const row = await StatsDownload.query().where('production_id', prod.id).firstOrFail()
    assert.isNotNull(row.ipHash)
    assert.match(row.ipHash!, /^[a-f0-9]{64}$/)
    assert.notEqual(row.ipHash, '203.0.113.42')
  })

  test('IP absente → ip_hash null', async ({ assert }) => {
    const prod = await createProduction()
    await StatsService.recordDownload(prod.id, null)

    const row = await StatsDownload.query().where('production_id', prod.id).firstOrFail()
    assert.isNull(row.ipHash)
  })

  test('même IP → même hash (déterministe)', async ({ assert }) => {
    const prod = await createProduction()
    await StatsService.recordDownload(prod.id, '198.51.100.7')
    await StatsService.recordDownload(prod.id, '198.51.100.7')

    const rows = await StatsDownload.query().where('production_id', prod.id)
    assert.lengthOf(rows, 2)
    assert.equal(rows[0].ipHash, rows[1].ipHash)
  })
})

test.group('StatsService | recordView', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('insère stats_views avec ip_hash haché + session_id', async ({ assert }) => {
    const prod = await createProduction()
    await StatsService.recordView(prod.id, '203.0.113.9', 'sess-abc')

    const row = await StatsView.query().where('production_id', prod.id).firstOrFail()
    assert.match(row.ipHash!, /^[a-f0-9]{64}$/)
    assert.notEqual(row.ipHash, '203.0.113.9')
    assert.equal(row.sessionId, 'sess-abc')
  })

  test('IP nulle → ip_hash null', async ({ assert }) => {
    const prod = await createProduction()
    await StatsService.recordView(prod.id, null, null)

    const row = await StatsView.query().where('production_id', prod.id).firstOrFail()
    assert.isNull(row.ipHash)
    assert.isNull(row.sessionId)
  })
})

test.group('StatsService | productionStats', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('totaux + viewsByDay (30 entrées, somme = vues récentes)', async ({ assert }) => {
    const prod = await createProduction()
    for (let i = 0; i < 5; i++) await StatsService.recordView(prod.id, `1.2.3.${i}`)
    for (let i = 0; i < 2; i++) await StatsService.recordDownload(prod.id, `4.5.6.${i}`)

    const stats = await StatsService.productionStats(prod.id)
    assert.equal(stats.totalViews, 5)
    assert.equal(stats.totalDownloads, 2)
    assert.lengthOf(stats.viewsByDay, 30)
    const sum = stats.viewsByDay.reduce((acc, d) => acc + d.count, 0)
    assert.equal(sum, 5) // toutes les vues sont d'aujourd'hui (fenêtre 30j)
    // la dernière entrée = aujourd'hui
    assert.equal(stats.viewsByDay[29].count, 5)
  })

  test('production sans stat → totaux 0 + 30 entrées à 0', async ({ assert }) => {
    const prod = await createProduction()
    const stats = await StatsService.productionStats(prod.id)
    assert.equal(stats.totalViews, 0)
    assert.equal(stats.totalDownloads, 0)
    assert.lengthOf(stats.viewsByDay, 30)
    assert.equal(
      stats.viewsByDay.reduce((acc, d) => acc + d.count, 0),
      0
    )
  })
})

test.group('StatsService | libraryStats', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  // Assertions robustes à la pollution de la BDD locale partagée : delta sur les totaux
  // (et non valeurs absolues), tri décroissant et longueurs — vrai quel que soit l'existant.
  test('totaux (delta), top triés desc, évolution 30 entrées', async ({ assert }) => {
    const before = await StatsService.libraryStats()

    const prod = await createProduction()
    await StatsService.recordView(prod.id, 'a')
    await StatsService.recordView(prod.id, 'b')
    await StatsService.recordDownload(prod.id, 'c')

    const after = await StatsService.libraryStats()

    assert.equal(after.totalPublished, before.totalPublished + 1)
    assert.equal(after.totalViews, before.totalViews + 2)
    assert.equal(after.totalDownloads, before.totalDownloads + 1)

    assert.lengthOf(after.evolution, 30)
    assert.isAtMost(after.topViewed.length, 10)
    assert.isAtMost(after.topDownloaded.length, 10)

    for (let i = 1; i < after.topViewed.length; i++) {
      assert.isAtLeast(after.topViewed[i - 1].views, after.topViewed[i].views)
    }
    for (let i = 1; i < after.topDownloaded.length; i++) {
      assert.isAtLeast(after.topDownloaded[i - 1].downloads, after.topDownloaded[i].downloads)
    }
  }).timeout(20000) // agrégation lourde contre la BDD locale (Supabase distant) — instantané en CI

  test('une production très consultée remonte en tête de topViewed', async ({ assert }) => {
    const star = await createProduction()
    // 100 vues > max du seeder de démo (randInt 0..80) → garantit la 1re place même en local pollué.
    // Insert groupé (un seul INSERT) pour rester sous le timeout 2000ms de la suite unit.
    await StatsView.createMany(
      Array.from({ length: 100 }, (_, i) => ({
        productionId: star.id,
        recordedAt: DateTime.now(),
        ipHash: `s${i}`,
      }))
    )

    const stats = await StatsService.libraryStats()
    assert.equal(stats.topViewed[0].id, star.id)
    assert.isAtLeast(stats.topViewed[0].views, 100)
  }).timeout(20000) // agrégation lourde contre la BDD locale (Supabase distant) — instantané en CI

  test('évolution agrégée : le bucket du jour reflète les nouvelles vues/téléchargements', async ({
    assert,
  }) => {
    const prod = await createProduction()
    const before = await StatsService.libraryStats()

    for (let i = 0; i < 3; i++) await StatsService.recordView(prod.id, `tv${i}`)
    for (let i = 0; i < 2; i++) await StatsService.recordDownload(prod.id, `td${i}`)

    const after = await StatsService.libraryStats()
    // evolution[29] = aujourd'hui (delta robuste à la pollution).
    assert.equal(after.evolution[29].views, before.evolution[29].views + 3)
    assert.equal(after.evolution[29].downloads, before.evolution[29].downloads + 2)
  }).timeout(20000)
})
