import { test } from '@japa/runner'
import type { Assert } from '@japa/assert'
import { errors } from '@vinejs/vine'
import {
  draftProductionValidator,
  createLinkValidator,
} from '#validators/admin/production_validator'

async function expectRejected(fn: () => Promise<unknown>, assert: Assert) {
  try {
    await fn()
    assert.fail('Expected validation to throw')
  } catch (error) {
    assert.instanceOf(error, errors.E_VALIDATION_ERROR)
  }
}

test.group('ProductionValidator | draftProductionValidator', () => {
  test('payload minimal { title } → valide', async ({ assert }) => {
    const out = await draftProductionValidator.validate({ title: 'Topologie' })
    assert.equal(out.title, 'Topologie')
  })

  test('champs optionnels absents → valide', async ({ assert }) => {
    const out = await draftProductionValidator.validate({ title: 'X' })
    assert.isUndefined(out.summary)
    assert.isUndefined(out.authors)
  })

  test('arrays authors/tags acceptés', async ({ assert }) => {
    const out = await draftProductionValidator.validate({
      title: 'X',
      authors: ['A', 'B'],
      tags: ['m'],
    })
    assert.deepEqual(out.authors, ['A', 'B'])
    assert.deepEqual(out.tags, ['m'])
  })

  test('authorIds (Story 9.7) : uuid distincts acceptés, ordre conservé', async ({ assert }) => {
    const a = '11111111-1111-4111-8111-111111111111'
    const b = '22222222-2222-4222-8222-222222222222'
    const out = await draftProductionValidator.validate({ title: 'X', authorIds: [b, a] })
    assert.deepEqual(out.authorIds, [b, a])
    const empty = await draftProductionValidator.validate({ title: 'X', authorIds: [] })
    assert.deepEqual(empty.authorIds, [])
  })

  test('authorIds non uuid ou en double → rejette', async ({ assert }) => {
    const a = '11111111-1111-4111-8111-111111111111'
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', authorIds: ['abc'] }),
      assert
    )
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', authorIds: [a, a] }),
      assert
    )
  })

  test('authorIds : minuscules avant distinct, 200 au plus (revue 9.7)', async ({ assert }) => {
    const a = '1111aaaa-1111-4111-8111-111111111111'
    const out = await draftProductionValidator.validate({
      title: 'X',
      authorIds: [a.toUpperCase()],
    })
    assert.deepEqual(out.authorIds, [a])
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', authorIds: [a, a.toUpperCase()] }),
      assert
    )
    const many = Array.from(
      { length: 201 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    )
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', authorIds: many }),
      assert
    )
  })

  test('licenseStatus valide accepté', async ({ assert }) => {
    const out = await draftProductionValidator.validate({
      title: 'X',
      licenseStatus: 'free_license',
    })
    assert.equal(out.licenseStatus, 'free_license')
  })

  test('title manquant → rejette', async ({ assert }) => {
    await expectRejected(() => draftProductionValidator.validate({}), assert)
  })

  test('title vide → rejette', async ({ assert }) => {
    await expectRejected(() => draftProductionValidator.validate({ title: '   ' }), assert)
  })

  test('title > 255 caractères → rejette', async ({ assert }) => {
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'a'.repeat(256) }),
      assert
    )
  })

  test('licenseStatus hors enum → rejette', async ({ assert }) => {
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', licenseStatus: 'bogus' }),
      assert
    )
  })

  test('category valide acceptée', async ({ assert }) => {
    const out = await draftProductionValidator.validate({ title: 'X', category: 'article' })
    assert.equal(out.category, 'article')
  })

  test('category hors enum → rejette', async ({ assert }) => {
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', category: 'Livre' }),
      assert
    )
  })

  test('domain hors enum → rejette', async ({ assert }) => {
    await expectRejected(
      () => draftProductionValidator.validate({ title: 'X', domain: 'Mathématiques' }),
      assert
    )
  })
})

test.group('ProductionValidator | createLinkValidator', () => {
  test('URL https + type valide → valide', async ({ assert }) => {
    const out = await createLinkValidator.validate({
      url: 'https://example.com/article',
      linkType: 'simple',
      label: 'Source',
    })
    assert.equal(out.url, 'https://example.com/article')
    assert.equal(out.linkType, 'simple')
    assert.equal(out.label, 'Source')
  })

  test('label optionnel → valide sans label', async ({ assert }) => {
    const out = await createLinkValidator.validate({
      url: 'https://example.com',
      linkType: 'embed',
    })
    assert.isUndefined(out.label)
  })

  test('URL non valide → rejette', async ({ assert }) => {
    await expectRejected(
      () => createLinkValidator.validate({ url: 'abc', linkType: 'simple' }),
      assert
    )
  })

  test('URL sans protocole → rejette', async ({ assert }) => {
    await expectRejected(
      () => createLinkValidator.validate({ url: 'example.com', linkType: 'simple' }),
      assert
    )
  })

  test('linkType hors enum → rejette', async ({ assert }) => {
    await expectRejected(
      () => createLinkValidator.validate({ url: 'https://example.com', linkType: 'bogus' }),
      assert
    )
  })
})
