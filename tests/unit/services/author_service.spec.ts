import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import AuthorService from '#services/author_service'

// Fictitious names only (public repository).

const PAYLOAD = {
  lastNames: 'Fictif',
  firstNames: 'Jean',
  affiliations: [{ institution: 'Université Exemple' }],
}

test.group('AuthorService | create', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('slug taken between the check and the insert → retried with a fresh slug', async ({
    assert,
    cleanup,
  }) => {
    await Author.create({ firstNames: 'Jean', lastNames: 'Fictif' })

    // Simulates a concurrent create: the first check returns a slug that is already taken.
    const original = Author.generateUniqueSlug
    let calls = 0
    Author.generateUniqueSlug = async (author: Author) => {
      calls++
      return calls === 1 ? 'jean-fictif' : original.call(Author, author)
    }
    cleanup(() => {
      Author.generateUniqueSlug = original
    })

    const author = await AuthorService.create(PAYLOAD, null)
    assert.equal(author.slug, 'jean-fictif-2')
    assert.equal(calls, 2)
    await author.load('affiliations')
    assert.lengthOf(author.affiliations, 1)
  })

  test('other database errors are not retried', async ({ assert, cleanup }) => {
    const original = Author.generateUniqueSlug
    let calls = 0
    Author.generateUniqueSlug = async () => {
      calls++
      return 'x'.repeat(300) // > varchar(255)
    }
    cleanup(() => {
      Author.generateUniqueSlug = original
    })

    await assert.rejects(() => AuthorService.create(PAYLOAD, null))
    assert.equal(calls, 1)
  })
})

async function createAuthor(firstNames: string, lastNames: string, institutions: string[]) {
  return AuthorService.create(
    { firstNames, lastNames, affiliations: institutions.map((institution) => ({ institution })) },
    null
  )
}

async function linkToNewProduction(author: Author) {
  const production = await Production.create({
    title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
    status: 'draft',
    authorNames: [],
    tags: [],
    licenseStatus: 'member',
  })
  await production.related('authors').attach({ [author.id]: { position: 1 } })
  return production
}

test.group('AuthorService | delete (Story 9.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('card without production → deleted with its affiliations', async ({ assert }) => {
    const author = await createAuthor('Éloïse', 'Fictive', [
      'Université Exemple',
      'École Imaginaire',
    ])

    const result = await AuthorService.delete(author)

    assert.deepEqual(result, { deleted: true })
    assert.isNull(await Author.find(author.id))
    assert.lengthOf(await AuthorAffiliation.query().where('authorId', author.id), 0)
  })

  test('card linked to a draft → refused, card intact', async ({ assert }) => {
    const author = await createAuthor('Jean Marc', 'Exemple', ['Université Exemple'])
    await linkToNewProduction(author)

    const result = await AuthorService.delete(author)

    assert.deepEqual(result, { deleted: false, productionsCount: 1 })
    assert.isNotNull(await Author.find(author.id))
    assert.lengthOf(await AuthorAffiliation.query().where('authorId', author.id), 1)
    assert.equal(await AuthorService.productionsCount(author.id), 1)
  })

  test('FK violation (23503) is translated into the refusal, never thrown', async ({
    assert,
    cleanup,
  }) => {
    const author = await createAuthor('Paul', 'Inventé', ['Université Exemple'])
    await linkToNewProduction(author)

    // Simulates a link inserted after the check: the count says 0, the FK refuses.
    const original = AuthorService.productionsCount
    let calls = 0
    AuthorService.productionsCount = async (id, client) => {
      calls++
      return calls === 1 ? 0 : original.call(AuthorService, id, client)
    }
    cleanup(() => {
      AuthorService.productionsCount = original
    })

    const result = await AuthorService.delete(author)
    assert.deepEqual(result, { deleted: false, productionsCount: 1 })
    assert.isNotNull(await Author.find(author.id))
  })
})

test.group('AuthorService | list helpers (Story 9.2)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('quickFilterCounts: not public and without affiliation', async ({ assert }) => {
    const publicCard = await createAuthor('Éloïse', 'Fictive', ['Université Exemple'])
    publicCard.consentConfirmedAt = DateTime.now()
    await publicCard.save()
    await createAuthor('Jean Marc', 'Exemple', ['Université Exemple'])
    await Author.create({ firstNames: 'Paul', lastNames: 'Inventé' })

    assert.deepEqual(await AuthorService.quickFilterCounts(), { consentPending: 2, incomplete: 1 })
  })

  test('institutionOptions: one option per key, most frequent spelling', async ({ assert }) => {
    await createAuthor('Éloïse', 'Fictive', ['École Imaginaire'])
    await createAuthor('Jean Marc', 'Exemple', ['ECOLE IMAGINAIRE'])
    await createAuthor('Paul', 'Inventé', ['École Imaginaire', 'Institut Fictif'])

    assert.deepEqual(await AuthorService.institutionOptions(), [
      { value: 'ecole imaginaire', label: 'École Imaginaire' },
      { value: 'institut fictif', label: 'Institut Fictif' },
    ])
  })

  test('institutionOptions: an empty key (combining marks only) is not an option', async ({
    assert,
  }) => {
    await createAuthor('Éloïse', 'Fictive', ['\u0301'])
    assert.deepEqual(await AuthorService.institutionOptions(), [])
  })

  test('applyListFilters: a term emptied by normalization matches nothing', async ({ assert }) => {
    await createAuthor('Éloïse', 'Fictive', ['Université Exemple'])
    const query = Author.query()
    AuthorService.applyListFilters(query, {
      q: '-',
      institution: null,
      consent: null,
      incomplete: false,
    })
    assert.lengthOf(await query, 0)
  })

  test('applyListFilters + applyListOrder: word prefix ranked first', async ({ assert }) => {
    // Sans q, « Bexel » passerait avant « Zulu » (tri par nom).
    await createAuthor('Exelle', 'Zulu', ['Université Exemple'])
    await createAuthor('Ana', 'Bexel', ['Université Exemple'])
    await createAuthor('Jean', 'Autre', ['Université Exemple'])

    const query = Author.query()
    AuthorService.applyListFilters(query, {
      q: 'EXE',
      institution: null,
      consent: null,
      incomplete: false,
    })
    AuthorService.applyListOrder(query, 'EXE')
    const rows = await query
    const names = rows.map((a) => a.lastNames)
    assert.deepEqual(names, ['Zulu', 'Bexel'])
  })
})
