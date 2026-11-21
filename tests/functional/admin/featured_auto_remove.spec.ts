import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import Production from '#models/production'
import ProductionLink from '#models/production_link'
import ActionType from '#enums/action_type'
import FeaturedService from '#services/featured_service'
import ProductionService from '#services/production_service'

// Story 11.5 — retrait automatique d'une production à la une (FR51, D21, D30, P2.6).
// Données fictives uniquement.

let counter = 0

async function createAdminUser(): Promise<AdminUser> {
  return AdminUser.create({
    email: `auto-remove-${Date.now()}-${counter++}@anta.test`,
    passwordHash: 'plain-password-hashed-by-mixin',
    role: 'admin',
    passwordChanged: true,
    isActive: true,
    createdById: null,
  })
}

/** Production publiée avec vignette (valide pour la une). */
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

type StoredSlot = { position: number; production_id: string; created_by_id: string | null }

async function storedSlots(): Promise<StoredSlot[]> {
  return db
    .from('featured_productions')
    .orderBy('position', 'asc')
    .select('position', 'production_id', 'created_by_id')
}

async function storedSelection(): Promise<string[]> {
  const slots = await storedSlots()
  return slots.map((row) => row.production_id)
}

async function autoRemoveLogs(productionId: string) {
  return AdminActivityLog.query()
    .where('actionType', 'featured_auto_remove')
    .where('resourceId', productionId)
}

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).props
}

function withTransaction(group: any) {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return async () => {
      drive.restore('r2')
      await db.rollbackGlobalTransaction()
    }
  })
}

/** Trois productions à la une, posées par `owner`. */
async function featuredThree(owner: AdminUser): Promise<[Production, Production, Production]> {
  const a = await createProduction()
  const b = await createProduction()
  const c = await createProduction()
  await FeaturedService.save([a.id, b.id, c.id], owner.id)
  return [a, b, c]
}

test.group('Featured auto remove | type d’action', () => {
  test('FEATURED_AUTO_REMOVE = featured_auto_remove', ({ assert }) => {
    assert.equal(ActionType.FEATURED_AUTO_REMOVE, 'featured_auto_remove')
  })
})

test.group('Featured auto remove | dépublication', (group) => {
  withTransaction(group)

  test('position 1 sur 3 → positions 1–2 recompactées, created_by conservé, journal', async ({
    client,
    assert,
  }) => {
    const owner = await createAdminUser()
    const admin = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)

    const response = await client
      .post(`/admin/productions/${a.id}/unpublish`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await a.refresh()
    assert.equal(a.status, 'draft')
    assert.deepEqual(await storedSlots(), [
      { position: 1, production_id: b.id, created_by_id: owner.id },
      { position: 2, production_id: c.id, created_by_id: owner.id },
    ])
    const logs = await autoRemoveLogs(a.id)
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].adminUserId, admin.id)
    assert.equal(logs[0].resourceType, 'production')
    assert.deepEqual(logs[0].metadata, { position: 1, cause: 'unpublish' })
    // Le journal de dépublication reste écrit.
    const unpublishLog = await AdminActivityLog.query()
      .where('actionType', 'unpublish')
      .where('resourceId', a.id)
      .first()
    assert.isNotNull(unpublishLog)
  })

  test('recompactage : lignes conservées à l’identique (created_at, created_by)', async ({
    assert,
  }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    const exact = () =>
      db
        .from('featured_productions')
        .whereIn('production_id', [b.id, c.id])
        .orderBy('production_id')
        .select('production_id', 'created_by_id', db.raw('created_at::text as created_at'))
    const before = await exact()

    await ProductionService.unpublish(a, owner.id)

    assert.deepEqual(await exact(), before)
  })

  test('sélection à trous (positions 1 et 3) → la suivante remonte sans conflit de clé', async ({
    assert,
  }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    await db.from('featured_productions').where('production_id', b.id).delete()

    await ProductionService.unpublish(a, owner.id)

    assert.deepEqual(await storedSlots(), [
      { position: 1, production_id: c.id, created_by_id: owner.id },
    ])
  })

  test('position du milieu → la suivante remonte, la précédente reste', async ({ assert }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)

    await ProductionService.unpublish(b, owner.id)

    assert.deepEqual(await storedSelection(), [a.id, c.id])
    const logs = await autoRemoveLogs(b.id)
    assert.deepEqual(logs[0].metadata, { position: 2, cause: 'unpublish' })
  })

  test('production hors de la une → sélection intacte, aucun journal de retrait', async ({
    assert,
  }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    const other = await createProduction()

    await ProductionService.unpublish(other, owner.id)

    await other.refresh()
    assert.equal(other.status, 'draft')
    assert.deepEqual(await storedSelection(), [a.id, b.id, c.id])
    assert.lengthOf(await autoRemoveLogs(other.id), 0)
  })

  test('page « À la une » après le retrait → emplacement vidé, suivants remontés', async ({
    client,
    assert,
  }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    await ProductionService.unpublish(a, owner.id)

    const response = await client.get('/admin/featured').loginAs(owner)

    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.deepEqual(
      props.selection.map((item: { id: string }) => item.id),
      [b.id, c.id]
    )
  })
})

test.group('Featured auto remove | suppression', (group) => {
  withTransaction(group)

  test('position 1 sur 3 → positions 1–2 recompactées, journal cause delete', async ({
    client,
    assert,
  }) => {
    drive.fake('r2')
    const owner = await createAdminUser()
    const admin = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)

    const response = await client
      .delete(`/admin/productions/${a.id}`)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.isNull(await Production.find(a.id))
    assert.deepEqual(await storedSlots(), [
      { position: 1, production_id: b.id, created_by_id: owner.id },
      { position: 2, production_id: c.id, created_by_id: owner.id },
    ])
    const logs = await autoRemoveLogs(a.id)
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].adminUserId, admin.id)
    assert.deepEqual(logs[0].metadata, { position: 1, cause: 'delete' })
  })

  test('dernière position → retirée, aucune autre ne bouge', async ({ assert }) => {
    drive.fake('r2')
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)

    await ProductionService.delete(c, owner.id)

    assert.deepEqual(await storedSelection(), [a.id, b.id])
    const logs = await autoRemoveLogs(c.id)
    assert.deepEqual(logs[0].metadata, { position: 3, cause: 'delete' })
  })

  test('production hors de la une → aucun journal de retrait', async ({ assert }) => {
    drive.fake('r2')
    const owner = await createAdminUser()
    const [a] = await featuredThree(owner)
    const other = await createProduction()

    await ProductionService.delete(other, owner.id)

    const selection = await storedSelection()
    assert.lengthOf(selection, 3)
    assert.equal(selection[0], a.id)
    assert.lengthOf(await autoRemoveLogs(other.id), 0)
  })
})

test.group('Featured auto remove | journal après commit', (group) => {
  withTransaction(group)

  test('transaction annulée → emplacement conservé, rien journalisé', async ({ assert }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)

    const error = await db
      .transaction(async (trx) => {
        const position = await FeaturedService.removeProduction(a.id, owner.id, 'unpublish', trx)
        assert.equal(position, 1)
        throw new Error('rollback voulu')
      })
      .catch((e: unknown) => e)

    assert.instanceOf(error, Error)
    assert.deepEqual(await storedSelection(), [a.id, b.id, c.id])
    assert.lengthOf(await autoRemoveLogs(a.id), 0)
  })

  test('removeProduction hors de la une → null, rien écrit', async ({ assert }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    const other = await createProduction()

    const position = await db.transaction((trx) =>
      FeaturedService.removeProduction(other.id, owner.id, 'delete', trx)
    )

    assert.isNull(position)
    assert.deepEqual(await storedSelection(), [a.id, b.id, c.id])
    assert.lengthOf(await autoRemoveLogs(other.id), 0)
  })
})

test.group('Featured auto remove | dépublication automatique (formulaire)', (group) => {
  withTransaction(group)

  test('production à la une devenue incomplète → dépubliée, retirée, flash dédié', async ({
    client,
    assert,
  }) => {
    const owner = await createAdminUser()
    const [a, b, c] = await featuredThree(owner)
    await ProductionLink.create({
      productionId: b.id,
      url: 'https://example.com',
      linkType: 'simple',
      label: null,
    })

    const response = await client
      .put(`/admin/productions/${b.id}`)
      .json({
        title: 'Titre',
        summary: '',
        tags: ['t'],
        category: 'article',
        domain: 'mathematics',
        subdomain: ['topology'],
        language: 'fr',
        publicationCountry: 'SN',
        licenseStatus: 'member',
        workPublishedAt: '2024-01-01',
      })
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    await b.refresh()
    assert.equal(b.status, 'draft')
    assert.deepEqual(await storedSelection(), [a.id, c.id])
    const logs = await autoRemoveLogs(b.id)
    assert.lengthOf(logs, 1)
    assert.deepEqual(logs[0].metadata, { position: 2, cause: 'unpublish' })
    assert.equal(response.flashMessages().success, 'productions.auto_unpublished_featured')
  })

  test('production hors de la une devenue incomplète → flash habituel', async ({
    client,
    assert,
  }) => {
    const owner = await createAdminUser()
    const production = await createProduction()

    const response = await client
      .put(`/admin/productions/${production.id}`)
      .json({ title: 'Titre', category: 'article', domain: 'mathematics', licenseStatus: 'member' })
      .loginAs(owner)
      .withCsrfToken()
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.flashMessages().success, 'productions.auto_unpublished')
    assert.lengthOf(await autoRemoveLogs(production.id), 0)
  })
})

test.group('Featured auto remove | isFeatured dans les props', (group) => {
  withTransaction(group)

  test('liste admin : isFeatured par ligne', async ({ client, assert }) => {
    const owner = await createAdminUser()
    const featured = await createProduction()
    const other = await createProduction()
    await FeaturedService.save([featured.id], owner.id)

    const response = await client.get('/admin/productions').loginAs(owner)

    response.assertStatus(200)
    const rows = extractProps(response.text()).productions as {
      id: string
      isFeatured: boolean
    }[]
    assert.isTrue(rows.find((row) => row.id === featured.id)!.isFeatured)
    assert.isFalse(rows.find((row) => row.id === other.id)!.isFeatured)
  })

  test('formulaire d’édition : prop isFeatured', async ({ client, assert }) => {
    const owner = await createAdminUser()
    const featured = await createProduction()
    const other = await createProduction()
    await FeaturedService.save([featured.id], owner.id)

    const featuredResponse = await client
      .get(`/admin/productions/${featured.id}/edit`)
      .loginAs(owner)
    const otherResponse = await client.get(`/admin/productions/${other.id}/edit`).loginAs(owner)
    const featuredProps = extractProps(featuredResponse.text())
    const otherProps = extractProps(otherResponse.text())
    assert.isTrue(featuredProps.isFeatured)
    assert.isFalse(otherProps.isFeatured)
  })
})

test.group('Featured auto remove | ordre des verrous (D-11.4-5)', () => {
  // Deux connexions réelles (pas de transaction globale). Un enregistrement de la une tient
  // la ligne de la production (`FOR SHARE`) puis demande la table : le retrait automatique
  // doit attendre la ligne avant de prendre la table, sinon interblocage.
  async function cleanup(ids: string[], adminIds: string[]) {
    await db.from('featured_productions').whereIn('production_id', ids).delete()
    await db.from('admin_activity_logs').whereIn('resource_id', ids).delete()
    await db.from('productions').whereIn('id', ids).delete()
    await db.from('admin_activity_logs').whereIn('admin_user_id', adminIds).delete()
    await db.from('admin_users').whereIn('id', adminIds).delete()
  }

  for (const cause of ['unpublish', 'delete'] as const) {
    test(`${cause} concurrent d’un enregistrement → pas d’interblocage, retrait journalisé`, async ({
      assert,
    }) => {
      drive.fake('r2')
      const admin = await createAdminUser()
      const a = await createProduction()
      const b = await createProduction()
      await db.from('featured_productions').delete()
      await FeaturedService.save([a.id, b.id], admin.id)
      const saver = await db.transaction()
      try {
        await saver.rawQuery("SET LOCAL lock_timeout = '5s'")
        await saver.rawQuery('SELECT id FROM productions WHERE id IN (?, ?) FOR SHARE', [
          a.id,
          b.id,
        ])

        const production = await Production.findOrFail(a.id)
        const removing = (
          cause === 'unpublish'
            ? ProductionService.unpublish(production, admin.id)
            : ProductionService.delete(production, admin.id)
        ).then(
          () => null,
          (error: unknown) => error
        )
        // Le retrait attend la ligne sans avoir pris le verrou de table.
        await new Promise((resolve) => setTimeout(resolve, 300))
        await saver.rawQuery('LOCK TABLE featured_productions IN SHARE ROW EXCLUSIVE MODE')
        await saver.from('featured_productions').delete()
        await saver.table('featured_productions').multiInsert([
          { position: 1, production_id: b.id, created_by_id: admin.id },
          { position: 2, production_id: a.id, created_by_id: admin.id },
        ])
        await saver.commit()

        assert.isNull(await removing)
        assert.deepEqual(await storedSelection(), [b.id])
        const logs = await autoRemoveLogs(a.id)
        assert.lengthOf(logs, 1)
        assert.deepEqual(logs[0].metadata, { position: 2, cause })
      } catch (error) {
        if (!saver.isCompleted) await saver.rollback()
        throw error
      } finally {
        drive.restore('r2')
        await cleanup([a.id, b.id], [admin.id])
      }
    }).timeout(15_000)
  }

  test('ordre des instructions : ligne verrouillée, puis retrait, puis DELETE', ({ assert }) => {
    const source = readFileSync(join(process.cwd(), 'app/services/production_service.ts'), 'utf-8')
    const unpublish = source.slice(source.indexOf('static async unpublish('))
    assert.isBelow(
      unpublish.indexOf('forNoKeyUpdate()'),
      unpublish.indexOf('FeaturedService.removeProduction(')
    )
    const remove = source.slice(source.indexOf('static async delete('))
    assert.isBelow(
      remove.indexOf('FOR UPDATE'),
      remove.indexOf('FeaturedService.removeProduction(')
    )
    assert.isBelow(
      remove.indexOf('FeaturedService.removeProduction('),
      remove.indexOf('DELETE FROM productions')
    )
  })

  // Revue 11.5 : une réécriture DELETE + INSERT revérifiait la FK des autres emplacements
  // (FOR KEY SHARE pris après le verrou de table) → interblocage avec un admin tenant une
  // autre production à la une FOR UPDATE (dépublication automatique, suppression).
  for (const cause of ['unpublish', 'delete'] as const) {
    test(`${cause} pendant qu’une autre production à la une est verrouillée → pas d’interblocage`, async ({
      assert,
    }) => {
      drive.fake('r2')
      const admin = await createAdminUser()
      const p = await createProduction()
      const q = await createProduction()
      const r = await createProduction()
      await db.from('featured_productions').delete()
      await FeaturedService.save([p.id, q.id, r.id], admin.id)
      const holder = await db.transaction()
      try {
        await holder.rawQuery("SET LOCAL lock_timeout = '5s'")
        await holder.rawQuery('SELECT id FROM productions WHERE id = ? FOR UPDATE', [q.id])

        const production = await Production.findOrFail(p.id)
        const removing = (
          cause === 'unpublish'
            ? ProductionService.unpublish(production, admin.id)
            : ProductionService.delete(production, admin.id)
        ).then(
          () => null,
          (error: unknown) => error
        )
        await new Promise((resolve) => setTimeout(resolve, 300))
        // L'autre admin retire Q à son tour (dépublication automatique de son formulaire).
        const position = await FeaturedService.removeProduction(q.id, admin.id, 'unpublish', holder)
        await holder.commit()

        assert.isNull(await removing)
        assert.equal(position, 1)
        assert.deepEqual(await storedSelection(), [r.id])
        const logs = await autoRemoveLogs(p.id)
        assert.deepEqual(logs[0].metadata, { position: 1, cause })
      } catch (error) {
        if (!holder.isCompleted) await holder.rollback()
        throw error
      } finally {
        drive.restore('r2')
        await cleanup([p.id, q.id, r.id], [admin.id])
      }
    }).timeout(15_000)
  }
})
