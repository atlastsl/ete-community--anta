import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatAuthorName } from '#helpers/author_name'

// Story 10.4 — frontière TS6305 : composants testés par lecture de source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')
const byline = read('inertia/components/public/AuthorByline.tsx')
const card = read('inertia/components/public/ProductionCard.tsx')
const detail = read('inertia/pages/production.tsx')
const profile = read('inertia/pages/author.tsx')
const layout = read('inertia/layouts/PublicLayout.tsx')
const app = read('inertia/app.tsx')
const locales = {
  fr: JSON.parse(read('inertia/locales/public/fr.json')),
  en: JSON.parse(read('inertia/locales/public/en.json')),
}

function lookup(dict: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node ? node[part] : undefined), dict)
}

test.group('AuthorByline | source', () => {
  test('profil public → lien Inertia vers authors.show ; sinon texte simple', ({ assert }) => {
    assert.include(byline, "urlFor('authors.show', { slug: author.slug })")
    assert.include(byline, '<Link')
    // Non lié : un simple <span> sans classe (D12, aucun style distinctif).
    assert.match(byline, /<span key=\{`[^`]+`\}>\{author\.name\}<\/span>/)
  })

  test('style D24 : souligné stone-300, décalage 2 px, green-700 au survol', ({ assert }) => {
    for (const cls of [
      'underline',
      'decoration-stone-300',
      'underline-offset-2',
      'hover:text-green-700',
      'hover:decoration-green-700',
    ]) {
      assert.include(byline, cls)
    }
  })

  test('troncature « et {n} autres » (pluriel) et séparateur « , »', ({ assert }) => {
    assert.include(byline, "t('authors.byline.others', { count: hidden })")
    assert.include(byline, "', '")
    assert.include(byline, 'max')
  })

  test('propre nom non lié sur le profil (currentSlug)', ({ assert }) => {
    assert.include(byline, 'author.slug !== currentSlug')
  })

  test('variante empilée (aside « Auteurs ») : un nom par ligne', ({ assert }) => {
    assert.include(byline, "variant?: 'inline' | 'stacked'")
    assert.include(byline, "variant === 'stacked'")
  })

  test('clés i18n présentes en FR et EN (pluriel)', ({ assert }) => {
    for (const lang of ['fr', 'en'] as const) {
      assert.isString(lookup(locales[lang], 'authors.byline.others_one'), lang)
      assert.isString(lookup(locales[lang], 'authors.byline.others_other'), lang)
      assert.isString(lookup(locales[lang], 'production_detail.authors'), lang)
    }
    assert.include(locales.fr.authors.byline.others_other, '{{count}}')
    assert.include(locales.en.authors.byline.others_other, '{{count}}')
  })
})

test.group('ProductionCard | byline (10.4)', () => {
  test('byline hors du lien du titre, après lui (pas de <a> imbriqué)', ({ assert }) => {
    assert.include(card, '<AuthorByline')
    assert.include(card, 'max={CARD_MAX_AUTHORS}')
    assert.include(card, 'const CARD_MAX_AUTHORS = 3')
    // Le Link du titre ne contient que le titre.
    assert.match(card, /<Link href=\{`\/productions\/\$\{slug\}`\}[^>]*>\s*\{title\}\s*<\/Link>/)
    // Ordre dans la carte : titre puis byline.
    for (const variant of card.split("if (variant === 'list')")) {
      if (!variant.includes('{titleLink}')) continue
      assert.isBelow(variant.indexOf('{titleLink}'), variant.indexOf('{byline}'))
    }
  })

  test('type AuthorCredit { name, slug | null } et propre nom du profil', ({ assert }) => {
    assert.include(card, 'export type AuthorCredit = { name: string; slug: string | null }')
    assert.include(card, 'authors: AuthorCredit[]')
    assert.include(card, 'currentSlug={currentAuthorSlug}')
    assert.include(profile, 'currentAuthorSlug={author.slug}')
  })
})

test.group('Page de détail | auteurs (10.4)', () => {
  test('byline sans troncature et aside « Auteurs » empilé', ({ assert }) => {
    assert.include(detail, '<AuthorByline authors={production.authors} />')
    assert.include(detail, "t('production_detail.authors')")
    assert.include(detail, '<AuthorByline authors={production.authors} variant="stacked" />')
    assert.notInclude(detail, 'production.authors.join')
  })
})

test.group('Titre d’onglet public (10.4, report Epic 5)', () => {
  test('PublicLayout pose le titre serveur via <Head>', ({ assert }) => {
    assert.include(layout, "import { Head, usePage } from '@inertiajs/react'")
    assert.include(layout, '<Head title={documentTitle(props.meta?.title)} />')
  })

  test('callback title du point d’entrée public sans suffixe', ({ assert }) => {
    assert.include(app, 'title: (title) => title || appName')
  })
})

test.group('formatAuthorName (serveur)', () => {
  test('« Prénom NOM », nom en capitales, casse des prénoms gardée', ({ assert }) => {
    assert.equal(formatAuthorName('Jeanne', 'Exemple'), 'Jeanne EXEMPLE')
    assert.equal(formatAuthorName('Marie-Ève', 'de la Modèle'), 'Marie-Ève DE LA MODÈLE')
    assert.equal(formatAuthorName('', 'Seul'), 'SEUL')
  })
})
