import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Story 11.4 — logique pure de la page « À la une » (`inertia/lib/featured.ts`), chargée à
 * l'exécution (aucun import statique : frontière TS6305).
 */
type Item = {
  id: string
  title: string
  authors: ({ firstNames: string; lastNames: string } | { name: string })[]
  category: string | null
  domain: string | null
  imageState: 'thumbnail' | 'poster' | 'missing'
  hasThumbnail: boolean
  requiresThumbnail: boolean
  thumbnailPreviewUrl: string | null
  posterPreviewUrl: string | null
  viewsCount: number
  downloadsCount: number
  unavailable: boolean
}

type FeaturedModule = {
  FEATURED_MAX_SLOTS: number
  isMissingThumbnail: (item: Item) => boolean
  previewImage: (item: Item) => string | null
  blockedSlots: (items: Item[]) => number[]
  displayedItems: (items: Item[]) => Item[]
  isDirty: (baseline: string[], items: Item[]) => boolean
  moveSlot: (items: Item[], index: number, delta: -1 | 1) => Item[]
  removeSlot: (items: Item[], index: number) => Item[]
  mergeRefreshed: (items: Item[], refreshed: Item[]) => Item[]
  bannerLayout: (count: number) => string
  shouldConfirmLeave: (state: { dirty: boolean; ownVisit: boolean }) => boolean
  isOwnVisit: (visit: { method: string; pathname: string }, ids: string[]) => boolean
  saveSucceeded: (answer: {
    component: string
    sentIds: string[]
    selection: { id: string }[] | null | undefined
  }) => boolean
  saveError: (
    errors: Record<string, unknown> | null | undefined,
    fallback: string
  ) => { key: string; position: number | null }
  authorLabels: (authors: Item['authors'], format: (f: string, l: string) => string) => string[]
  slotIssue: (item: Item) => string | null
  waitingSlots: (items: Item[]) => number[]
  FEATURED_PAGE_COMPONENT: string
  firstErrorKey: (errors: Record<string, unknown> | null | undefined, fallback: string) => string
  imageStateOf: (item: Pick<Item, 'hasThumbnail' | 'requiresThumbnail'>) => string
}

const load = async (): Promise<FeaturedModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/featured.ts')).href)

const item = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  title: `T ${id}`,
  authors: [],
  category: null,
  domain: null,
  imageState: 'thumbnail',
  hasThumbnail: true,
  requiresThumbnail: true,
  thumbnailPreviewUrl: `https://img/${id}`,
  posterPreviewUrl: null,
  viewsCount: 0,
  downloadsCount: 0,
  unavailable: false,
  ...overrides,
})

const missing = (id: string) =>
  item(id, { imageState: 'missing', hasThumbnail: false, thumbnailPreviewUrl: null })
const poster = (id: string) =>
  item(id, {
    imageState: 'poster',
    hasThumbnail: false,
    requiresThumbnail: false,
    thumbnailPreviewUrl: null,
    posterPreviewUrl: `https://poster/${id}`,
  })

test.group('featured | état des emplacements (11.4)', () => {
  test('vignette manquante seulement sans vignette ni image extraite', async ({ assert }) => {
    const lib = await load()
    assert.equal(lib.FEATURED_MAX_SLOTS, 3)
    assert.isFalse(lib.isMissingThumbnail(item('a')))
    assert.isFalse(lib.isMissingThumbnail(poster('b')))
    assert.isTrue(lib.isMissingThumbnail(missing('c')))
    assert.equal(lib.imageStateOf({ hasThumbnail: true, requiresThumbnail: true }), 'thumbnail')
    assert.equal(lib.imageStateOf({ hasThumbnail: false, requiresThumbnail: false }), 'poster')
    assert.equal(lib.imageStateOf({ hasThumbnail: false, requiresThumbnail: true }), 'missing')
  })

  test('image d’aperçu : vignette, sinon image extraite', async ({ assert }) => {
    const lib = await load()
    assert.equal(lib.previewImage(item('a')), 'https://img/a')
    assert.equal(lib.previewImage(poster('b')), 'https://poster/b')
    assert.isNull(lib.previewImage(missing('c')))
    // Vignette posée mais URL non signée : pas de repli sur le poster (la vignette prime).
    assert.isNull(
      lib.previewImage(item('d', { thumbnailPreviewUrl: null, posterPreviewUrl: 'https://p' }))
    )
  })

  test('emplacements bloquants (positions 1..n) et emplacements affichés', async ({ assert }) => {
    const lib = await load()
    const items = [item('a'), missing('b'), poster('c')]
    assert.deepEqual(lib.blockedSlots(items), [2])
    assert.deepEqual(
      lib.displayedItems(items).map((i) => i.id),
      ['a', 'c']
    )
    assert.deepEqual(lib.blockedSlots([missing('x'), missing('y')]), [1, 2])
    assert.deepEqual(lib.blockedSlots([]), [])
  })

  test('changements non enregistrés : ordre et contenu comparés à la sélection enregistrée', async ({
    assert,
  }) => {
    const lib = await load()
    assert.isFalse(lib.isDirty(['a', 'b'], [item('a'), item('b')]))
    assert.isTrue(lib.isDirty(['a', 'b'], [item('b'), item('a')]))
    assert.isTrue(lib.isDirty(['a', 'b'], [item('a')]))
    assert.isTrue(lib.isDirty([], [item('a')]))
    assert.isFalse(lib.isDirty([], []))
  })

  test('↑ ↓ permutent avec le voisin ; « Retirer » fait remonter les suivants (D30)', async ({
    assert,
  }) => {
    const lib = await load()
    const items = [item('a'), item('b'), item('c')]
    assert.deepEqual(
      lib.moveSlot(items, 2, -1).map((i) => i.id),
      ['a', 'c', 'b']
    )
    assert.deepEqual(
      lib.moveSlot(items, 0, 1).map((i) => i.id),
      ['b', 'a', 'c']
    )
    assert.deepEqual(
      lib.moveSlot(items, 0, -1).map((i) => i.id),
      ['a', 'b', 'c']
    )
    assert.deepEqual(
      lib.moveSlot(items, 2, 1).map((i) => i.id),
      ['a', 'b', 'c']
    )
    assert.deepEqual(
      lib.removeSlot(items, 0).map((i) => i.id),
      ['b', 'c']
    )
    assert.deepEqual(
      lib.removeSlot(items, 5).map((i) => i.id),
      ['a', 'b', 'c']
    )
    // Jamais de mutation de l'état d'origine.
    assert.deepEqual(
      items.map((i) => i.id),
      ['a', 'b', 'c']
    )
  })

  test('rafraîchissement : états remplacés par id, production supprimée retirée (revue)', async ({
    assert,
  }) => {
    const lib = await load()
    const items = [missing('a'), item('b'), item('c')]
    const merged = lib.mergeRefreshed(items, [
      item('c', { unavailable: true }),
      item('a', { title: 'Nouveau' }),
    ])
    assert.deepEqual(
      merged.map((i) => [i.id, i.hasThumbnail, i.unavailable]),
      [
        ['a', true, false],
        ['c', true, true],
      ]
    )
    assert.equal(merged[0].title, 'Nouveau')
  })

  test('production non publiée : bloquante, jamais affichée, pas « en attente de vignette »', async ({
    assert,
  }) => {
    const lib = await load()
    const items = [item('a'), item('b', { unavailable: true }), missing('c')]
    assert.equal(lib.slotIssue(items[1]), 'unavailable')
    assert.equal(lib.slotIssue(items[2]), 'missing')
    assert.isNull(lib.slotIssue(items[0]))
    assert.deepEqual(lib.blockedSlots(items), [2, 3])
    assert.deepEqual(lib.waitingSlots(items), [3])
    assert.deepEqual(
      lib.displayedItems(items).map((i) => i.id),
      ['a']
    )
  })

  test('noms d’auteurs : fiches formatées, noms libres tels quels', async ({ assert }) => {
    const lib = await load()
    const format = (f: string, l: string) => `${f} ${l.toUpperCase()}`
    assert.deepEqual(
      lib.authorLabels(
        [{ firstNames: 'Awa', lastNames: 'Fictive' }, { name: 'Libre NOM' }],
        format
      ),
      ['Awa FICTIVE', 'Libre NOM']
    )
  })
})

test.group('featured | disposition, sortie, erreurs (11.4)', () => {
  test('disposition de la bannière selon le nombre (D35)', async ({ assert }) => {
    const lib = await load()
    assert.equal(lib.bannerLayout(0), 'none')
    assert.equal(lib.bannerLayout(1), 'single')
    assert.equal(lib.bannerLayout(2), 'columns')
    assert.equal(lib.bannerLayout(3), 'lead')
  })

  test('confirmation de sortie : changements non enregistrés, hors visites de la page', async ({
    assert,
  }) => {
    const lib = await load()
    assert.isTrue(lib.shouldConfirmLeave({ dirty: true, ownVisit: false }))
    assert.isFalse(lib.shouldConfirmLeave({ dirty: true, ownVisit: true }))
    assert.isFalse(lib.shouldConfirmLeave({ dirty: false, ownVisit: false }))
  })

  test('visites de la page reconnues par méthode + chemin, jamais un lien de navigation', async ({
    assert,
  }) => {
    const lib = await load()
    const ids = ['a1', 'b2']
    assert.isTrue(lib.isOwnVisit({ method: 'put', pathname: '/admin/featured' }, ids))
    assert.isTrue(
      lib.isOwnVisit({ method: 'post', pathname: '/admin/productions/a1/thumbnail' }, ids)
    )
    assert.isTrue(
      lib.isOwnVisit({ method: 'DELETE', pathname: '/admin/productions/B2/thumbnail' }, ids)
    )
    // Lien de la barre latérale pendant un téléversement : confirmation demandée.
    assert.isFalse(lib.isOwnVisit({ method: 'get', pathname: '/admin/productions' }, ids))
    assert.isFalse(lib.isOwnVisit({ method: 'get', pathname: '/admin/featured' }, ids))
    assert.isFalse(lib.isOwnVisit({ method: 'post', pathname: '/admin/logout' }, ids))
    assert.isFalse(
      lib.isOwnVisit({ method: 'post', pathname: '/admin/productions/zz/thumbnail' }, ids)
    )
    assert.isFalse(lib.isOwnVisit({ method: 'put', pathname: '/admin/productions/a1' }, ids))
  })

  test('succès d’enregistrement : page « À la une » et sélection renvoyée = envoyée', async ({
    assert,
  }) => {
    const lib = await load()
    const component = lib.FEATURED_PAGE_COMPONENT
    assert.equal(component, 'admin/Featured/Index')
    assert.isTrue(
      lib.saveSucceeded({ component, sentIds: ['a', 'b'], selection: [{ id: 'a' }, { id: 'b' }] })
    )
    assert.isTrue(lib.saveSucceeded({ component, sentIds: [], selection: [] }))
    // Jeton CSRF expiré : retour sur la page avec l'ancienne sélection.
    assert.isFalse(lib.saveSucceeded({ component, sentIds: ['a', 'b'], selection: [{ id: 'a' }] }))
    assert.isFalse(
      lib.saveSucceeded({ component, sentIds: ['a', 'b'], selection: [{ id: 'b' }, { id: 'a' }] })
    )
    // Session expirée : page de connexion.
    assert.isFalse(
      lib.saveSucceeded({ component: 'admin/Auth/Login', sentIds: [], selection: undefined })
    )
    assert.isFalse(lib.saveSucceeded({ component, sentIds: [], selection: null }))
  })

  test('erreur d’enregistrement : clé et emplacement nommé par le serveur', async ({ assert }) => {
    const lib = await load()
    const fallback = 'featured.errors.storage'
    assert.deepEqual(
      lib.saveError({ productionIds: 'featured.errors.not_published', position: '2' }, fallback),
      { key: 'featured.errors.not_published', position: 2 }
    )
    assert.deepEqual(lib.saveError({ productionIds: 'featured.errors.too_many' }, fallback), {
      key: 'featured.errors.too_many',
      position: null,
    })
    assert.deepEqual(lib.saveError({ 'productionIds.0': 'featured.errors.invalid' }, fallback), {
      key: 'featured.errors.invalid',
      position: null,
    })
    assert.deepEqual(lib.saveError({ position: 'x' }, fallback), { key: fallback, position: null })
    assert.deepEqual(lib.saveError(null, fallback), { key: fallback, position: null })
  })

  test('clé d’erreur : productionIds, sinon un élément, sinon générique', async ({ assert }) => {
    const lib = await load()
    const fallback = 'featured.errors.storage'
    assert.equal(
      lib.firstErrorKey({ productionIds: 'featured.errors.too_many' }, fallback),
      'featured.errors.too_many'
    )
    assert.equal(
      lib.firstErrorKey({ 'productionIds.1': 'featured.errors.invalid' }, fallback),
      'featured.errors.invalid'
    )
    assert.equal(
      lib.firstErrorKey({ productionIds: ['featured.errors.x'] }, fallback),
      'featured.errors.x'
    )
    assert.equal(lib.firstErrorKey({}, fallback), fallback)
    assert.equal(lib.firstErrorKey(null, fallback), fallback)
  })
})
