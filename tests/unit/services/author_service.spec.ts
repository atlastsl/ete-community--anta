import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Author from '#models/author'
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
