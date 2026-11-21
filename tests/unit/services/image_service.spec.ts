import { test } from '@japa/runner'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import sharp from 'sharp'
import ImageService, {
  AUTHOR_PHOTO_VARIANTS,
  THUMBNAIL_VARIANTS,
  IMAGE_MAX_BYTES,
  ImageValidationError,
  type ImageErrorCode,
} from '#services/image_service'

// Images générées par sharp dans le test : aucune photo réelle dans le dépôt public.

const RED = { r: 200, g: 30, b: 30 }

function blank(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: RED } })
}

/**
 * PNG gris 8 bits écrit à la main (zlib) : sharp met ~15 s à encoder 10 millions de lignes,
 * ce PNG uniforme se construit en ~0,2 s et reste sous 5 Mo.
 */
function grayPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth; colour type 0 (grey), default compression/filter/interlace
  const rows = Buffer.alloc((width + 1) * height, 128)
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0 // filter type None
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
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
  test('JPEG avec EXIF + GPS → 2 avatars carrés + og.jpg 1200×630, sans métadonnées', async ({
    assert,
  }) => {
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
      'w128.webp': [128, 128, 'webp'],
      'w384.webp': [384, 384, 'webp'],
      'og.jpg': [1200, 630, 'jpeg'],
    }
    for (const variant of variants) {
      const meta = await sharp(variant.body).metadata()
      const [width, height, format] = expected[variant.name as keyof typeof expected]
      assert.equal(meta.width, width)
      assert.equal(meta.height, height)
      assert.equal(meta.format, format)
      assert.isUndefined(meta.exif)
      assert.isUndefined(meta.xmp)
      assert.isUndefined(meta.icc)
    }
    assert.lengthOf(AUTHOR_PHOTO_VARIANTS, 3)
  })

  test('orientation EXIF 6 appliquée puis retirée', async ({ assert }) => {
    // 300×200 en orientation 6 = portrait une fois réorienté : les recadrages restent exacts.
    const input = await blank(300, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const inputMeta = await sharp(input).metadata()
    assert.equal(inputMeta.orientation, 6)

    for (const variant of await ImageService.authorPhotoVariants(input)) {
      const meta = await sharp(variant.body).metadata()
      const spec = AUTHOR_PHOTO_VARIANTS.find((v) => v.name === variant.name)!
      assert.isUndefined(meta.orientation)
      assert.equal(meta.width, spec.width)
      assert.equal(meta.height, spec.height)
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

  test('TIFF (signature refusée avant tout décodage) → photo_type', async ({ assert }) => {
    await expectCode(await blank(20, 20).tiff().toBuffer(), 'photo_type', assert)
  })

  test('portrait : og.jpg recadré sur la zone saillante, avatars centrés', async ({ assert }) => {
    // Portrait 600×800 gris, bande colorée en haut (y 80–280) : un recadrage 1.91:1 centré
    // (y ≈ 243–557) la perdrait ; la stratégie `attention` la garde (D-10.7-2 amendée).
    const band = await sharp({
      create: { width: 600, height: 200, channels: 3, background: RED },
    })
      .png()
      .toBuffer()
    const input = await sharp({
      create: { width: 600, height: 800, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .composite([{ input: band, top: 80, left: 0 }])
      .png()
      .toBuffer()

    const variants = await ImageService.authorPhotoVariants(input)
    const centre = async (name: string) => {
      const variant = variants.find((v) => v.name === name)!
      const { data, info } = await sharp(variant.body).raw().toBuffer({ resolveWithObject: true })
      const offset =
        (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
      return [data[offset], data[offset + 1], data[offset + 2]]
    }
    const [r, g] = await centre('og.jpg')
    assert.isAbove(r, 150)
    assert.isBelow(g, 80)
    const [ar, ag] = await centre('w384.webp')
    assert.closeTo(ar, 128, 12)
    assert.closeTo(ag, 128, 12)
  })

  test('format extrême (2×20000, 20000×2) : recadré au centre avant attention, rapide', async ({
    assert,
  }) => {
    // Sans borne, `attention` évalue l'image agrandie entière (1200×12 000 000 px → mémoire).
    for (const [width, height] of [
      [2, 20000],
      [20000, 2],
      [100, 10000],
    ]) {
      const input = await blank(width, height).png().toBuffer()
      const started = Date.now()
      const variants = await ImageService.authorPhotoVariants(input)
      assert.isBelow(Date.now() - started, 3000)
      const meta = await sharp(variants.find((v) => v.name === 'og.jpg')!.body).metadata()
      assert.equal(meta.width, 1200)
      assert.equal(meta.height, 630)
    }
  })

  test('PNG transparent → og.jpg sur fond blanc (pas le noir par défaut)', async ({ assert }) => {
    const png = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()
    const variants = await ImageService.authorPhotoVariants(png)
    const og = variants.find((v) => v.name === 'og.jpg')!
    const { data } = await sharp(og.body).raw().toBuffer({ resolveWithObject: true })
    assert.isAbove(data[0], 245)
    assert.isAbove(data[1], 245)
    assert.isAbove(data[2], 245)
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

test.group('ImageService | vignette 16:9 (Story 11.1)', () => {
  test('profil : w400 400×225, w800 800×450, w1600 1600×900 en WebP, recadrage centré', ({
    assert,
  }) => {
    assert.deepEqual(
      THUMBNAIL_VARIANTS.map((v) => [v.name, v.width, v.height, v.format]),
      [
        ['w400.webp', 400, 225, 'webp'],
        ['w800.webp', 800, 450, 'webp'],
        ['w1600.webp', 1600, 900, 'webp'],
      ]
    )
    for (const variant of THUMBNAIL_VARIANTS) {
      assert.notProperty(variant, 'position')
      assert.equal(variant.width * 9, variant.height * 16)
    }
  })

  test('JPEG 4:3 avec EXIF + GPS → 3 variantes 16:9 sans métadonnées', async ({ assert }) => {
    const input = await blank(800, 600)
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'Test' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '4/1 3/1 0/1' },
      })
      .toBuffer()
    const variants = await ImageService.thumbnailVariants(input)
    assert.deepEqual(
      variants.map((v) => [v.name, v.contentType]),
      [
        ['w400.webp', 'image/webp'],
        ['w800.webp', 'image/webp'],
        ['w1600.webp', 'image/webp'],
      ]
    )
    for (const [index, variant] of variants.entries()) {
      const meta = await sharp(variant.body).metadata()
      assert.equal(meta.format, 'webp')
      assert.equal(meta.width, THUMBNAIL_VARIANTS[index].width)
      assert.equal(meta.height, THUMBNAIL_VARIANTS[index].height)
      assert.isUndefined(meta.exif)
    }
  })

  test('portrait : recadrage centré (bande centrale gardée, bords coupés)', async ({ assert }) => {
    // Portrait 400×800 : moitié haute bleue, moitié basse rouge. Un recadrage 16:9 centré
    // (y ≈ 287–513) garde les deux couleurs, de part et d’autre du milieu.
    const top = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 220 } },
    })
      .png()
      .toBuffer()
    const input = await blank(400, 800)
      .composite([{ input: top, top: 0, left: 0 }])
      .png()
      .toBuffer()
    const [w400] = await ImageService.thumbnailVariants(input)
    const { data, info } = await sharp(w400.body).raw().toBuffer({ resolveWithObject: true })
    const pixel = (y: number) => {
      const offset = (y * info.width + 200) * info.channels
      return [data[offset], data[offset + 1], data[offset + 2]]
    }
    assert.isAbove(pixel(20)[2], 150) // haut : bleu
    assert.isAbove(pixel(info.height - 20)[0], 150) // bas : rouge
  })

  test('PNG et WebP acceptés ; texte, GIF, > 5 Mo, > 40 Mpx refusés', async ({ assert }) => {
    assert.lengthOf(await ImageService.thumbnailVariants(await blank(320, 180).png().toBuffer()), 3)
    assert.lengthOf(
      await ImageService.thumbnailVariants(await blank(320, 180).webp().toBuffer()),
      3
    )
    const refused: [Buffer, ImageErrorCode][] = [
      [Buffer.from('pas une image'), 'photo_type'],
      [await blank(20, 20).gif().toBuffer(), 'photo_type'],
      [Buffer.alloc(IMAGE_MAX_BYTES + 1), 'photo_size'],
      [await blank(7000, 6000).png().toBuffer(), 'photo_dimensions'],
    ]
    for (const [input, code] of refused) {
      try {
        await ImageService.thumbnailVariants(input)
        assert.fail(`Expected ${code}`)
      } catch (error) {
        assert.instanceOf(error, ImageValidationError)
        assert.equal((error as ImageValidationError).code, code)
      }
    }
  })
})

test.group('ImageService | ratios extrêmes (revue 11.1)', () => {
  test('PNG 1×40000 → vignettes 16:9 et variantes d’auteur correctes, rapide', async ({
    assert,
  }) => {
    const input = await blank(1, 40000).png().toBuffer()
    const started = Date.now()
    const thumbnails = await ImageService.thumbnailVariants(input)
    const photos = await ImageService.authorPhotoVariants(input)
    assert.isBelow(Date.now() - started, 5000)
    for (const [variant, spec] of [
      ...thumbnails.map((v, i) => [v, THUMBNAIL_VARIANTS[i]] as const),
      ...photos.map((v, i) => [v, AUTHOR_PHOTO_VARIANTS[i]] as const),
    ]) {
      const meta = await sharp(variant.body).metadata()
      assert.equal(meta.width, spec.width, variant.name)
      assert.equal(meta.height, spec.height, variant.name)
    }
  })

  test('40000×1 et 4×10 000 000 (centre) → plus de refus « out of range »', async ({ assert }) => {
    const wide = await ImageService.thumbnailVariants(await blank(40000, 1).png().toBuffer())
    assert.lengthOf(wide, 3)
    // Avant la revue : « affine: output coordinates out of range » → photo_type.
    const tall = await ImageService.thumbnailVariants(grayPng(4, 10_000_000))
    const meta = await sharp(tall[2].body).metadata()
    assert.deepEqual([meta.width, meta.height], [1600, 900])
  })
})
