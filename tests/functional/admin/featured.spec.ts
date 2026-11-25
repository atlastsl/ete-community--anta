import { test } from '@japa/runner'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import Author from '#models/author'
import Production from '#models/production'
import ProductionFile from '#models/production_file'
import ProductionLink from '#models/production_link'
import FeaturedService, { FeaturedError } from '#services/featured_service'
import ThumbnailService from '#services/thumbnail_service'

// Story 11.4 — page admin « À la une » (FR47, FR50, P2.1, P2.6). Données fictives uniquement.

const BACK = '/admin/featured'
let counter = 0

async function createAdminUser(role: 'admin' | 'super_admin' = 'admin'): Promise<AdminUser> {
  return AdminUser.create({
    email: `featured-${Date.now()}-${counter++}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role,
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

/** Production publiée avec vignette par défaut (valide pour la une). */
async function createProduction(overrides: Partial<Production> = {}): Promise<Production> {
  const id = counter++
  return Production.create({
    title: `Production fictive ${id}`,
    authorNames: [],
    tags: [],
    category: 'article',
    domain: 'mathematics',
    licenseStatus: 'member',
    status: 'published',
    thumbnailKey: `thumbnails/00000000-0000-4000-8000-${String(id).padStart(12, '0')}/${'a'.repeat(20)}`,
    createdById: null,
    ...overrides,
  })
}

async function addVideo(production: Production, posterKey: string | null) {
  return ProductionFile.create({
    productionId: production.id,
    fileKey: `productions/${production.id}/video-${counter++}.mp4`,
    originalName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 10,
    storageProvider: 'r2',
    posterKey,
  })
}

async function storedSelection(): Promise<string[]> {
  const rows = await db.from('featured_productions').orderBy('position', 'asc')
  return rows.map((row: { production_id: string }) => row.production_id)
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).props
}

function flashedErrors(flash: Record<string, any>): Record<string, string> {
  const raw = (flash.errors ?? flash.inputErrorsBag ?? {}) as Record<string, string | string[]>
  return Object.fromEntries(
    Object.entries(raw).map(([field, value]) => [field, Array.isArray(value) ? value[0] : value])
  )
}

const put = (client: any, admin: AdminUser, productionIds: unknown) =>
  client
    .put('/admin/featured')
    .header('referer', BACK)
    .json({ productionIds })
    .loginAs(admin)
    .withCsrfToken()
    .redirects(0)

function withTransaction(group: any) {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })
}

test.group('Admin featured | migration', () => {
  test('featured_productions : colonnes et contraintes', async ({ assert }) => {
    const columns = await db.rawQuery(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'featured_productions'
        ORDER BY column_name`
    )
    assert.deepEqual(
      columns.rows.map((r: any) => [r.column_name, r.data_type, r.is_nullable]),
      [
        ['created_at', 'timestamp with time zone', 'NO'],
        ['created_by_id', 'uuid', 'YES'],
        ['position', 'smallint', 'NO'],
        ['production_id', 'uuid', 'NO'],
      ]
    )
    const constraints = await db.rawQuery(
      `SELECT pg_get_constraintdef(c.oid) AS def, c.contype
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'featured_productions'`
    )
    const defs = constraints.rows.map((r: any) => `${r.contype} ${r.def}`)
    assert.isTrue(defs.includes('p PRIMARY KEY ("position")'), defs.join(' | '))
    assert.isTrue(defs.includes('u UNIQUE (production_id)'), defs.join(' | '))
    assert.isTrue(
      defs.some(
        (d: string) =>
          d.startsWith('c CHECK') && d.includes('"position" >= 1') && d.includes('"position" <= 3')
      ),
      defs.join(' | ')
    )
    assert.isTrue(
      defs.some((d: string) => d.includes('REFERENCES productions(id) ON DELETE CASCADE')),
      defs.join(' | ')
    )
    assert.isTrue(
      defs.some((d: string) => d.includes('REFERENCES admin_users(id) ON DELETE SET NULL')),
      defs.join(' | ')
    )
  })

  test('position hors 1..3 refusée par la base', async ({ assert }) => {
    await db.beginGlobalTransaction()
    try {
      const production = await createProduction()
      await assert.rejects(() =>
        db.table('featured_productions').insert({ position: 4, production_id: production.id })
      )
    } finally {
      await db.rollbackGlobalTransaction()
    }
  })
})

test.group('Admin featured | page', (group) => {
  withTransaction(group)

  test('invité → redirigé vers la connexion', async ({ client }) => {
    const response = await client.get('/admin/featured').redirects(0)
    response.assertStatus(302)
    response.assertHeader('location', '/admin/login')
  })

  test('admin simple → page avec la sélection ordonnée et l’état des vignettes', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser('admin')
    const withThumbnail = await createProduction({ authorNames: ['Awa FICTIVE'] })
    const withPoster = await createProduction({ thumbnailKey: null })
    const posterFile = await addVideo(withPoster, `posters/x/${'b'.repeat(20)}`)
    await db.table('featured_productions').multiInsert([
      { position: 1, production_id: withPoster.id },
      { position: 2, production_id: withThumbnail.id },
    ])
    await db
      .table('stats_views')
      .multiInsert([{ production_id: withThumbnail.id }, { production_id: withThumbnail.id }])
    await db.table('stats_downloads').insert({ production_id: withThumbnail.id })

    const response = await client.get('/admin/featured').loginAs(admin)
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.deepEqual(
      props.selection.map((item: any) => item.id),
      [withPoster.id, withThumbnail.id]
    )
    const [poster, thumbnail] = props.selection
    assert.equal(poster.imageState, 'poster')
    assert.isFalse(poster.hasThumbnail)
    assert.isFalse(poster.requiresThumbnail)
    assert.equal(thumbnail.imageState, 'thumbnail')
    assert.isTrue(thumbnail.hasThumbnail)
    assert.isTrue(thumbnail.requiresThumbnail)
    assert.deepEqual(thumbnail.authors, [{ name: 'Awa FICTIVE' }])
    assert.equal(thumbnail.viewsCount, 2)
    assert.equal(thumbnail.downloadsCount, 1)
    assert.isFalse(thumbnail.unavailable)
    assert.equal(poster.viewsCount, 0)
    assert.equal(thumbnail.category, 'article')
    assert.equal(thumbnail.domain, 'mathematics')
    assert.properties(thumbnail, ['title', 'thumbnailPreviewUrl', 'posterPreviewUrl'])
    assert.notProperty(poster, 'posterKey')
    assert.isNotNull(posterFile.id)
  })
})

test.group('Admin featured | page (revue)', (group) => {
  withTransaction(group)

  test('auteurs du référentiel (prénoms / noms) puis noms libres non rattachés', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction({ authorNames: ['Kofi FICTIF', 'Libre SANSFICHE'] })
    const author = await Author.create({ firstNames: 'Kofi', lastNames: 'Fictif' })
    await db
      .table('production_authors')
      .insert({ production_id: production.id, author_id: author.id, position: 1 })
    await db.table('featured_productions').insert({ position: 1, production_id: production.id })

    const response = await client.get('/admin/featured').loginAs(admin)
    const props = extractProps(response.text())
    assert.deepEqual(props.selection[0].authors, [
      { firstNames: 'Kofi', lastNames: 'Fictif' },
      { name: 'Libre SANSFICHE' },
    ])
  })

  test('production enregistrée devenue non publiée → unavailable', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const production = await createProduction({ status: 'unpublished' })
    await db.table('featured_productions').insert({ position: 1, production_id: production.id })

    const response = await client.get('/admin/featured').loginAs(admin)
    const props = extractProps(response.text())
    assert.isTrue(props.selection[0].unavailable)
  })
})

test.group('Admin featured | enregistrement', (group) => {
  withTransaction(group)

  test('enregistrement ordonné → positions 1..n, created_by, journal before/after', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const [a, b, c] = [await createProduction(), await createProduction(), await createProduction()]

    const response = await put(client, admin, [c.id, a.id, b.id])

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.deepEqual(await storedSelection(), [c.id, a.id, b.id])
    const rows = await db.from('featured_productions').orderBy('position')
    assert.deepEqual(
      rows.map((r: any) => r.position),
      [1, 2, 3]
    )
    assert.isTrue(rows.every((r: any) => r.created_by_id === admin.id))
    // Pas de flash de succès : le toast vient de la page (D-11.4-6).
    assert.notProperty(response.flashMessages(), 'success')

    const logs = await AdminActivityLog.query().where('actionType', 'featured_update')
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].adminUserId, admin.id)
    assert.equal(logs[0].resourceType, 'featured_selection')
    assert.isNull(logs[0].resourceId)
    assert.deepEqual(logs[0].metadata, { before: [], after: [c.id, a.id, b.id] })
  })

  test('remplacement et réordonnancement → DELETE + INSERT sans conflit de clé', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const [a, b, c] = [await createProduction(), await createProduction(), await createProduction()]
    await put(client, admin, [a.id, b.id, c.id])

    const response = await put(client, admin, [c.id, b.id])

    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    assert.deepEqual(await storedSelection(), [c.id, b.id])
    const logs = await AdminActivityLog.query()
      .where('actionType', 'featured_update')
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc')
    assert.lengthOf(logs, 2)
    const last = logs.find((log) => (log.metadata as any).after.length === 2)!
    assert.deepEqual(last.metadata, { before: [a.id, b.id, c.id], after: [c.id, b.id] })
  })

  test('sélection vide → bannière retirée (FR47)', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    await put(client, admin, [a.id])

    const response = await put(client, admin, [])

    response.assertStatus(302)
    assert.deepEqual(await storedSelection(), [])
  })

  test('sélection identique → rien d’écrit ni journalisé (D-11.4-4)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    await put(client, admin, [a.id])
    const before = await db.from('featured_productions').first()

    const response = await put(client, admin, [a.id])

    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    const after = await db.from('featured_productions').first()
    assert.equal(after.created_at.toISOString(), before.created_at.toISOString())
    assert.lengthOf(await AdminActivityLog.query().where('actionType', 'featured_update'), 1)
  })

  test('> 3 productions refusé', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const productions = [
      await createProduction(),
      await createProduction(),
      await createProduction(),
      await createProduction(),
    ]
    const ids = productions.map((production) => production.id)

    const response = await put(client, admin, ids)

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.equal(flashedErrors(response.flashMessages()).productionIds, 'featured.errors.too_many')
    assert.deepEqual(await storedSelection(), [])
  })

  test('doublon, id mal formé ou champ absent refusés', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const a = await createProduction()

    const duplicate = await put(client, admin, [a.id, a.id])
    assert.equal(
      flashedErrors(duplicate.flashMessages()).productionIds,
      'featured.errors.duplicate'
    )
    const malformed = await put(client, admin, ['not-a-uuid'])
    assert.include(
      Object.values(flashedErrors(malformed.flashMessages())),
      'featured.errors.invalid'
    )
    const missing = await client
      .put('/admin/featured')
      .header('referer', BACK)
      .json({})
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
    assert.equal(flashedErrors(missing.flashMessages()).productionIds, 'featured.errors.invalid')
    assert.deepEqual(await storedSelection(), [])
  })

  test('même uuid en majuscules et minuscules → doublon, jamais une erreur de stockage', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createProduction()

    const response = await put(client, admin, [a.id.toUpperCase(), a.id])

    response.assertStatus(302)
    assert.deepEqual(flashedErrors(response.flashMessages()), {
      productionIds: 'featured.errors.duplicate',
    })
    assert.deepEqual(await storedSelection(), [])
  })

  test('uuid en majuscules seul → enregistré en minuscules', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    const response = await put(client, admin, [a.id.toUpperCase()])
    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    assert.deepEqual(await storedSelection(), [a.id])
  })

  test('brouillon ou dépubliée refusée, sélection inchangée', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const published = await createProduction()
    const draft = await createProduction({ status: 'draft' })
    const unpublished = await createProduction({ status: 'unpublished' })
    await put(client, admin, [published.id])

    for (const production of [draft, unpublished]) {
      const response = await put(client, admin, [published.id, production.id])
      response.assertStatus(302)
      response.assertHeader('location', BACK)
      // L'emplacement refusé est nommé (revue 11.4).
      assert.deepEqual(flashedErrors(response.flashMessages()), {
        productionIds: 'featured.errors.not_published',
        position: '2',
      })
    }
    assert.deepEqual(await storedSelection(), [published.id])
    assert.lengthOf(await AdminActivityLog.query().where('actionType', 'featured_update'), 1)
  })

  test('vignette manquante refusée ; image extraite acceptée ; vidéo externe refusée', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const bare = await createProduction({ thumbnailKey: null })
    const withPoster = await createProduction({ thumbnailKey: null })
    await addVideo(withPoster, `posters/x/${'c'.repeat(20)}`)
    const posterless = await createProduction({ thumbnailKey: null })
    await addVideo(posterless, null)
    const external = await createProduction({ thumbnailKey: null, category: 'video' })
    await ProductionLink.create({
      productionId: external.id,
      url: 'https://video.example.com/watch',
      linkType: 'simple',
      label: null,
    })

    for (const production of [bare, posterless, external]) {
      const response = await put(client, admin, [production.id])
      assert.equal(
        flashedErrors(response.flashMessages()).productionIds,
        'featured.errors.thumbnail_required'
      )
    }
    assert.deepEqual(await storedSelection(), [])

    const ok = await put(client, admin, [withPoster.id])
    assert.deepEqual(flashedErrors(ok.flashMessages()), {})
    assert.deepEqual(await storedSelection(), [withPoster.id])
  })

  test('production inconnue refusée', async ({ client, assert }) => {
    const admin = await createAdminUser()
    const response = await put(client, admin, ['00000000-0000-4000-8000-000000000999'])
    assert.equal(flashedErrors(response.flashMessages()).productionIds, 'featured.errors.not_found')
  })

  test('échec de la base → erreur de stockage flashée, jamais une page d’erreur', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    const original = FeaturedService.save
    FeaturedService.save = async () => {
      throw new Error('db down')
    }
    try {
      const response = await put(client, admin, [a.id])
      response.assertStatus(302)
      response.assertHeader('location', BACK)
      assert.equal(flashedErrors(response.flashMessages()).productionIds, 'featured.errors.storage')
    } finally {
      FeaturedService.save = original
    }
  })

  test('suppression d’une production → emplacement supprimé (CASCADE)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    await put(client, admin, [a.id])
    await db.from('productions').where('id', a.id).delete()
    assert.deepEqual(await storedSelection(), [])
  })
})

test.group('Admin featured | candidats', (group) => {
  withTransaction(group)

  const candidates = (client: any, admin: AdminUser, qs: string) =>
    client.get(`/admin/featured/candidates?${qs}`).loginAs(admin)

  test('publiées seulement, par titre, avec état de vignette ; exclusion', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const published = await createProduction({ title: 'Hydrologie fictive du bassin' })
    const bare = await createProduction({
      title: 'Hydrologie fictive des lacs',
      thumbnailKey: null,
    })
    await createProduction({ title: 'Hydrologie fictive brouillon', status: 'draft' })
    await createProduction({ title: 'Hydrologie fictive retirée', status: 'unpublished' })

    const response = await candidates(client, admin, 'q=hydrologie')
    response.assertStatus(200)
    const items = response.body().productions
    assert.sameMembers(
      items.map((item: any) => item.id),
      [published.id, bare.id]
    )
    const bareItem = items.find((item: any) => item.id === bare.id)
    assert.equal(bareItem.imageState, 'missing')
    assert.isTrue(bareItem.requiresThumbnail)

    const excluded = await candidates(
      client,
      admin,
      `q=hydrologie&exclude[]=${published.id}&exclude[]=nope`
    )
    assert.deepEqual(
      excluded.body().productions.map((item: any) => item.id),
      [bare.id]
    )
  })

  test('par auteur : noms dénormalisés ou fiche du référentiel (sans accents)', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const byName = await createProduction({ authorNames: ['Zéphyrine QUIMBOLO'] })
    const byPivot = await createProduction()
    const author = await Author.create({ firstNames: 'Zéphyrine', lastNames: 'QUIMBOLO' })
    await db
      .table('production_authors')
      .insert({ production_id: byPivot.id, author_id: author.id, position: 1 })

    // Sans accent : la fiche du référentiel (`search_name` normalisé) est trouvée.
    const response = await candidates(client, admin, 'q=zephyrine')
    assert.include(
      response.body().productions.map((item: any) => item.id),
      byPivot.id
    )
    const accented = await candidates(client, admin, 'q=QUIMBOLO')
    assert.sameMembers(
      accented.body().productions.map((item: any) => item.id),
      [byName.id, byPivot.id]
    )
  })

  test('terme < 2 caractères → aucun résultat ; ids[] → ces productions publiées', async ({
    client,
    assert,
  }) => {
    const admin = await createAdminUser()
    const a = await createProduction()
    const b = await createProduction({ thumbnailKey: null })
    const draft = await createProduction({ status: 'draft' })

    const short = await candidates(client, admin, 'q=a')
    assert.deepEqual(short.body().productions, [])

    const refreshed = await candidates(
      client,
      admin,
      `ids[]=${b.id}&ids[]=${a.id}&ids[]=${draft.id}&ids[]=bad&ids[]=00000000-0000-4000-8000-000000000999`
    )
    refreshed.assertStatus(200)
    // Tous statuts (non publiée = unavailable), supprimée absente (revue 11.4).
    assert.deepEqual(
      refreshed.body().productions.map((item: any) => [item.id, item.unavailable]),
      [
        [b.id, false],
        [a.id, false],
        [draft.id, true],
      ]
    )
  })

  test('invité → pas de JSON', async ({ client }) => {
    const response = await client.get('/admin/featured/candidates?q=test').redirects(0)
    response.assertStatus(302)
  })
})

test.group('Admin featured | retrait de vignette', (group) => {
  withTransaction(group)

  const TMP = join(tmpdir(), 'anta-test-featured')
  mkdirSync(TMP, { recursive: true })

  async function withRealThumbnail(production: Production) {
    const path = join(TMP, `t-${counter++}.png`)
    writeFileSync(
      path,
      await sharp({
        create: { width: 320, height: 180, channels: 3, background: { r: 10, g: 120, b: 60 } },
      })
        .png()
        .toBuffer()
    )
    const { default: ImageService } = await import('#services/image_service')
    await ThumbnailService.set(production, await ImageService.thumbnailVariants(path))
    return production.thumbnailKey!
  }

  const destroy = (client: any, admin: AdminUser, productionId: string) =>
    client
      .delete(`/admin/productions/${productionId}/thumbnail`)
      .header('referer', BACK)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

  test('production à la une sans image extraite → retrait refusé, rien journalisé', async ({
    client,
    assert,
  }) => {
    const fakeDisk = drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction({ thumbnailKey: null })
    const key = await withRealThumbnail(production)
    await put(client, admin, [production.id])

    const response = await destroy(client, admin, production.id)

    response.assertStatus(302)
    response.assertHeader('location', BACK)
    assert.equal(
      flashedErrors(response.flashMessages()).thumbnail,
      'thumbnail.errors.required_for_featured'
    )
    await production.refresh()
    assert.equal(production.thumbnailKey, key)
    fakeDisk.assertExists(ThumbnailService.keys(key))
    const logs = await AdminActivityLog.query()
      .where('resourceId', production.id)
      .where('actionType', 'update')
    assert.isFalse(logs.some((log) => (log.metadata as any)?.op === 'remove'))
  })

  test('production à la une avec image extraite → retrait permis', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction({ thumbnailKey: null })
    await withRealThumbnail(production)
    await addVideo(production, `posters/x/${'d'.repeat(20)}`)
    await put(client, admin, [production.id])

    const response = await destroy(client, admin, production.id)

    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    await production.refresh()
    assert.isNull(production.thumbnailKey)
  })

  test('production hors de la une → retrait permis', async ({ client, assert }) => {
    drive.fake('r2')
    const admin = await createAdminUser()
    const production = await createProduction({ thumbnailKey: null })
    await withRealThumbnail(production)

    const response = await destroy(client, admin, production.id)

    assert.deepEqual(flashedErrors(response.flashMessages()), {})
    await production.refresh()
    assert.isNull(production.thumbnailKey)
  })
})

test.group('Admin featured | ordre des verrous (D-11.4-5)', () => {
  // Deux connexions réelles (pas de transaction globale) : la suppression d'une production
  // verrouille sa ligne puis son CASCADE a besoin de `featured_productions` ; `save` doit
  // prendre les lignes avant la table, sinon interblocage (constaté à la revue).
  test('suppression concurrente d’une production → pas d’interblocage, save refuse not_found', async ({
    assert,
  }) => {
    const admin = await createAdminUser()
    const production = await createProduction()
    const deleter = await db.transaction()
    try {
      await deleter.rawQuery("SET LOCAL lock_timeout = '5s'")
      await deleter.rawQuery('SELECT id FROM productions WHERE id = ? FOR UPDATE', [production.id])

      const saving = FeaturedService.save([production.id], admin.id).then(
        () => null,
        (error: unknown) => error
      )
      // `save` attend la ligne (FOR SHARE) sans avoir pris le verrou de table.
      await new Promise((resolve) => setTimeout(resolve, 300))
      await deleter.rawQuery('DELETE FROM productions WHERE id = ?', [production.id])
      await deleter.commit()

      const error = await saving
      assert.instanceOf(error, FeaturedError)
      assert.equal((error as FeaturedError).code, 'not_found')
      assert.deepEqual(await storedSelection(), [])
    } catch (error) {
      if (!deleter.isCompleted) await deleter.rollback()
      throw error
    } finally {
      await db.from('productions').where('id', production.id).delete()
      await db.from('admin_users').where('id', admin.id).delete()
    }
  }).timeout(15_000)

  test('ordre des instructions : lignes FOR SHARE puis LOCK TABLE', ({ assert }) => {
    const source = readFileSync(join(process.cwd(), 'app/services/featured_service.ts'), 'utf-8')
    const body = source.slice(source.indexOf('static async save('))
    assert.isBelow(
      body.indexOf('await this.assertFeaturable(ids, trx)'),
      body.indexOf('LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE')
    )
  })
})
