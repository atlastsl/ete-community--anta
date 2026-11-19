import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Author from '#models/author'
import AuthorAffiliation from '#models/author_affiliation'
import Production from '#models/production'
import AdminUser from '#models/admin_user'
import { errors as vineErrors } from '@vinejs/vine'
import AuthorService from '#services/author_service'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import FileStorageService from '#services/file_storage_service'
import ImageService, { type ImageVariant } from '#services/image_service'

// Fictitious names only (public repository).

/** Colonnes de consentement relues en base. */
async function consentOf(id: string) {
  const author = await Author.findOrFail(id)
  return { at: author.consentConfirmedAt, by: author.consentConfirmedById }
}

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

/** Variants of a generated image (no real photo in the public repository). */
async function photoVariants(): Promise<ImageVariant[]> {
  const input = await sharp({
    create: { width: 200, height: 150, channels: 3, background: { r: 10, g: 120, b: 60 } },
  })
    .png()
    .toBuffer()
  return ImageService.authorPhotoVariants(input)
}

/** Every key stored on the fake disk under `authors/`. */
async function storedKeys(): Promise<string[]> {
  const { objects } = await drive.use('r2').listAll('authors', { recursive: true })
  return Array.from(objects)
    .filter((o) => o.isFile)
    .map((o) => (o as { key: string }).key)
    .sort()
}

test.group('AuthorService | photo (Story 9.3)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    drive.fake('r2')
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })

  test('create with photo → variants under authors/<id>/<token>, photo_key = prefix', async ({
    assert,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null, await photoVariants())
    assert.match(author.photoKey!, new RegExp(`^authors/${author.id}/[A-Za-z0-9_-]{20}$`))
    assert.deepEqual(await storedKeys(), AuthorService.photoKeys(author.photoKey!).sort())
    const saved = await Author.findOrFail(author.id)
    assert.equal(saved.photoKey, author.photoKey)
  })

  test('create failing after the upload → new variants removed, error thrown', async ({
    assert,
    cleanup,
  }) => {
    const original = Author.generateUniqueSlug
    Author.generateUniqueSlug = async () => {
      throw new Error('database down')
    }
    cleanup(() => {
      Author.generateUniqueSlug = original
    })

    await assert.rejects(
      async () => AuthorService.create(PAYLOAD, null, await photoVariants()),
      'database down'
    )
    assert.deepEqual(await storedKeys(), [])
  })

  test('one variant upload failing → the sent ones removed, nothing written', async ({
    assert,
    cleanup,
  }) => {
    const original = FileStorageService.putObject
    FileStorageService.putObject = async (key, body, contentType) => {
      if (key.endsWith('og.jpg')) throw new Error('R2 unavailable')
      return original.call(FileStorageService, key, body, contentType)
    }
    cleanup(() => {
      FileStorageService.putObject = original
    })

    await assert.rejects(
      async () => AuthorService.create(PAYLOAD, null, await photoVariants()),
      'R2 unavailable'
    )
    assert.deepEqual(await storedKeys(), [])
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
  })

  test('update failing in the transaction → new prefix removed, old photo kept', async ({
    assert,
    cleanup,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null, await photoVariants())
    const oldPrefix = author.photoKey!
    const original = AuthorService.replaceAffiliations
    AuthorService.replaceAffiliations = async () => {
      throw new Error('constraint')
    }
    cleanup(() => {
      AuthorService.replaceAffiliations = original
    })

    const fresh = await Author.findOrFail(author.id)
    await assert.rejects(
      async () =>
        AuthorService.update(
          fresh,
          { ...PAYLOAD, affiliations: [{ institution: 'Autre Université' }] },
          { photo: await photoVariants() }
        ),
      'constraint'
    )
    assert.deepEqual(await storedKeys(), AuthorService.photoKeys(oldPrefix).sort())
    const saved = await Author.findOrFail(author.id)
    assert.equal(saved.photoKey, oldPrefix)
  })

  test('replace → old variants deleted after the commit; delete failure only logged', async ({
    assert,
    cleanup,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null, await photoVariants())
    const oldPrefix = author.photoKey!

    const original = FileStorageService.deleteObjects
    FileStorageService.deleteObjects = async () => {
      throw new Error('R2 unavailable')
    }
    cleanup(() => {
      FileStorageService.deleteObjects = original
    })

    const { fields } = await AuthorService.update(await Author.findOrFail(author.id), PAYLOAD, {
      photo: await photoVariants(),
    })
    assert.deepEqual(fields, ['photo'])
    const saved = await Author.findOrFail(author.id)
    assert.notEqual(saved.photoKey, oldPrefix)
    // The deletion failed (logged): both prefixes remain, the request did not fail.
    assert.includeMembers(await storedKeys(), AuthorService.photoKeys(oldPrefix))
  })

  test('removePhoto without saved photo → no change, no field', async ({ assert }) => {
    const author = await AuthorService.create(PAYLOAD, null)
    const { fields } = await AuthorService.update(author, PAYLOAD, { removePhoto: true })
    assert.deepEqual(fields, [])
  })

  test('delete → variants removed after the deletion; refusal keeps them', async ({ assert }) => {
    const kept = await AuthorService.create(PAYLOAD, null, await photoVariants())
    await linkToNewProduction(kept)
    const gone = await AuthorService.create(
      { ...PAYLOAD, lastNames: 'Exemple' },
      null,
      await photoVariants()
    )

    assert.deepEqual(await AuthorService.delete(gone), { deleted: true })
    const refused = await AuthorService.delete(kept)
    assert.isFalse(refused.deleted)
    assert.deepEqual(await storedKeys(), AuthorService.photoKeys(kept.photoKey!).sort())
  })
})

test.group('AuthorService | consent (Story 9.4)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function admin(): Promise<AdminUser> {
    return AdminUser.create({
      email: `${Math.floor(Math.random() * 1_000_000)}@anta.test`,
      passwordHash: 'plain-password-hashed-by-mixin',
      role: 'admin',
      passwordChanged: true,
      isActive: true,
      createdById: null,
    })
  }

  test('create with consent → confirmed by the admin; without → not public', async ({ assert }) => {
    const a = await admin()
    const consented = await AuthorService.create({ ...PAYLOAD, consent: true }, a.id)
    assert.isNotNull(consented.consentConfirmedAt)
    assert.equal(consented.consentConfirmedById, a.id)
    const other = await AuthorService.create({ ...PAYLOAD, lastNames: 'Exemple' }, a.id)
    assert.isNull(other.consentConfirmedAt)
  })

  test('create with consent and no affiliation → refused in the service too (D27)', async ({
    assert,
  }) => {
    const a = await admin()
    await assert.rejects(
      () => AuthorService.create({ ...PAYLOAD, affiliations: [], consent: true }, a.id),
      vineErrors.E_VALIDATION_ERROR
    )
    assert.isNull(await Author.findBy('lastNames', 'Fictif'))
  })

  test('update: affiliations removed meanwhile (stale form) → consent refused under the lock', async ({
    assert,
  }) => {
    const a = await admin()
    const author = await Author.create({
      firstNames: 'Jean',
      lastNames: 'Fictif',
      migrationKey: 'jean-fictif-stale',
    })
    await AuthorAffiliation.create({ authorId: author.id, position: 1, institution: 'U' })
    const stale = await Author.findOrFail(author.id)
    // Another save removes the affiliation (allowed: migrated, not public) right after
    // `update` has read them, before its lock.
    const load = stale.load.bind(stale) as (relation: 'affiliations') => Promise<void>
    Object.assign(stale, {
      load: async (relation: 'affiliations') => {
        await load(relation)
        await AuthorAffiliation.query().where('authorId', author.id).delete()
      },
    })

    await assert.rejects(
      () =>
        AuthorService.update(
          stale,
          { ...PAYLOAD, affiliations: [{ institution: 'U' }], consent: true },
          { adminId: a.id }
        ),
      vineErrors.E_VALIDATION_ERROR
    )
    const saved = await Author.findOrFail(author.id)
    assert.isNull(saved.consentConfirmedAt)
  })

  test('confirmConsent → confirmed, then unchanged (same timestamp, same admin)', async ({
    assert,
  }) => {
    const [a, b] = [await admin(), await admin()]
    const author = await AuthorService.create(PAYLOAD, a.id)
    assert.equal(await AuthorService.confirmConsent(author, a.id), 'confirmed')
    const first = await Author.findOrFail(author.id)
    assert.equal(first.consentConfirmedById, a.id)

    assert.equal(await AuthorService.confirmConsent(first, b.id), 'unchanged')
    const second = await Author.findOrFail(author.id)
    assert.equal(second.consentConfirmedById, a.id)
    assert.equal(second.consentConfirmedAt?.toISO(), first.consentConfirmedAt?.toISO())
    assert.equal(second.updatedAt?.toISO(), first.updatedAt?.toISO())
  })

  test('confirmConsent without affiliation → no_affiliation, nothing written (D27)', async ({
    assert,
  }) => {
    const a = await admin()
    const author = await Author.create({
      firstNames: 'Jean',
      lastNames: 'Fictif',
      migrationKey: 'jean-fictif',
    })
    assert.equal(await AuthorService.confirmConsent(author, a.id), 'no_affiliation')
    assert.isNull(await consentOf(author.id).then((c) => c.at))
  })

  test('withdrawConsent → withdrawn (both columns NULL), then unchanged', async ({ assert }) => {
    const a = await admin()
    const author = await AuthorService.create({ ...PAYLOAD, consent: true }, a.id)
    assert.equal(await AuthorService.withdrawConsent(author), 'withdrawn')
    const saved = await Author.findOrFail(author.id)
    assert.isNull(saved.consentConfirmedAt)
    assert.isNull(saved.consentConfirmedById)
    assert.equal(await AuthorService.withdrawConsent(saved), 'unchanged')
  })

  test('update: consent only → confirmed, no field; already public → not confirmed again', async ({
    assert,
  }) => {
    const [a, b] = [await admin(), await admin()]
    const author = await AuthorService.create(PAYLOAD, a.id)
    const first = await AuthorService.update(
      await Author.findOrFail(author.id),
      { ...PAYLOAD, consent: true },
      { adminId: a.id }
    )
    assert.deepEqual(first.fields, [])
    assert.isTrue(first.consentConfirmed)

    const again = await AuthorService.update(
      await Author.findOrFail(author.id),
      { ...PAYLOAD, consent: true },
      { adminId: b.id }
    )
    assert.isFalse(again.consentConfirmed)
    assert.equal(await consentOf(author.id).then((c) => c.by), a.id)
  })

  test('update: consent confirmed meanwhile (stale instance) → decided on the locked row', async ({
    assert,
  }) => {
    const [a, b] = [await admin(), await admin()]
    const author = await AuthorService.create(PAYLOAD, a.id)
    const stale = await Author.findOrFail(author.id)
    await AuthorService.confirmConsent(await Author.findOrFail(author.id), a.id)

    const result = await AuthorService.update(
      stale,
      { ...PAYLOAD, consent: true },
      { adminId: b.id }
    )
    assert.isFalse(result.consentConfirmed)
    assert.equal(await consentOf(author.id).then((c) => c.by), a.id)
  })

  test('update: public card emptied of its affiliations → refused, nothing written', async ({
    assert,
  }) => {
    const a = await admin()
    const author = await Author.create({
      firstNames: 'Jean',
      lastNames: 'Fictif',
      migrationKey: 'jean-fictif',
    })
    await AuthorAffiliation.create({ authorId: author.id, position: 1, institution: 'U' })
    const stale = await Author.findOrFail(author.id)
    await AuthorService.confirmConsent(await Author.findOrFail(author.id), a.id)

    await assert.rejects(
      () => AuthorService.update(stale, { ...PAYLOAD, affiliations: [] }),
      vineErrors.E_VALIDATION_ERROR
    )
    const saved = await Author.findOrFail(author.id)
    await saved.load('affiliations')
    assert.lengthOf(saved.affiliations, 1)
    assert.equal(saved.lastNames, 'Fictif')
  })
})

test.group('AuthorService | renaming refreshes productions (Story 9.6)', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  async function production(names: string[]) {
    return Production.create({
      title: `Production ${Math.floor(Math.random() * 1_000_000)}`,
      status: 'published',
      authorNames: names,
      tags: [],
      licenseStatus: 'member',
    })
  }

  async function namesOf(id: string): Promise<string[]> {
    const row = await db.from('productions').where('id', id).first()
    return row.authors
  }

  test('new last name → fully attached productions rewritten, partial ones kept', async ({
    assert,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null)
    const coauthor = await Author.create({ firstNames: 'Awa', lastNames: 'Exemple' })
    const full = await production(['Jean Fictif', 'Awa Exemple'])
    const partial = await production(['Jean Fictif', 'Nom Libre'])
    await db.table('production_authors').multiInsert([
      { production_id: full.id, author_id: author.id, position: 1 },
      { production_id: full.id, author_id: coauthor.id, position: 2 },
      { production_id: partial.id, author_id: author.id, position: 1 },
    ])

    const { fields } = await AuthorService.update(author, { ...PAYLOAD, lastNames: 'FICTIVO' })

    assert.include(fields, 'lastNames')
    assert.deepEqual(await namesOf(full.id), ['Jean FICTIVO', 'Awa Exemple'])
    assert.deepEqual(await namesOf(partial.id), ['Jean Fictif', 'Nom Libre'])
  })

  test('affiliations only → productions untouched', async ({ assert }) => {
    const author = await AuthorService.create(PAYLOAD, null)
    const linked = await production(['FICTIF Jean'])
    await db
      .table('production_authors')
      .insert({ production_id: linked.id, author_id: author.id, position: 1 })

    await AuthorService.update(author, {
      ...PAYLOAD,
      affiliations: [{ institution: 'Institut Exemple' }],
    })

    assert.deepEqual(await namesOf(linked.id), ['FICTIF Jean'])
  })

  test('rename: productions with non-text values or no usable name are never rewritten', async ({
    assert,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null)
    const mixed = await production(['Jean Fictif'])
    const empty = await production([])
    const scalar = await production(['Jean Fictif'])
    await db.from('productions').where('id', mixed.id).update({ authors: '["Jean Fictif", 7]' })
    await db.from('productions').where('id', scalar.id).update({ authors: '"Jean Fictif"' })
    await db.table('production_authors').multiInsert(
      [mixed, empty, scalar].map((p) => ({
        production_id: p.id,
        author_id: author.id,
        position: 1,
      }))
    )

    await AuthorService.update(author, { ...PAYLOAD, lastNames: 'FICTIVO' })

    assert.deepEqual(await namesOf(mixed.id), ['Jean Fictif', 7] as any)
    assert.deepEqual(await namesOf(empty.id), [])
    assert.deepEqual(await namesOf(scalar.id), 'Jean Fictif' as any)
  })

  test('rename decided on the locked row: names already in place (stale form) → no refresh', async ({
    assert,
  }) => {
    const author = await AuthorService.create(PAYLOAD, null)
    const stale = await Author.findOrFail(author.id)
    // Renamed meanwhile outside AuthorService (no refresh): the production, attached by
    // matchKey, keeps its free-text spelling.
    const other = await Author.findOrFail(author.id)
    other.lastNames = 'Fictivo'
    await other.save()
    const linked = await production(['FICTIVO Jean'])
    await db
      .table('production_authors')
      .insert({ production_id: linked.id, author_id: author.id, position: 1 })

    const { fields } = await AuthorService.update(stale, { ...PAYLOAD, lastNames: 'Fictivo' })

    assert.include(fields, 'lastNames') // différent de l'instance chargée…
    assert.deepEqual(await namesOf(linked.id), ['FICTIVO Jean']) // …mais pas de la ligne verrouillée
  })
})
