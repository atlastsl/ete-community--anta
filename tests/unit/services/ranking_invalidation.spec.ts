import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Production from '#models/production'
import RankingService from '#services/ranking_service'
import ProductionAuthorService from '#services/production_author_service'
import ProductionService from '#services/production_service'
import AuthorService from '#services/author_service'

/**
 * Story 12.2 (AC 5, P2.3): every listed mutation empties the ranking cache, after the commit
 * only. Fictitious data (public repository).
 */

let counter = 0

async function primeCache() {
  await RankingService.mostViewedIds()
  await RankingService.mostDownloadedIds()
  await RankingService.topAuthorIds()
}

const isPrimed = () => RankingService.cachedKeys().length > 0

async function createAuthor(consent = false) {
  const n = counter++
  return AuthorService.create(
    {
      firstNames: `Awa${n}`,
      lastNames: `Fictive${n}`,
      affiliations: [{ institution: 'Université Exemple' }],
      consent,
    },
    null
  )
}

async function createProduction(status: 'draft' | 'published' = 'published') {
  return Production.create({
    title: `Production ${counter++}`,
    status,
    authorNames: [],
    tags: [],
    licenseStatus: 'member',
    antaPublishedAt: status === 'published' ? DateTime.now() : null,
    createdById: null,
  })
}

test.group('RankingService | invalidation par les mutations', (group) => {
  group.each.setup(async () => {
    RankingService.invalidate()
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('sync : pivot modifié → invalidé après le commit, pas avant', async ({ assert }) => {
    const production = await createProduction()
    const author = await createAuthor()
    await primeCache()

    await db.transaction(async (trx) => {
      await ProductionAuthorService.sync(production.id, [author.id], trx)
      assert.isTrue(isPrimed(), 'still cached inside the transaction')
    })
    assert.isFalse(isPrimed())
  })

  test('sync : pivot inchangé → cache conservé (D-12.2-6)', async ({ assert }) => {
    const production = await createProduction()
    const author = await createAuthor()
    await db.transaction((trx) => ProductionAuthorService.sync(production.id, [author.id], trx))
    await primeCache()

    await db.transaction((trx) => ProductionAuthorService.sync(production.id, [author.id], trx))
    assert.isTrue(isPrimed())
  })

  test('sync annulé → cache conservé', async ({ assert }) => {
    const production = await createProduction()
    const author = await createAuthor()
    await primeCache()

    await assert.rejects(() =>
      db.transaction(async (trx) => {
        await ProductionAuthorService.sync(production.id, [author.id], trx)
        throw new Error('rollback')
      })
    )
    assert.isTrue(isPrimed())
  })

  test('publish (dans une transaction) → après le commit', async ({ assert }) => {
    const production = await createProduction('draft')
    await primeCache()

    await db.transaction(async (trx) => {
      production.useTransaction(trx)
      await ProductionService.publish(production)
      assert.isTrue(isPrimed())
    })
    assert.isFalse(isPrimed())
  })

  test('publish (hors transaction) → immédiat', async ({ assert }) => {
    const production = await createProduction('draft')
    await primeCache()
    await ProductionService.publish(production)
    assert.isFalse(isPrimed())
  })

  test('unpublish et delete', async ({ assert }) => {
    const production = await createProduction()
    await primeCache()
    await ProductionService.unpublish(production, null as unknown as string)
    assert.isFalse(isPrimed())

    await primeCache()
    await ProductionService.delete(production, null as unknown as string)
    assert.isFalse(isPrimed())
  })

  test('confirmation du consentement → invalidé ; déjà public → conservé', async ({ assert }) => {
    const author = await createAuthor()
    await primeCache()
    assert.equal(await AuthorService.confirmConsent(author, null as unknown as string), 'confirmed')
    assert.isFalse(isPrimed())

    await primeCache()
    assert.equal(await AuthorService.confirmConsent(author, null as unknown as string), 'unchanged')
    assert.isTrue(isPrimed())
  })

  test('retrait du consentement → invalidé ; déjà non public → conservé', async ({ assert }) => {
    const author = await createAuthor(true)
    await primeCache()
    assert.equal(await AuthorService.withdrawConsent(author), 'withdrawn')
    assert.isFalse(isPrimed())

    await primeCache()
    assert.equal(await AuthorService.withdrawConsent(author), 'unchanged')
    assert.isTrue(isPrimed())
  })

  test('topAuthors (12.3) : même cache, vidé par le retrait du consentement', async ({
    assert,
  }) => {
    const author = await createAuthor(true)
    await primeCache()
    assert.sameMembers(RankingService.cachedKeys(), ['mostViewed', 'mostDownloaded', 'topAuthors'])
    await AuthorService.withdrawConsent(author)
    assert.deepEqual(RankingService.cachedKeys(), [])
  })

  test('modification d’une fiche → invalidé ; sans changement → conservé', async ({ assert }) => {
    const author = await createAuthor()
    const payload = {
      firstNames: author.firstNames,
      lastNames: author.lastNames,
      affiliations: [{ institution: 'Université Exemple' }],
    }
    await primeCache()
    await AuthorService.update(author, payload)
    assert.isTrue(isPrimed(), 'nothing written')

    await AuthorService.update(author, { ...payload, lastNames: 'Renommée' })
    assert.isFalse(isPrimed())
  })

  test('case « consentement » cochée dans la modification → invalidé', async ({ assert }) => {
    const author = await createAuthor()
    await primeCache()
    const result = await AuthorService.update(author, {
      firstNames: author.firstNames,
      lastNames: author.lastNames,
      affiliations: [{ institution: 'Université Exemple' }],
      consent: true,
    })
    assert.isTrue(result.consentConfirmed)
    assert.isFalse(isPrimed())
  })

  test('suppression d’une fiche → invalidé ; refusée (liée) → conservé', async ({ assert }) => {
    const linked = await createAuthor()
    const production = await createProduction()
    await db.transaction((trx) => ProductionAuthorService.sync(production.id, [linked.id], trx))
    await primeCache()
    const refused = await AuthorService.delete(linked)
    assert.isFalse(refused.deleted)
    assert.isTrue(isPrimed())

    const free = await createAuthor()
    const deleted = await AuthorService.delete(free)
    assert.isTrue(deleted.deleted)
    assert.isFalse(isPrimed())
  })
})
