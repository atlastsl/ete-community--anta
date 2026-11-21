import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : `inertia/lib/media.ts` est vérifié par lecture de source (Story 10.2).
const source = readFileSync(resolve(process.cwd(), 'inertia/lib/media.ts'), 'utf-8')

test.group('media | authorPhotoImage', () => {
  test('variantes w128 / w384 de la base photoUrl (P2.5)', ({ assert }) => {
    assert.include(source, 'export const AUTHOR_PHOTO_WIDTHS = [128, 384] as const')
    assert.include(source, 'export function authorPhotoImage(')
    assert.include(source, 'src: `${base}/w128.webp`')
    assert.include(source, "AUTHOR_PHOTO_WIDTHS.map((w) => `${base}/w${w}.webp ${w}w`).join(', ')")
  })

  test('width / height renseignés (pas de décalage de mise en page), sizes par contexte', ({
    assert,
  }) => {
    assert.include(source, 'width: sizePx')
    assert.include(source, 'height: sizePx')
    assert.include(source, 'sizes = `${sizePx}px`')
  })

  test('base /media/ seulement (sinon null), sans barre finale', ({ assert }) => {
    assert.include(source, "const MEDIA_PREFIX = '/media/'")
    assert.include(source, 'if (!photoBase.startsWith(MEDIA_PREFIX)) return null')
    assert.include(source, '): ResponsiveImage | null {')
    assert.include(source, "photoBase.replace(/\\/+$/, '')")
  })
})
