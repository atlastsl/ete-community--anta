import { test } from '@japa/runner'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * Story 13.4 — recette accessibilité Phase 2 (lecture de source, frontière TS6305).
 *
 * Ne reprend pas les specs existantes (inventaire dans la story 13.4 et `recette-phase-2.md`) :
 * `aria-busy` / `aria-live` des suggestions (`suggestions_grid`), bannière (`home_featured_banner`),
 * fil d'Ariane (`author_profile`, `keyboard_screen_reader`), compteur `aria-live` (`authors_list`,
 * `filter_sidebar`), actions indisponibles de l'admin (`authors_index_page`, `author_form`,
 * `featured_page`), photo du profil (`author_profile`). Elle ajoute les trous relevés :
 * - ligne inerte du filtre auteur reliée au texte d'aide (`aria-describedby`) ;
 * - `aria-current` / `aria-disabled` de la pagination partagée ;
 * - règle générique des textes alternatifs (D9, D36) sur tous les composants Phase 2 à image ;
 * - règle générique « aucun lien imbriqué » sur toutes les sources publiques.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

/** Source without comments (a comment may quote `<a>` or `<Link>`). */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')

/** `.tsx` files directly under a directory; at least `min` (a moved folder fails loudly). */
function sourcesUnder(dir: string, min = 2): string[] {
  const files = readdirSync(resolve(process.cwd(), dir))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => `${dir}/${file}`)
  if (files.length < min) throw new Error(`${dir}: ${files.length} file(s), expected ≥ ${min}`)
  return files
}

const locales = {
  fr: JSON.parse(read('inertia/locales/public/fr.json')),
  en: JSON.parse(read('inertia/locales/public/en.json')),
}

/** Opening tags `<Name …>` / `<Name … />` of a JSX element (attributes may span lines). */
function openingTags(source: string, name: string): string[] {
  // `[^<>]` + `=>` / `{…}` tolerance: attribute values never contain `<` in these files.
  return [...source.matchAll(new RegExp(`<${name}\\b(?:[^<>]|=>)*?/?>`, 'g'))].map((m) => m[0])
}

test.group('Phase 2 | actions indisponibles du site public (aria-describedby)', () => {
  const sidebar = read('inertia/components/public/FilterSidebar.tsx')

  test('limite de 20 auteurs : chaque ligne inerte est décrite par le texte d’aide', ({
    assert,
  }) => {
    assert.include(sidebar, "const AUTHOR_LIMIT_ID = 'author-filter-limit'")
    const row = sidebar.slice(sidebar.indexOf('if (disabled) {'))
    const span = row.slice(0, row.indexOf('>'))
    assert.include(span, 'aria-disabled="true"')
    assert.include(span, 'aria-describedby={AUTHOR_LIMIT_ID}')
    // Le texte référencé existe dans la même branche que les lignes inertes (jamais d'id orphelin).
    assert.include(sidebar, '{authorLimitReached && (\n          <p id={AUTHOR_LIMIT_ID}')
    assert.include(sidebar, 'disabled={authorLimitReached && !active}')
    assert.include(
      sidebar,
      'aria-describedby={authorLimitReached ? AUTHOR_LIMIT_ID : undefined}',
      'le champ de recherche de facette reste décrit lui aussi'
    )
  })
})

test.group('Phase 2 | pagination partagée (listing, auteurs, profil)', () => {
  const pagination = read('inertia/components/shared/Pagination.tsx')

  test('page courante aria-current="page", précédent / suivant aria-disabled et hors tabulation aux bornes', ({
    assert,
  }) => {
    assert.include(pagination, "<nav aria-label={t('pagination.label')}")
    assert.include(pagination, "aria-current={active ? 'page' : undefined}")
    assert.include(pagination, 'aria-disabled={isFirst}')
    assert.include(pagination, 'aria-disabled={isLast}')
    // Bornes : hors de l'ordre de tabulation (lien inerte jamais atteint au clavier).
    assert.include(pagination, 'tabIndex={isFirst ? -1 : undefined}')
    assert.include(pagination, 'tabIndex={isLast ? -1 : undefined}')
    assert.include(pagination, '<ChevronLeft className="size-4" aria-hidden />')
    assert.include(pagination, '<ChevronRight className="size-4" aria-hidden />')
    for (const dict of Object.values(locales)) assert.isString(dict.pagination.label)
  })
})

test.group('Phase 2 | textes alternatifs (D9, D36)', () => {
  /** Images adjacent to their title / name: decorative (`alt=""`), the text carries the meaning. */
  const ADJACENT = [
    'inertia/components/shared/FeaturedBanner.tsx',
    'inertia/components/public/AuthorCard.tsx',
    'inertia/components/admin/AuthorCombobox.tsx',
    'inertia/components/admin/SelectedAuthorList.tsx',
    'inertia/components/admin/FeaturedSlot.tsx',
    'inertia/components/admin/ProductionPicker.tsx',
    'inertia/components/admin/ThumbnailField.tsx',
  ]

  test('Avatar : alt vide par défaut, initiales aria-hidden', ({ assert }) => {
    const avatar = read('inertia/components/shared/Avatar.tsx')
    assert.include(avatar, "alt = ''")
    assert.include(avatar, 'alt={alt}')
    assert.include(avatar, 'aria-hidden="true"')
  })

  for (const file of ADJACENT) {
    test(`${file} : chaque image adjacente à un texte a alt="" (Avatar : défaut vide)`, ({
      assert,
    }) => {
      const source = read(file)
      const images = openingTags(source, 'img')
      const avatars = openingTags(source, 'Avatar')
      assert.isAbove(images.length + avatars.length, 0, `aucune image trouvée dans ${file}`)
      for (const tag of images) assert.include(tag, 'alt=""', `${file} : ${tag}`)
      for (const tag of avatars) {
        assert.isTrue(!tag.includes('alt=') || tag.includes('alt=""'), `${file} : ${tag}`)
      }
    })
  }

  test('profil : alt="Photo de {Prénom NOM}" / « Photo of … », nom au format d’affichage', ({
    assert,
  }) => {
    const header = read('inertia/components/public/AuthorProfileHeader.tsx')
    const avatars = openingTags(header, 'Avatar')
    assert.lengthOf(avatars, 1)
    assert.include(avatars[0], "alt={t('authors.profile.photo_alt', { name })}")
    assert.equal(locales.fr.authors.profile.photo_alt, 'Photo de {{name}}')
    assert.equal(locales.en.authors.profile.photo_alt, 'Photo of {{name}}')
  })

  test('aucune image sans alt dans les sources publiques', ({ assert }) => {
    const files = [
      ...sourcesUnder('inertia/components/public', 10),
      ...sourcesUnder('inertia/components/shared', 4),
      ...sourcesUnder('inertia/pages', 5),
      'inertia/layouts/PublicLayout.tsx',
    ]
    let count = 0
    for (const file of files) {
      for (const tag of openingTags(read(file), 'img')) {
        count++
        assert.match(tag, /\balt=/, `${file} : ${tag}`)
      }
    }
    assert.isAbove(count, 0)
  })
})

test.group('Phase 2 | aucun lien imbriqué (cartes, liens étirés)', () => {
  /** Interactive elements that must never sit inside a link. */
  const INTERACTIVE = /<(?:Link|a|button|Button|input|select|textarea|AuthorByline|Pagination)\b/

  /**
   * Each `<Link …>…</Link>` / `<a …>…</a>` content (up to the first closing tag): a nested
   * interactive element would appear before that closing tag.
   */
  function linkContents(source: string): string[] {
    const contents: string[] = []
    for (const [open, close] of [
      ['<Link', '</Link>'],
      ['<a', '</a>'],
    ]) {
      for (const match of source.matchAll(new RegExp(`${open}\\b(?:[^<>]|=>)*?/?>`, 'g'))) {
        if (match[0].endsWith('/>')) continue
        const start = match.index! + match[0].length
        const end = source.indexOf(close, start)
        if (end > start) contents.push(source.slice(start, end))
      }
    }
    return contents
  }

  const PUBLIC_SOURCES = [
    ...sourcesUnder('inertia/components/public', 10),
    ...sourcesUnder('inertia/components/shared', 4),
    ...sourcesUnder('inertia/pages', 5),
    ...sourcesUnder('inertia/pages/errors'),
    'inertia/layouts/PublicLayout.tsx',
  ]

  test('détecteur : repère un lien dans un lien, ignore les liens frères', ({ assert }) => {
    const nested = '<Link href="/a" className="after:inset-0">Titre <a href="/b">x</a></Link>'
    const siblings = '<h3><Link href="/a">Titre</Link></h3><AuthorByline authors={a} />'
    assert.isTrue(linkContents(nested).some((content) => INTERACTIVE.test(content)))
    assert.isFalse(linkContents(siblings).some((content) => INTERACTIVE.test(content)))
  })

  for (const file of PUBLIC_SOURCES) {
    test(`${file} : aucun élément interactif dans un lien`, ({ assert }) => {
      for (const content of linkContents(code(file))) {
        assert.notMatch(content, INTERACTIVE, `${file} : ${content.trim().slice(0, 120)}`)
      }
    })
  }

  test('cartes à lien étiré (bannière, AuthorCard) : un seul lien étiré par composant', ({
    assert,
  }) => {
    for (const file of [
      'inertia/components/shared/FeaturedBanner.tsx',
      'inertia/components/public/AuthorCard.tsx',
    ]) {
      const source = read(file)
      const stretched = openingTags(source, 'Link').filter((tag) => tag.includes('after:inset-0'))
      assert.lengthOf(stretched, 1, `${file} : un seul lien étiré`)
    }
  })
})
