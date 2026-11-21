import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 11.4 — page « À la une » et ses composants, testés par lecture de source (TS6305).
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const page = read('inertia/pages/admin/Featured/Index.tsx')
const slot = read('inertia/components/admin/FeaturedSlot.tsx')
const picker = read('inertia/components/admin/ProductionPicker.tsx')
const preview = read('inertia/components/admin/BannerPreview.tsx')
const banner = read('inertia/components/shared/FeaturedBanner.tsx')
const fr = JSON.parse(read('inertia/locales/admin/fr.json'))
const en = JSON.parse(read('inertia/locales/admin/en.json'))

test.group('Page « À la une » (11.4)', () => {
  test('mise en page admin, h1, introduction, compteur, liste ordonnée de 3 emplacements', ({
    assert,
  }) => {
    assert.include(page, 'AdminLayout')
    assert.include(page, "t('featured.heading')")
    assert.include(page, "t('featured.intro')")
    assert.include(page, "t('featured.count'")
    assert.include(page, '<ol')
    assert.include(page, 'FEATURED_MAX_SLOTS')
    assert.include(page, '<BannerPreview')
    assert.include(page, 'max-w-5xl')
  })

  test('enregistrement : PUT nommé, état préservé, toast local, erreur persistante', ({
    assert,
  }) => {
    assert.include(page, "urlFor('admin.featured.update')")
    assert.include(page, 'router.put(')
    assert.include(page, 'preserveState: true')
    assert.include(page, "notify.success(t('featured.saved'))")
    assert.include(page, 'notify.error(')
    assert.include(page, 'saveError(errors')
    assert.include(page, '`${key}_slot`')
    assert.notInclude(page, "'/admin/featured")
  })

  test('« Enregistrer » désactivé avec explication reliée (D26)', ({ assert }) => {
    assert.include(page, "t('featured.save_blocked'")
    assert.include(page, "t('featured.save_blocked_unavailable'")
    assert.include(
      page,
      'aria-describedby={blocked.length > 0 || refreshFailed ? saveHelpId : undefined}'
    )
    assert.include(page, 'slotIssues(')
  })

  test('verrou de page pendant les visites (D-11.4-1) et rafraîchissement par ids[] (D-11.4-2)', ({
    assert,
  }) => {
    assert.include(page, 'onBusyChange')
    assert.include(page, "urlFor('admin.featured.candidates', {}, { qs: { ids")
    assert.include(page, 'mergeRefreshed(')
  })

  test('confirmation de sortie : navigation Inertia et fermeture d’onglet (D-11.4-8)', ({
    assert,
  }) => {
    assert.include(page, "router.on('before'")
    assert.include(page, 'event.preventDefault()')
    assert.include(page, "'beforeunload'")
    assert.include(page, 'shouldConfirmLeave(')
    assert.include(page, "t('featured.leave_confirm')")
    // Visites de la page par méthode + chemin, plus de compteur global (revue 11.4).
    assert.include(page, 'isOwnVisit(')
    assert.include(page, 'visit.url.pathname')
    assert.notInclude(page, 'ownVisits')
  })

  test('succès seulement si la réponse est la page avec la sélection envoyée (revue 11.4)', ({
    assert,
  }) => {
    assert.include(page, 'saveSucceeded({ component: page.component, sentIds, selection })')
    assert.include(page, "t('featured.errors.not_saved')")
  })

  test('échec du rafraîchissement : alerte en ligne avec « Réessayer » (D20)', ({ assert }) => {
    assert.include(page, 'setRefreshFailed(true)')
    assert.include(page, 'role="alert"')
    assert.include(page, "t('featured.retry')")
    assert.include(page, 'onClick={refresh}')
  })

  test('annonces polies (déplacement, retrait, ajout)', ({ assert }) => {
    assert.include(page, 'aria-live="polite"')
    assert.include(page, "t('featured.announce.moved'")
    assert.include(page, "t('featured.announce.removed'")
    assert.include(page, "t('featured.announce.added'")
  })
})

test.group('FeaturedSlot (11.4)', () => {
  test('pastille de rang, image 16:9 alt vide, badges, mention de l’image extraite', ({
    assert,
  }) => {
    assert.include(slot, "t('featured.position', { n: position })")
    assert.include(slot, 'aspect-video')
    assert.include(slot, 'alt=""')
    assert.include(slot, "t('featured.badges.shown')")
    assert.include(slot, "t('featured.badges.missing')")
    assert.include(slot, "t('thumbnail.extracted')")
    assert.include(slot, "t('featured.badges.unavailable')")
    assert.include(slot, "t('featured.unavailable_notice')")
  })

  test('maquette : titre d’ajout, encadré pointillé « Vignette requise », titre card-title', ({
    assert,
  }) => {
    assert.include(slot, "t('featured.add_heading')")
    assert.include(slot, "t('featured.thumbnail_required')")
    assert.include(slot, 'border-2 border-dashed border-amber-300')
    assert.include(slot, 'font-display text-lg font-semibold leading-[1.375]')
  })

  test('auteurs « Prénom NOM » (formatAuthorName, D13) dans l’emplacement, le sélecteur, l’aperçu', ({
    assert,
  }) => {
    for (const source of [slot, picker, preview]) {
      assert.include(source, 'authorLabels(item.authors, formatAuthorName)')
    }
  })

  test('boutons nommés ↑ ↓ « Retirer », sans confirmation (D-11.4-3)', ({ assert }) => {
    assert.include(slot, "t('featured.actions.move_up', { title: item.title })")
    assert.include(slot, "t('featured.actions.move_down', { title: item.title })")
    assert.include(slot, "t('featured.actions.remove_label', { title: item.title })")
    assert.notInclude(slot, 'Dialog')
  })

  test('ThumbnailField en ligne, aperçu masqué, avertissement si vignette manquante (D20)', ({
    assert,
  }) => {
    assert.include(slot, '<ThumbnailField')
    assert.include(slot, 'showPreview={false}')
    assert.include(slot, 'posterPreviewUrl={item.posterPreviewUrl}')
    assert.include(slot, 'hasThumbnail={item.hasThumbnail}')
    assert.include(slot, 'onBusyChange={onBusyChange}')
    assert.include(slot, "t('featured.missing_notice')")
    assert.include(slot, 'AlertTriangle')
  })

  test('emplacement vide : sélecteur, sinon « Emplacement libre »', ({ assert }) => {
    assert.include(slot, '<ProductionPicker')
    assert.include(slot, "t('featured.empty_slot')")
    assert.include(slot, 'border-dashed')
  })
})

test.group('ProductionPicker (11.4)', () => {
  test('combobox ARIA 1.2 sur la route nommée, exclusion des choisies', ({ assert }) => {
    assert.include(picker, 'role="combobox"')
    assert.include(picker, 'role="listbox"')
    assert.include(picker, 'aria-activedescendant')
    assert.include(picker, "urlFor('admin.featured.candidates', {}, { qs: { q: term, exclude")
    assert.include(picker, 'AbortController')
    assert.include(picker, 'role="status"')
    assert.include(picker, "case 'Escape'")
  })

  test('option : miniature ou ImageOff, état de vignette', ({ assert }) => {
    assert.include(picker, 'ImageOff')
    assert.include(picker, '`featured.state.${')
    assert.include(picker, "t('featured.picker.help')")
  })
})

test.group('BannerPreview (11.4)', () => {
  test('rendu réel de la bannière partagée, réduit, non interactif, emplacements valides', ({
    assert,
  }) => {
    assert.include(preview, "t('featured.preview.heading')")
    assert.include(preview, "t('featured.preview.none')")
    assert.include(preview, "t('featured.preview.shown'")
    assert.include(preview, "t('featured.preview.waiting'")
    assert.include(preview, 'aria-hidden="true"')
    assert.include(preview, "from '~/components/shared/FeaturedBanner'")
    assert.include(preview, 'zoom: SCALE')
    assert.include(preview, 'displayedItems(')
    assert.include(preview, 'viewsCount: item.viewsCount')
    assert.notInclude(preview, 'href:')
    assert.notInclude(preview, 'href=')
    assert.notInclude(preview, '<Link')
    assert.notInclude(preview, '<button')
  })
})

test.group('FeaturedBanner partagée (11.4, pour 11.6)', () => {
  test('dispositions D35, contenu FR49, image LCP, titres selon les jetons', ({ assert }) => {
    assert.include(banner, 'bannerLayout(')
    assert.include(banner, "layout === 'columns' && 'lg:grid-cols-2'")
    assert.include(banner, "layout === 'lead' && 'lg:grid-cols-3 lg:grid-rows-2'")
    assert.include(banner, 'lg:col-span-2 lg:row-span-2')
    assert.include(banner, 'lg:aspect-auto lg:min-h-0 lg:flex-1')
    assert.include(banner, 'alt=""')
    assert.include(banner, "fetchPriority={lead ? 'high' : 'auto'}")
    assert.include(banner, "loading={lead ? 'eager' : 'lazy'}")
    assert.include(banner, 'text-2xl leading-[1.3]')
    assert.include(banner, 'text-lg leading-[1.375]')
    assert.include(banner, 'Eye')
    assert.include(banner, 'Download')
    assert.include(banner, 'after:absolute after:inset-0')
    // Aucune clé i18n : textes fournis par le point d'entrée (admin ou public).
    assert.notInclude(banner, 'useTranslation')
  })
})

test.group('i18n « À la une » (11.4)', () => {
  test('libellés EXPERIENCE.md en fr, parité en', ({ assert }) => {
    assert.equal(fr.nav.featured, 'À la une')
    assert.equal(
      fr.featured.intro,
      "Jusqu'à 3 productions publiées, affichées dans cet ordre en tête de l'accueil. Les changements ne s'appliquent à l'accueil qu'après « Enregistrer »."
    )
    assert.equal(fr.featured.saved, 'Sélection à la une enregistrée.')
    assert.equal(
      fr.featured.save_blocked,
      "Enregistrement impossible : l'emplacement {{n}} n'a pas de vignette."
    )
    assert.equal(
      fr.featured.missing_notice,
      "Cette production n'a pas de vignette. Ajoutez-en une pour pouvoir enregistrer la sélection."
    )
    assert.equal(fr.featured.preview.none, "Aucune bannière sur l'accueil")
    assert.equal(
      fr.thumbnail.errors.required_for_featured,
      'Vignette requise pour une production à la une.'
    )
    assert.equal(fr.featured.badges.shown, 'Affichée')
    assert.equal(fr.featured.badges.missing, 'Vignette manquante')
    assert.equal(fr.featured.state.poster, 'Vidéo hébergée — image extraite')
    assert.equal(fr.featured.state.missing, 'Sans vignette — à téléverser')
    assert.equal(fr.activity.action.featured_update, 'Sélection à la une modifiée')
    assert.equal(fr.activity.resource.featured_selection, 'Sélection à la une')

    const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object'
          ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`]
      )
    assert.sameMembers(keys(fr.featured), keys(en.featured))
    assert.isString(en.nav.featured)
    assert.isString(en.thumbnail.errors.required_for_featured)
    assert.isString(en.activity.action.featured_update)
  })
})
