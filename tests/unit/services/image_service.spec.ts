import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import ImageService, {
  AUTHOR_PHOTO_VARIANTS,
  IMAGE_MAX_BYTES,
  ImageValidationError,
  type ImageErrorCode,
} from '#services/image_service'

// Images générées par sharp dans le test : aucune photo réelle dans le dépôt public.

const RED = { r: 200, g: 30, b: 30 }

function blank(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: RED } })
}

async function expectCode(input: string | Buffer, code: ImageErrorCode, assert: any) {
  try {
    await ImageService.authorPhotoVariants(input)
    assert.fail(`Expected ${code}`)
  } catch (error) {
    assert.instanceOf(error, ImageValidationError)
    assert.equal((error as ImageValidationError).code, code)
  }
}

test.group('ImageService | photo d’auteur', () => {
  test('JPEG avec EXIF + GPS → 3 variantes carrées sans métadonnées', async ({ assert }) => {
    const input = await blank(800, 500)
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'Test', Artist: 'Auteur Fictif' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 3/1 0/1' },
      })
      .toBuffer()
    const inputMeta = await sharp(input).metadata()
    assert.isDefined(inputMeta.exif)

    const variants = await ImageService.authorPhotoVariants(input)
    assert.deepEqual(
      variants.map((v) => [v.name, v.contentType]),
      [
        ['w128.webp', 'image/webp'],
        ['w384.webp', 'image/webp'],
        ['og.jpg', 'image/jpeg'],
      ]
    )
    const expected = {
      'w128.webp': [128, 'webp'],
      'w384.webp': [384, 'webp'],
      'og.jpg': [600, 'jpeg'],
    }
    for (const variant of variants) {
      const meta = await sharp(variant.body).metadata()
      const [size, format] = expected[variant.name as keyof typeof expected]
      assert.equal(meta.width, size)
      assert.equal(meta.height, size)
      assert.equal(meta.format, format)
      assert.isUndefined(meta.exif)
      assert.isUndefined(meta.xmp)
      assert.isUndefined(meta.icc)
    }
    assert.lengthOf(AUTHOR_PHOTO_VARIANTS, 3)
  })

  test('orientation EXIF 6 appliquée puis retirée', async ({ assert }) => {
    // 300×200 en orientation 6 = portrait une fois réorienté : le recadrage carré reste exact.
    const input = await blank(300, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const inputMeta = await sharp(input).metadata()
    assert.equal(inputMeta.orientation, 6)

    for (const variant of await ImageService.authorPhotoVariants(input)) {
      const meta = await sharp(variant.body).metadata()
      assert.isUndefined(meta.orientation)
      assert.equal(meta.width, meta.height)
    }
  })

  test('PNG et WebP acceptés, chemin de fichier accepté', async ({ assert }) => {
    const png = await blank(64, 64).png().toBuffer()
    const webp = await blank(64, 64).webp().toBuffer()
    assert.lengthOf(await ImageService.authorPhotoVariants(png), 3)
    assert.lengthOf(await ImageService.authorPhotoVariants(webp), 3)

    const dir = join(tmpdir(), 'anta-test-images')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, 'photo.png')
    writeFileSync(path, png)
    assert.lengthOf(await ImageService.authorPhotoVariants(path), 3)
  })

  test('texte renommé .jpg → photo_type', async ({ assert }) => {
    const dir = join(tmpdir(), 'anta-test-images')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, 'faux.jpg')
    writeFileSync(path, 'ceci est du texte, pas une image', 'utf-8')
    await expectCode(path, 'photo_type', assert)
    await expectCode(Buffer.from('pas une image'), 'photo_type', assert)
  })

  test('GIF et SVG décodables mais refusés → photo_type', async ({ assert }) => {
    await expectCode(await blank(20, 20).gif().toBuffer(), 'photo_type', assert)
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>'
    )
    await expectCode(svg, 'photo_type', assert)
  })

  test('tampon > 5 Mo → photo_size', async ({ assert }) => {
    await expectCode(Buffer.alloc(IMAGE_MAX_BYTES + 1), 'photo_size', assert)
  })

  test('image > 40 Mpx (petit fichier) → photo_dimensions', async ({ assert }) => {
    const huge = await blank(7000, 6000).png().toBuffer()
    assert.isBelow(huge.length, IMAGE_MAX_BYTES)
    await expectCode(huge, 'photo_dimensions', assert)
  })
})
