import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import AdminActivityLog from '#models/admin_activity_log'
import ActivityLogService from '#services/activity_log_service'
import ActionType from '#enums/action_type'

test.group('ActivityLogService', (group) => {
  let testUser: AdminUser

  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    testUser = await AdminUser.create({
      email: 'activity-log-test@anta.test',
      passwordHash: 'hashed-placeholder',
      role: 'super_admin',
      isActive: true,
      passwordChanged: true,
    })
    return () => db.rollbackGlobalTransaction()
  })

  test('crée un log pour chaque actionType valide', async ({ assert }) => {
    const actionTypes = [
      ActionType.LOGIN,
      ActionType.CREATE,
      ActionType.UPDATE,
      ActionType.PUBLISH,
      ActionType.UNPUBLISH,
      ActionType.DELETE,
      ActionType.PASSWORD_RESET,
    ]

    for (const actionType of actionTypes) {
      await ActivityLogService.log({
        adminUserId: testUser.id,
        actionType,
        resourceType: 'test',
        resourceId: 'test-id',
      })
    }

    const logs = await AdminActivityLog.query().where('adminUserId', testUser.id)
    assert.equal(logs.length, 7)

    const loggedTypes = logs.map((log) => log.actionType).sort()
    const expectedTypes = [...actionTypes].sort()
    assert.deepEqual(loggedTypes, expectedTypes)
  })

  test('enregistre correctement tous les champs', async ({ assert }) => {
    await ActivityLogService.log({
      adminUserId: testUser.id,
      actionType: ActionType.CREATE,
      resourceType: 'admin_user',
      resourceId: 'some-uuid',
    })

    const log = await AdminActivityLog.query()
      .where('adminUserId', testUser.id)
      .where('actionType', 'create')
      .firstOrFail()

    assert.equal(log.adminUserId, testUser.id)
    assert.equal(log.actionType, 'create')
    assert.equal(log.resourceType, 'admin_user')
    assert.equal(log.resourceId, 'some-uuid')
    assert.isNotNull(log.createdAt)
  })

  test('resourceType et resourceId sont optionnels', async ({ assert }) => {
    await ActivityLogService.log({
      adminUserId: testUser.id,
      actionType: ActionType.LOGIN,
    })

    const log = await AdminActivityLog.query()
      .where('adminUserId', testUser.id)
      .where('actionType', 'login')
      .firstOrFail()

    assert.isNull(log.resourceType)
    assert.isNull(log.resourceId)
  })

  test("ne lève pas d'exception si l'insertion échoue (fail silently)", async ({ assert }) => {
    const originalCreate = AdminActivityLog.create
    ;(AdminActivityLog as any).create = async () => {
      throw new Error('Simulated DB failure')
    }

    try {
      await assert.doesNotReject(async () => {
        await ActivityLogService.log({
          adminUserId: testUser.id,
          actionType: ActionType.LOGIN,
          resourceType: 'session',
        })
      })
    } finally {
      ;(AdminActivityLog as any).create = originalCreate
    }
  })

  // AC2 — Typage TS : un actionType invalide ne compile pas.
  // Vérification par compilation, pas par test runtime.
  // Exemple : ActivityLogService.log({ adminUserId: '', actionType: 'invalid' })
  //   ↑ TS2322: Type '"invalid"' is not assignable to type 'ActionType'
})
