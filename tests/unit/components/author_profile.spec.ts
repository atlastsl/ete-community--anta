import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Story 10.3 — frontière TS6305 : page et composants testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const header = read('inertia/components/public/AuthorProfileHeader.tsx')
const sortSelect = read('inertia/components/shared/SortSelect.tsx')
const page = read('inertia/pages/author.tsx')
const query = read('inertia/lib/author_profile_query.ts')
const service = read('app/services/public_author_service.ts')
const card = read('inertia/components/public/ProductionCard.tsx')
const locales = {
  fr: JSON.parse(read('inertia/locales/public/fr.json')),
  en: JSON.parse(read('inertia/locales/public/en.json')),
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

/** i18n keys used through `t('…')` in a source file. */
function usedKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*['`]([a-z_.]+)['`]/g)].map((m) => m[1])
}

test.group('AuthorProfileHeader', () => {
  test('photo du profil : alt « Photo de {Prénom NOM} », avatar lg, base publique', ({
    assert,
  }) => {
    assert.include(header, "alt={t('authors.profile.photo_alt', { name })}")
    assert.include(header, 'size="lg"')
    assert.include(header, 'photoBase={author.photoBase}')
    assert.include(header, 'loading="eager"')
  })

  test('nom en h1 « Prénom NOM » (formatAuthorName), un seul h1', ({ assert }) => {
    assert.include(header, 'formatAuthorName(author.firstNames, author.lastNames)')
    assert.lengthOf(header.match(/<h1\b/g) ?? [], 1)
    assert.include(header, '{name}</h1>')
    assert.notMatch(page, /<h1\b/)
  })

  test('fil d’Ariane : nav étiquetée, page courante aria-current', ({ assert }) => {
    assert.include(header, "<nav aria-label={t('authors.profile.breadcrumb_label')}")
    assert.include(header, 'aria-current="page"')
    assert.include(header, "{t('authors.profile.breadcrumb_home')}")
    // Story 10.5 : niveau « Auteurs » vers la liste, entre l'accueil et la page courante.
    assert.include(header, "href={urlFor('authors.index')}")
    const home = header.indexOf("{t('authors.profile.breadcrumb_home')}")
    const authors = header.indexOf("{t('authors.profile.breadcrumb_authors')}")
    const current = header.indexOf('aria-current="page"')
    assert.isTrue(home < authors && authors < current)
  })

  test('affiliations ordonnées, département seulement s’il existe', ({ assert }) => {
    assert.include(header, 'author.affiliations.length > 0 &&')
    assert.include(header, 'affiliation.department ?')
    assert.include(header, "aria-label={t('authors.profile.affiliations_label')}")
  })

  test('Google Scholar : seulement s’il existe, nouvel onglet annoncé, rel sûr, ≥ 44 px', ({
    assert,
  }) => {
    assert.include(header, 'author.googleScholarUrl && (')
    assert.include(header, 'target="_blank"')
    assert.include(header, 'rel="noopener noreferrer"')
    assert.include(header, '<span className="sr-only">')
    assert.include(header, "{t('authors.profile.new_tab')}")
    assert.include(header, 'min-h-11')
    assert.equal(locales.fr.authors.profile.new_tab, '(nouvel onglet)')
  })

  test('aside statistiques : vues, téléchargements, productions et mention des totaux', ({
    assert,
  }) => {
    assert.include(header, '<aside')
    assert.include(header, "aria-label={t('authors.profile.stats_label')}")
    for (const key of ['views', 'downloads', 'productions']) {
      assert.include(header, `t('authors.profile.stats.${key}')`)
      assert.include(header, `stats.${key}`)
    }
    assert.include(header, "{t('authors.profile.stats_note')}")
    assert.equal(locales.fr.authors.profile.stats_note, 'Totaux des productions publiées.')
  })
})

test.group('SortSelect', () => {
  test('libellé visible « Trier par » lié au déclencheur', ({ assert }) => {
    assert.match(sortSelect, /<label\s+htmlFor=\{id\}/)
    assert.include(sortSelect, '<SelectTrigger id={id}')
    assert.include(sortSelect, "t('sort.label')")
  })

  test('options { value, label } et rappel onChange', ({ assert }) => {
    assert.include(sortSelect, 'options.map((option)')
    assert.include(sortSelect, 'onValueChange={onChange}')
  })
})

test.group('Page author', () => {
  test('section h2 « Productions » étiquetée, compteur, tri, grille 1/2/3, pagination', ({
    assert,
  }) => {
    assert.include(page, 'aria-labelledby="author-productions-heading"')
    assert.include(page, '<h2 id="author-productions-heading"')
    assert.include(page, "t('authors.profile.productions_count'")
    assert.include(page, '<SortSelect')
    assert.include(page, 'grid-cols-1')
    assert.include(page, 'sm:grid-cols-2')
    assert.include(page, 'lg:grid-cols-3')
    assert.include(page, '<ProductionCard')
    assert.include(page, '<Pagination')
    assert.include(page, 'max-w-6xl')
  })

  test('changement de tri : URL via sortHref (page remise à 1)', ({ assert }) => {
    assert.include(page, 'sortHref(author.slug, value)')
    assert.include(page, 'pageHref(author.slug, sort, p)')
  })

  test('helpers d’URL : défaut omis, page 1 omise, tri → page 1 (miroir du serveur)', ({
    assert,
  }) => {
    assert.include(query, "export const DEFAULT_PROFILE_SORT = 'date'")
    assert.include(query, 'if (sort !== DEFAULT_PROFILE_SORT) params.set')
    assert.include(query, "if (page > 1) params.set('page'")
    assert.match(
      query,
      /export function sortHref\([^)]*\): string \{\s*return profileUrl\(slug, sort, 1\)/
    )
    assert.match(
      query,
      /export function pageHref\([^)]*\): string \{\s*return profileUrl\(slug, sort, page\)/
    )
    // Renvoi croisé avec le constructeur serveur (redirection hors limites).
    assert.include(query, 'PublicAuthorService.profilePath')
    assert.include(service, 'inertia/lib/author_profile_query.ts')
    assert.include(service, 'if (sort !== DEFAULT_AUTHOR_PROFILE_SORT) params.set')
    assert.include(service, "if (page > 1) params.set('page'")
  })

  test('cartes du profil : date de l’œuvre (tri par défaut), en UTC', ({ assert }) => {
    assert.include(page, 'dateField="work"')
    assert.include(card, "dateField = 'published'")
    assert.include(card, 'production.workPublishedAt')
    assert.include(card, "timeZone: 'UTC'")
    assert.include(card, "'production_card.work_published_at'")
    assert.isString(locales.fr.production_card.work_published_at)
    assert.isString(locales.en.production_card.work_published_at)
  })

  test('libellés de tri du profil (EXPERIENCE.md)', ({ assert }) => {
    assert.deepEqual(locales.fr.authors.profile.sort, {
      date: "Date de publication de l'œuvre",
      views: 'Les plus consultées',
      downloads: 'Les plus téléchargées',
      title: 'Titre (A → Z)',
    })
    assert.deepEqual(locales.en.authors.profile.sort, {
      date: 'Publication date',
      views: 'Most viewed',
      downloads: 'Most downloaded',
      title: 'Title (A → Z)',
    })
  })

  test('toutes les clés utilisées existent en FR et en EN', ({ assert }) => {
    const keys = [...usedKeys(header), ...usedKeys(page), ...usedKeys(sortSelect)]
    assert.isAbove(keys.length, 10)
    for (const key of keys) {
      for (const [lang, dict] of Object.entries(locales)) {
        const value =
          lookup(dict, key) ?? lookup(dict, `${key}_one`) ?? lookup(dict, `${key}_other`)
        assert.isString(value, `${lang}: ${key}`)
      }
    }
  })
})
