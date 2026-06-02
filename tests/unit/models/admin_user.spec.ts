import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'

test.group('AdminUser model', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('creates an admin user with correct defaults', async ({ assert }) => {
    const user = await AdminUser.create({
      email: 'test-admin@anta.test',
      passwordHash: 'hashed_password',
      role: 'admin',
    })
    await user.refresh()

    assert.isString(user.id)
    assert.equal(user.email, 'test-admin@anta.test')
    assert.equal(user.role, 'admin')
    assert.isTrue(user.isActive)
    assert.isFalse(user.passwordChanged)
    assert.isNull(user.createdById)
  })

  test('creates a super_admin user', async ({ assert }) => {
    const user = await AdminUser.create({
      email: 'super@anta.test',
      passwordHash: 'hashed_password',
      role: 'super_admin',
    })

    assert.equal(user.role, 'super_admin')
  })

  test('enforces unique email constraint', async ({ assert }) => {
    await AdminUser.create({
      email: 'unique@anta.test',
      passwordHash: 'hash1',
      role: 'admin',
    })

    await assert.rejects(async () => {
      await AdminUser.create({
        email: 'unique@anta.test',
        passwordHash: 'hash2',
        role: 'admin',
      })
    })
  })

  test('supports self-referential created_by_id', async ({ assert }) => {
    const creator = await AdminUser.create({
      email: 'creator@anta.test',
      passwordHash: 'hash',
      role: 'super_admin',
    })

    const created = await AdminUser.create({
      email: 'created@anta.test',
      passwordHash: 'hash',
      role: 'admin',
      createdById: creator.id,
    })

    assert.equal(created.createdById, creator.id)
  })
})
