import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const shareSource = readFileSync(
  resolve(process.cwd(), 'inertia/components/public/ShareButton.tsx'),
  'utf-8'
)
const shareLibSource = readFileSync(resolve(process.cwd(), 'inertia/lib/share.ts'), 'utf-8')
const pageSource = readFileSync(resolve(process.cwd(), 'inertia/pages/production.tsx'), 'utf-8')

test.group('ShareButton | source analysis', () => {
  test('utilise Web Share API avec repli presse-papiers', ({ assert }) => {
    assert.include(shareSource, 'navigator.share')
    assert.include(shareSource, 'pickNativeShareData')
    assert.include(shareSource, 'navigator.clipboard.writeText')
    assert.include(shareSource, 'production_detail.share_text')
    assert.include(shareSource, 'production_detail.share_copied')
  })

  test('conserve url séparé pour les cibles de partage', ({ assert }) => {
    assert.include(shareLibSource, 'url')
    assert.include(shareLibSource, 'canShare')
  })

  test('construit l’URL publique à partir du slug', ({ assert }) => {
    assert.include(shareSource, '/productions/${slug}')
  })
})

test.group('Production detail page | share', () => {
  test('monte ShareButton dans l’en-tête et le bloc détails', ({ assert }) => {
    assert.equal((pageSource.match(/<ShareButton/g) ?? []).length, 2)
    assert.include(pageSource, 'production.slug')
    assert.include(pageSource, 'production.title')
  })
})
