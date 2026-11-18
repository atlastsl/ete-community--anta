import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants et pages testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const form = read('inertia/components/admin/AuthorForm.tsx')
const createPage = read('inertia/pages/admin/Authors/Create.tsx')
const editPage = read('inertia/pages/admin/Authors/Edit.tsx')
const indexPage = read('inertia/pages/admin/Authors/Index.tsx')

test.group('AuthorForm | champs et affiliations', () => {
  test('Nom(s) avant Prénom(s) (D34), champs obligatoires signalés', ({ assert }) => {
    assert.isBelow(
      form.indexOf('authors.form.fields.last_names'),
      form.indexOf('authors.form.fields.first_names')
    )
    assert.include(form, 'aria-required={required || undefined}')
  })

  test('↑ ↓ × nommés, bornes désactivées, dernier × désactivé si affiliation requise', ({
    assert,
  }) => {
    assert.include(form, "t('authors.form.move_up', { n })")
    assert.include(form, "t('authors.form.move_down', { n })")
    assert.include(form, "t('authors.form.remove', { n })")
    assert.include(form, 'disabled={index === 0}')
    assert.include(form, 'disabled={index === count - 1}')
    assert.include(form, 'const removeDisabled = requireAffiliation && count === 1')
  })

  test('réordonnancement accessible : focus conservé et annonce polie, sans glisser-déposer', ({
    assert,
  }) => {
    assert.include(form, 'aria-live="polite"')
    assert.include(form, 'Math.floor(uploadPercent / 25) * 25', 'progression annoncée par quarts')
    assert.include(form, 'hasSavedPhoto={hasPhoto}', '« Retirer la photo » d’après photo_key')
    assert.include(form, 'photoInput.current.focus()', 'focus gardé après Annuler')
    assert.include(form, "setData('removePhoto', removeBeforeChoice.current)")
    assert.include(form, "t('authors.form.moved', { n: target + 1 })")
    assert.include(form, 'target?.focus()')
    assert.notInclude(form, 'draggable')
  })

  test('erreurs reliées au champ (aria-invalid, aria-describedby)', ({ assert }) => {
    assert.include(form, 'aria-invalid={!!error}')
    assert.include(form, 'aria-describedby={error ? errorId : undefined}')
    assert.include(form, "message('affiliations')")
  })

  test('pas encore de consentement (Story 9.4)', ({ assert }) => {
    assert.notInclude(form, 'consent')
  })
})

test.group('Pages Authors | création, édition, liste', () => {
  test('validation client avant envoi, URLs par urlFor (Tuyau)', ({ assert }) => {
    for (const page of [createPage, editPage]) {
      assert.include(page, 'validateAuthorForm(data, { requireAffiliation')
      assert.include(page, 'form.transform(toAuthorPayload)')
    }
    assert.include(createPage, "post(urlFor('admin.authors.store'))")
    assert.include(editPage, "urlFor('admin.authors.update', { id })")
    assert.include(editPage, 'const requireAffiliation = !isMigrated')
  })

  test('liste : nom formaté, affiliation principale ou « Aucune affiliation », état vide', ({
    assert,
  }) => {
    assert.include(indexPage, 'formatAuthorName(author.firstNames, author.lastNames)')
    assert.include(indexPage, "t('authors.no_affiliation')")
    assert.include(indexPage, "t('authors.empty_title')")
    assert.include(indexPage, 'scope="col"')
    assert.include(indexPage, 'Pagination')
    assert.include(indexPage, 'pagination.total === 0', 'état vide seulement si aucune fiche')
  })

  test('après déplacement ou retrait : erreurs indexées masquées, focus et annonce répétable', ({
    assert,
  }) => {
    assert.include(form, "if (indexedErrorsStale && key.startsWith('affiliations.')) return null")
    assert.include(form, 'setFocusAdd(true)')
    assert.include(form, '\\u00a0')
  })

  test('nouvelles erreurs : focus sur le premier champ invalide, erreur de liste reliée', ({
    assert,
  }) => {
    assert.include(form, '[aria-invalid="true"]')
    assert.include(
      form,
      "aria-describedby={message('affiliations') ? 'affiliations-error' : undefined}"
    )
  })
})

test.group('AuthorForm | photo (Story 9.3)', () => {
  const lib = read('inertia/lib/author_form.ts')

  test('champ fichier : accept, aide reliée, erreur en ligne, aria-invalid sur l’input', ({
    assert,
  }) => {
    assert.include(form, 'type="file"')
    assert.include(form, 'accept={PHOTO_ACCEPT}')
    assert.include(form, "t('authors.form.photo.help')")
    assert.include(form, "message('photo')")
    assert.include(form, 'aria-invalid={!!error}')
    assert.include(form, 'aria-describedby={describedBy}')
    // Focus visible : l'input sr-only est le pair du libellé stylé en bouton.
    assert.include(form, 'peer sr-only')
    assert.include(form, 'peer-focus-visible:ring-[3px]')
  })

  test('aperçu avatar lg : URL d’objet créée puis libérée, photo enregistrée sinon', ({
    assert,
  }) => {
    assert.include(form, 'size="lg"')
    assert.include(form, 'URL.createObjectURL(data.photo)')
    assert.include(form, 'URL.revokeObjectURL(url)')
    assert.include(form, 'photoPreview ?? (data.removePhoto ? null : photoUrl)')
  })

  test('annuler le fichier choisi, « Retirer la photo » seulement avec une photo enregistrée', ({
    assert,
  }) => {
    assert.include(form, "t('authors.form.photo.cancel')")
    assert.include(form, "t('authors.form.photo.remove')")
    assert.include(form, 'hasSavedPhoto && !file')
    assert.include(form, "setData('removePhoto', checked)")
    // Choisir un fichier décoche removePhoto.
    assert.include(form, "if (file) setData('removePhoto', false)")
  })

  test('section Photo après Identité', ({ assert }) => {
    assert.isBelow(
      form.indexOf("t('authors.form.sections.identity')"),
      form.indexOf("t('authors.form.sections.photo')")
    )
    assert.isBelow(
      form.indexOf("t('authors.form.sections.photo')"),
      form.indexOf("t('authors.form.sections.affiliations')")
    )
  })

  test('règles client : type et taille, mêmes clés que le serveur ; charge utile', ({ assert }) => {
    assert.include(lib, 'export const PHOTO_MAX_BYTES = 5 * 1024 * 1024')
    assert.include(lib, "errors.photo = 'authors.form.errors.photo_type'")
    assert.include(lib, "errors.photo = 'authors.form.errors.photo_size'")
    assert.include(lib, '...(data.photo instanceof File ? { photo: data.photo } : {})')
    assert.include(lib, '...(data.removePhoto && !data.photo ? { removePhoto: true } : {})')
    assert.include(lib, 'photo: null,\n  removePhoto: false,')
  })

  test('Edit : photoUrl hors état du formulaire, reset après succès, pas de _method', ({
    assert,
  }) => {
    assert.include(
      editPage,
      'const { id, isMigrated, productionsCount, photoUrl, hasPhoto, ...formData }'
    )
    assert.include(editPage, "form.reset('photo', 'removePhoto')")
    assert.include(editPage, 'photoUrl={photoUrl}')
    assert.notInclude(editPage, '_method')
    assert.include(createPage, 'uploadPercent=')
  })
})

test.group('Authors controller | upload hygiene (source)', () => {
  test('fichier temporaire supprimé après chaque requête ; JSON sans affiliations refusé', ({
    assert,
  }) => {
    const controller = read('app/controllers/admin/authors_controller.ts')
    assert.include(controller, 'await this.discardUpload(ctx.request)')
    assert.include(controller, "if (request.is(['multipart'])) return []")
  })
})
