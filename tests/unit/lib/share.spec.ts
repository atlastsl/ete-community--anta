import { test } from '@japa/runner'
import { buildShareClipboardText, pickNativeShareData } from '../../../inertia/lib/share.js'

test.group('share | buildShareClipboardText', () => {
  test('concatène intro et URL', ({ assert }) => {
    assert.equal(
      buildShareClipboardText('Découvrez « Titre » sur Anta', 'https://example.com/p'),
      'Découvrez « Titre » sur Anta\nhttps://example.com/p'
    )
  })
})

test.group('share | pickNativeShareData', () => {
  test('sépare intro et url pour éviter la duplication', ({ assert }) => {
    const data = pickNativeShareData(
      'Mon titre',
      'Découvrez « Mon titre » sur Anta',
      'https://example.com/productions/slug'
    )

    assert.equal(data.title, 'Mon titre')
    assert.equal(data.url, 'https://example.com/productions/slug')
    assert.equal(data.text, 'Découvrez « Mon titre » sur Anta')
    assert.notInclude(data.text!, 'https://example.com/productions/slug')
  })
})
