import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composant testé par lecture de source (Story 9.3).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const avatar = read('inertia/components/shared/Avatar.tsx')
const lib = read('inertia/lib/author_form.ts')
const adminForm = read('inertia/components/admin/AuthorForm.tsx')

test.group('Avatar', () => {
  test('photo : alt vide par défaut (D36), object-cover, bordure', ({ assert }) => {
    assert.include(avatar, "alt = ''")
    assert.include(avatar, 'alt={alt}')
    assert.include(avatar, 'object-cover')
    assert.include(avatar, 'border border-stone-200')
    assert.include(avatar, 'rounded-full')
  })

  test('initiales green-800 sur green-100 (D25), masquées des lecteurs d’écran', ({ assert }) => {
    assert.include(avatar, 'aria-hidden="true"')
    assert.include(avatar, 'bg-green-100')
    assert.include(avatar, 'text-green-800')
    assert.include(avatar, 'authorInitials(firstNames, lastNames)')
  })

  test('repli sur les initiales si l’image ne charge pas, réinitialisé au changement de src', ({
    assert,
  }) => {
    assert.include(avatar, 'onError={() => setFailedSrc(src)}')
    assert.include(avatar, 'src && !failed')
    assert.include(avatar, 'const failed = !!src && failedSrc === src', 'pas de flash d’initiales')
  })

  test('tailles 32 / 56 / 96 px', ({ assert }) => {
    assert.include(avatar, "sm: { box: 'size-8'")
    assert.include(avatar, "md: { box: 'size-14'")
    assert.match(avatar, /lg: \{\s*box: 'size-24 sm:size-28'/, '112 px dès sm (DESIGN.md)')
  })

  test('photo publique (Story 10.2) : srcSet w128/w384 via media.ts, width/height, lazy', ({
    assert,
  }) => {
    assert.include(avatar, "import { authorPhotoImage, type ResponsiveImage } from '~/lib/media'")
    assert.include(
      avatar,
      'photoBase?: string | null',
      'pas de collision avec les photoUrl signées'
    )
    assert.notInclude(avatar, 'photoUrl')
    assert.include(avatar, 'authorPhotoImage(photoBase, px, sizes)')
    assert.include(avatar, 'srcSet={image.srcSet}')
    assert.include(avatar, 'sizes={image.sizes}')
    assert.include(avatar, 'width={image.width}')
    assert.include(avatar, 'height={image.height}')
    assert.include(avatar, "loading = 'lazy'")
    assert.include(avatar, "sizes: '(min-width: 640px) 112px, 96px'")
  })

  test('URL signée de l’admin toujours acceptée par src (profils non publics)', ({ assert }) => {
    assert.include(avatar, 'src: signedSrc')
    assert.include(
      avatar,
      'publicImage ?? (signedSrc ? { src: signedSrc, width: px, height: px } : null)'
    )
    assert.match(
      adminForm,
      /<Avatar[^>]*src=\{preview\}[^>]*loading="eager"/s,
      'aperçu blob immédiat'
    )
  })

  test('authorInitials : 1re lettre (NFC, ponctuation ignorée, hors BMP), capitales fr-FR', ({
    assert,
  }) => {
    assert.include(lib, 'export function authorInitials(firstNames: string, lastNames: string)')
    assert.include(lib, "value.normalize('NFC').match(/\\p{L}|\\p{N}/u)")
    assert.include(lib, "toLocaleUpperCase('fr-FR')")
  })
})
