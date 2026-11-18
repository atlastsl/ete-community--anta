import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Frontière TS6305 : composants et pages testés par lecture de source (Story 9.2).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const indexPage = read('inertia/pages/admin/Authors/Index.tsx')
const editPage = read('inertia/pages/admin/Authors/Edit.tsx')
const badges = read('inertia/components/admin/AuthorStatusBadges.tsx')
const dialog = read('inertia/components/admin/DeleteAuthorDialog.tsx')
const consentDialog = read('inertia/components/admin/ConsentAuthorDialog.tsx')
const tooltip = read('inertia/components/ui/tooltip.tsx')
const fr = JSON.parse(read('inertia/locales/admin/fr.json'))
const en = JSON.parse(read('inertia/locales/admin/en.json'))

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/**
 * Bouton refusé : le JSX du `<Button` qui précède `needle` (son `aria-describedby`) jusqu'à
 * la fin du bouton. Défaut : le premier bouton `aria-disabled` (« Supprimer » de la fiche).
 */
function blockedButton(source: string, needle = 'aria-disabled="true"'): string {
  const start = source.indexOf(needle)
  const end = source.indexOf('</Button>', start)
  return source.slice(source.lastIndexOf('<Button', start), end)
}

test.group('Authors Index | filtres', () => {
  test('recherche, institution, filtres rapides bascule dans un groupe nommé', ({ assert }) => {
    assert.include(indexPage, 'role="search"')
    assert.include(indexPage, "aria-label={t('authors.list.search_label')}")
    assert.include(indexPage, "aria-label={t('authors.list.institution_label')}")
    assert.include(indexPage, "const ALL_VALUE = '__all__'")
    assert.include(indexPage, 'institutionOptions.some((o) => o.value === filters.institution)')
    assert.include(indexPage, "useEffect(() => setSearchText(filters.q ?? ''), [filters.q])")
    assert.include(indexPage, 'authors.length === 0 ? (')
    assert.include(indexPage, 'role="group"')
    assert.include(indexPage, "aria-label={t('authors.list.quick_filters')}")
    assert.include(indexPage, 'aria-pressed={f.active}')
    assert.include(indexPage, 'tabular-nums')
  })

  test('filtres dans l’URL via urlFor, retour page 1, conservés par la pagination', ({
    assert,
  }) => {
    assert.include(indexPage, "router.get(urlFor('admin.authors'), params")
    assert.include(indexPage, 'queryParams={activeQuery}')
    assert.notInclude(indexPage, "'/admin/authors")
    assert.notInclude(indexPage, '`/admin/authors')
    const applyFilters = indexPage.slice(
      indexPage.indexOf('function applyFilters('),
      indexPage.indexOf('function clearFilters(')
    )
    assert.include(applyFilters, '...activeQuery, ...overrides')
    assert.notInclude(applyFilters, 'page')
  })

  test('état vide du référentiel distinct du filtrage sans résultat', ({ assert }) => {
    assert.include(indexPage, 'pagination.total === 0 && !hasActiveFilters')
    assert.include(indexPage, "t('authors.list.no_results')")
    assert.include(indexPage, "t('authors.list.clear_filters')")
  })
})

test.group('Authors Index | suppression', () => {
  test('bouton refusé : aria-disabled + aria-describedby, jamais disabled, infobulle', ({
    assert,
  }) => {
    const button = blockedButton(indexPage, 'aria-describedby={`author-delete-hint-${author.id}`}')
    assert.include(button, 'aria-disabled="true"')
    assert.include(button, 'e.preventDefault()')
    assert.notInclude(button, 'disabled={')
    assert.include(indexPage, '<TooltipTrigger asChild>')
    assert.include(indexPage, 'TooltipContent')
    assert.include(indexPage, 'TooltipProvider')
    assert.include(indexPage, "t('authors.delete.blocked', {")
    assert.include(indexPage, 'className="sr-only"')
  })

  test('dialog de confirmation partagé (alertdialog, route nommée)', ({ assert }) => {
    assert.include(indexPage, '<DeleteAuthorDialog')
    assert.include(editPage, '<DeleteAuthorDialog')
    assert.include(dialog, 'role="alertdialog"')
    assert.include(dialog, 'if (!target || submitting.current) return', 'pas de double DELETE')
    assert.include(dialog, "urlFor('admin.authors.destroy', { id: target.id })")
    assert.include(dialog, 'variant="destructive"')
    assert.include(dialog, 'disabled={isProcessing}')
  })

  test('fiche : texte visible relié au bouton refusé (pas d’infobulle)', ({ assert }) => {
    assert.include(editPage, 'id="author-delete-hint"')
    const button = blockedButton(editPage)
    assert.include(button, 'aria-describedby="author-delete-hint"')
    assert.notInclude(button, 'disabled={')
    assert.notInclude(editPage, 'Tooltip')
    assert.match(editPage, /isPublic,\s+isIncomplete,\s+\.\.\.formData\s+\} = author/)
  })

  test('tooltip shadcn : méta-paquet radix-ui et alias ~/', ({ assert }) => {
    assert.include(tooltip, 'from "radix-ui"')
    assert.include(tooltip, 'from "~/lib/utils"')
  })
})

test.group('Authors Index | consentement (Story 9.4)', () => {
  test('actions : retirer (public), confirmer, ou indisponible sans affiliation', ({ assert }) => {
    assert.include(indexPage, "t('authors.consent.withdraw_action')")
    assert.include(indexPage, "t('authors.consent.confirm_action')")
    assert.include(indexPage, "setConsentTarget({ author, mode: 'withdraw' })")
    assert.include(indexPage, "setConsentTarget({ author, mode: 'confirm' })")
    assert.isBelow(
      indexPage.indexOf('author.isPublic ?'),
      indexPage.indexOf('author.isIncomplete ?')
    )
  })

  test('confirmation indisponible : aria-disabled focusable, infobulle et texte relié (D27)', ({
    assert,
  }) => {
    const button = blockedButton(indexPage, 'aria-describedby={consentHintId}')
    assert.include(button, 'aria-describedby={consentHintId}')
    assert.include(button, 'aria-disabled="true"')
    assert.include(button, 'e.preventDefault()')
    assert.notInclude(button, 'disabled={')
    assert.include(indexPage, "<TooltipContent>{t('authors.consent.unavailable')}</TooltipContent>")
    assert.include(indexPage, '<span id={consentHintId} className="sr-only">')
  })

  test('dialog de consentement partagé (liste et fiche)', ({ assert }) => {
    assert.include(indexPage, '<ConsentAuthorDialog')
    assert.include(editPage, '<ConsentAuthorDialog')
    assert.include(editPage, 'mode="withdraw"')
    assert.include(consentDialog, 'role="alertdialog"')
    assert.include(consentDialog, 'if (!target || submitting.current) return')
    assert.include(consentDialog, "urlFor('admin.authors.confirm-consent', { id: target.id })")
    assert.include(consentDialog, "urlFor('admin.authors.withdraw-consent', { id: target.id })")
    assert.include(consentDialog, "t('authors.consent.confirm_description', { name })")
    assert.include(consentDialog, "t('authors.consent.withdraw_description', { name })")
    assert.include(consentDialog, 'variant="destructive"')
    assert.include(consentDialog, 'disabled={isProcessing}')
  })

  test('fiche : badges de statut, affiliation exigée pour un profil public', ({ assert }) => {
    assert.include(
      editPage,
      '<AuthorStatusBadges isPublic={isPublic} isIncomplete={isIncomplete} />'
    )
    assert.include(editPage, 'const requireAffiliation = !isMigrated || isPublic')
    assert.include(editPage, "form.reset('photo', 'removePhoto', 'consent')")
  })
})

test.group('AuthorStatusBadges', () => {
  test('trois badges informatifs non interactifs', ({ assert }) => {
    for (const key of ['public', 'not_public', 'incomplete']) {
      assert.include(badges, `t('authors.badges.${key}')`)
    }
    assert.notInclude(badges, '<button')
    assert.notInclude(badges, 'onClick')
  })
})

test.group('Authors pages | i18n', () => {
  test('toutes les clés authors.* utilisées existent en FR et EN', ({ assert }) => {
    const keys = new Set<string>()
    const form = read('inertia/components/admin/AuthorForm.tsx')
    for (const source of [indexPage, editPage, badges, dialog, consentDialog, form]) {
      for (const match of source.matchAll(/t\('(authors\.[a-z_.]+)'/g)) keys.add(match[1])
    }
    // Keys sent as strings by the server (flash messages, validation errors).
    for (const path of [
      'app/controllers/admin/authors_controller.ts',
      'app/validators/admin/author_validator.ts',
    ]) {
      for (const match of read(path).matchAll(/'(authors\.[a-z_]+\.[a-z_.]+)'/g)) keys.add(match[1])
    }
    assert.isAbove(keys.size, 15)
    for (const key of keys) {
      assert.isString(lookup(fr, key), `fr: ${key}`)
      assert.isString(lookup(en, key), `en: ${key}`)
    }
  })

  test('flash de refus sans interpolation (AdminLayout appelle t(flash.error))', ({ assert }) => {
    assert.notInclude(fr.authors.delete.refused, '{{')
    assert.notInclude(en.authors.delete.refused, '{{')
    assert.include(fr.authors.delete.blocked, '{{count}}')
    assert.include(en.authors.delete.blocked, '{{count}}')
  })
})

test.group('Authors Index | avatar (Story 9.3)', () => {
  test('colonne Auteur : Avatar sm (URL signée w128, alt vide) avant le nom', ({ assert }) => {
    assert.include(indexPage, "import Avatar from '~/components/shared/Avatar'")
    assert.include(indexPage, 'src={author.photoUrl}')
    assert.include(indexPage, 'size="sm"')
    assert.isBelow(
      indexPage.indexOf('src={author.photoUrl}'),
      indexPage.indexOf('formatAuthorName(author.firstNames, author.lastNames)')
    )
    assert.include(indexPage, 'photoUrl: string | null')
  })

  test('i18n photo FR/EN', ({ assert }) => {
    for (const key of [
      'authors.form.sections.photo',
      'authors.form.photo.choose',
      'authors.form.photo.replace',
      'authors.form.photo.cancel',
      'authors.form.photo.remove',
      'authors.form.photo.help',
      'authors.form.photo.selected',
      'authors.form.photo.uploading',
      'authors.form.errors.photo_type',
      'authors.form.errors.photo_size',
      'authors.form.errors.photo_dimensions',
    ]) {
      assert.isString(lookup(fr, key), key)
      assert.isString(lookup(en, key), key)
    }
    assert.include(fr.authors.form.photo.selected, '{{name}}')
    assert.include(en.authors.form.photo.uploading, '{{percent}}')
  })
})
