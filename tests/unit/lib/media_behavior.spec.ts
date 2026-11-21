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
  bannerSlot: (index: number, count: number) => BannerSlot
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
      '(min-width: 1280px) 1195px, (min-width: 1024px) calc((100vw - 88px) * 2 / 3 + 400px), calc(100vw - 48px)'
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

test.group('media | bannière de l’accueil (11.6)', () => {
  test('bannerSlot : 1 → full, 2 → half, 3 → lead puis side', async ({ assert }) => {
    const { bannerSlot } = await load()
    assert.equal(bannerSlot(0, 1), 'full')
    assert.deepEqual([bannerSlot(0, 2), bannerSlot(1, 2)], ['half', 'half'])
    assert.deepEqual(
      [0, 1, 2].map((i) => bannerSlot(i, 3)),
      ['lead', 'side', 'side']
    )
  })

  test('sizes de lead : image étirée plus large que sa colonne (report 11.2, D-11.6-3)', async ({
    assert,
  }) => {
    const { BANNER_IMAGE_SIZES } = await load()
    // Largeur rendue mesurée au navigateur (object-cover sur la hauteur des deux cartes
    // empilées) : 1137 px à 1440 px de large, 966 px à 1024 px → jamais sous-estimée.
    const at1280 = Number(/^\(min-width: 1280px\) (\d+)px/.exec(BANNER_IMAGE_SIZES.lead)![1])
    assert.isAtLeast(at1280, 1137)
    const lgOffset = Number(/\* 2 \/ 3 \+ (\d+)px\)/.exec(BANNER_IMAGE_SIZES.lead)![1])
    assert.isAtLeast(((1024 - 88) * 2) / 3 + lgOffset, 966)
  })
})
