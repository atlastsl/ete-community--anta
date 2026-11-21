import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Story 11.2 — comportement de `inertia/lib/media.ts`. Le module est chargé à l'exécution par
 * une URL calculée (aucun import statique : la frontière TS6305 ne s'applique qu'au
 * typecheck) ; il n'importe rien, donc s'exécute tel quel.
 */
type ResponsiveImage = {
  src: string
  srcSet: string
  sizes: string
  width: number
  height: number
}
type BannerSlot = 'full' | 'half' | 'lead' | 'side'
type MediaModule = {
  THUMBNAIL_WIDTHS: readonly number[]
  BANNER_IMAGE_SIZES: Record<BannerSlot, string>
  bannerImage: (imageUrl: string, slot: BannerSlot) => ResponsiveImage | null
  authorPhotoImage: (photoBase: string, sizePx: number, sizes?: string) => ResponsiveImage | null
}

const load = async (): Promise<MediaModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/media.ts')).href)

const BASE = '/media/thumbnails/0b6f1c1e-4a7d-4b8e-9a51-1f2d3c4b5a69/AbCdEfGhIjKlMnOp_-12'

test.group('media | bannerImage (11.2)', () => {
  test('srcSet w400 / w800 / w1600, src w800, 16:9 (1600×900)', async ({ assert }) => {
    const { bannerImage, THUMBNAIL_WIDTHS, BANNER_IMAGE_SIZES } = await load()
    assert.deepEqual([...THUMBNAIL_WIDTHS], [400, 800, 1600])
    assert.deepEqual(bannerImage(BASE, 'full'), {
      src: `${BASE}/w800.webp`,
      srcSet: `${BASE}/w400.webp 400w, ${BASE}/w800.webp 800w, ${BASE}/w1600.webp 1600w`,
      sizes: BANNER_IMAGE_SIZES.full,
      width: 1600,
      height: 900,
    })
  })

  test('width / height toujours renseignés en 16:9, quel que soit l’emplacement', async ({
    assert,
  }) => {
    const { bannerImage } = await load()
    for (const slot of ['full', 'half', 'lead', 'side'] as const) {
      const image = bannerImage(BASE, slot)!
      assert.isAbove(image.width, 0, slot)
      assert.equal(image.width * 9, image.height * 16, slot)
    }
  })

  test('sizes par emplacement : conteneur 1232 px, gap 20 px, colonnes dès lg', async ({
    assert,
  }) => {
    const { bannerImage } = await load()
    assert.equal(bannerImage(BASE, 'full')!.sizes, '(min-width: 1280px) 1232px, calc(100vw - 48px)')
    assert.equal(
      bannerImage(BASE, 'half')!.sizes,
      '(min-width: 1280px) 606px, (min-width: 1024px) calc(50vw - 34px), calc(100vw - 48px)'
    )
    assert.equal(
      bannerImage(BASE, 'lead')!.sizes,
      '(min-width: 1280px) 815px, (min-width: 1024px) calc((100vw - 88px) * 2 / 3 + 20px), calc(100vw - 48px)'
    )
    assert.equal(
      bannerImage(BASE, 'side')!.sizes,
      '(min-width: 1280px) 398px, (min-width: 1024px) calc((100vw - 88px) / 3), calc(100vw - 48px)'
    )
  })

  test('base hors /media/ → null ; barre finale retirée ; base poster acceptée (11.3)', async ({
    assert,
  }) => {
    const { bannerImage } = await load()
    assert.isNull(bannerImage('https://r2.example/thumbnails/x?X-Amz-Signature=y', 'full'))
    assert.isNull(bannerImage('', 'full'))
    assert.equal(bannerImage(`${BASE}/`, 'side')!.src, `${BASE}/w800.webp`)
    assert.equal(
      bannerImage('/media/posters/abc/def', 'half')!.srcSet.split(', ')[0],
      '/media/posters/abc/def/w400.webp 400w'
    )
  })

  test('authorPhotoImage inchangé (10.2)', async ({ assert }) => {
    const { authorPhotoImage } = await load()
    assert.deepEqual(authorPhotoImage('/media/authors/a/b', 56), {
      src: '/media/authors/a/b/w128.webp',
      srcSet: '/media/authors/a/b/w128.webp 128w, /media/authors/a/b/w384.webp 384w',
      sizes: '56px',
      width: 56,
      height: 56,
    })
  })
})
