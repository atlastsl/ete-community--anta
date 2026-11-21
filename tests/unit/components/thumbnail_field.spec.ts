import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const field = read('inertia/components/admin/ThumbnailField.tsx')

test.group('ThumbnailField (11.1)', () => {
  test('envoi immédiat par la route nommée, état de la page préservé (D20)', ({ assert }) => {
    assert.include(field, "urlFor('admin.productions.thumbnail.store', { productionId })")
    assert.include(field, "urlFor('admin.productions.thumbnail.destroy', { productionId })")
    assert.include(field, 'forceFormData: true')
    assert.isAtLeast(field.split('preserveState: true').length - 1, 2)
    assert.isAtLeast(field.split('preserveScroll: true').length - 1, 2)
    assert.include(field, 'onProgress')
    assert.notInclude(field, "'/admin/productions/")
  })

  test('validation client, erreur serveur de sa propre visite, échec réseau en toast', ({
    assert,
  }) => {
    assert.include(field, 'validateThumbnailFile(')
    assert.include(field, 'onError')
    assert.notInclude(field, 'usePage(')
    // Erreur sans clé `thumbnail` → message générique (revue 11.1), jamais invalid_type.
    assert.include(field, 'setError(thumbnailErrorKey(errors))')
    assert.notInclude(field, "?? 'thumbnail.errors.invalid_type'")
    // Toast réseau seulement sans réponse HTTP (`inertia:exception`), via `visitOutcome`.
    assert.include(field, "router.on('exception'")
    assert.include(field, "router.on('invalid'")
    assert.include(field, 'visitOutcome(trace)')
    assert.include(field, "notify.error(t('thumbnail.errors.network'))")
    assert.include(field, "setError('thumbnail.errors.storage')")
  })

  test('toast de succès émis par le champ à chaque visite (pas de flash serveur)', ({ assert }) => {
    assert.include(field, 'notify.success(t(successKey))')
    assert.include(field, "settle(trace, 'thumbnail.uploaded')")
    assert.include(field, "settle(trace, 'thumbnail.removed')")
    const controller = read('app/controllers/admin/thumbnails_controller.ts')
    assert.notInclude(controller, "session.flash('success'")
  })

  test('aperçu recadré 16:9 décoratif, aide, remplacer et retirer', ({ assert }) => {
    assert.include(field, 'aspect-video')
    assert.include(field, 'object-cover')
    assert.include(field, 'alt=""')
    assert.include(field, "t('thumbnail.help')")
    assert.include(field, "t('thumbnail.replace')")
    assert.include(field, "t('thumbnail.remove')")
    assert.include(field, "t('thumbnail.upload')")
  })

  test('accessibilité : input relié à l’aide et à l’erreur, ids uniques, progression annoncée', ({
    assert,
  }) => {
    assert.include(field, 'useId()')
    assert.include(field, 'aria-describedby={describedBy}')
    assert.include(field, 'aria-invalid={!!error}')
    assert.include(field, 'aria-live="polite"')
    assert.include(field, 'accept={THUMBNAIL_ACCEPT}')
  })

  test('D37 : ni le formulaire de production ni CompletionIndicator ne gèrent de vignette', ({
    assert,
  }) => {
    for (const path of [
      'inertia/components/admin/ProductionForm.tsx',
      'inertia/components/admin/CompletionIndicator.tsx',
      'inertia/lib/production_completion.ts',
    ]) {
      const source = read(path)
      assert.notMatch(source, /thumbnail|ThumbnailField/i, path)
    }
  })
})

test.group('ThumbnailField | image extraite de la vidéo (11.3)', () => {
  test('sans vignette, aperçu du poster avec la mention « Image extraite de la vidéo »', ({
    assert,
  }) => {
    assert.include(field, 'posterPreviewUrl?: string | null')
    assert.include(field, "t('thumbnail.extracted')")
    // La vignette prime ; le poster ne s'affiche que sans vignette.
    // 11.4 : aperçu masquable (`showPreview`), même règle sinon.
    assert.match(
      field,
      /const showPoster =\s*showPreview && !hasThumbnail && posterPreviewUrl !== null/
    )
    // Échec de chargement du poster : la figure et sa légende restent, avec le repli (revue 11.3).
    assert.include(field, 'const posterLoaded = showPoster && failedSrc !== posterPreviewUrl')
    assert.isAtLeast(field.split("t('thumbnail.preview_unavailable')").length - 1, 2)
    // Aperçu 16:9 décoratif, comme la vignette ; pas de « Retirer » pour l'image extraite.
    assert.isAtLeast(field.split('aspect-video').length - 1, 2)
    assert.isAtLeast(field.split('alt=""').length - 1, 2)
    assert.include(field, '{hasThumbnail && (\n              <Button')
  })

  test('i18n thumbnail.extracted en fr et en (libellés d’EXPERIENCE.md)', ({ assert }) => {
    const fr = JSON.parse(read('inertia/locales/admin/fr.json'))
    const en = JSON.parse(read('inertia/locales/admin/en.json'))
    assert.equal(fr.thumbnail.extracted, 'Image extraite de la vidéo')
    assert.equal(en.thumbnail.extracted, 'Frame extracted from the video')
  })

  test('11.4 : verrou de page signalé avant la visite, aperçu masquable', ({ assert }) => {
    assert.include(field, 'onBusyChange?: (busy: boolean) => void')
    assert.include(field, 'showPreview = true')
    // Signalé avant `router.post` / `router.delete` : la page ignore ses propres visites.
    assert.isBelow(field.indexOf('onBusyChange?.(true)'), field.indexOf('router.post('))
    assert.isAtLeast(field.split('onBusyChange?.(true)').length - 1, 2)
    assert.isAtLeast(field.split('onBusyChange?.(false)').length - 1, 2)
    assert.include(field, '{showPreview && hasThumbnail && (')
    assert.include(
      field,
      'const showPoster = showPreview && !hasThumbnail && posterPreviewUrl !== null'
    )
  })
})
