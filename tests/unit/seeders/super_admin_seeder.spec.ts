import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'
import { SuperAdminSeederLogic } from '../../../database/seeders/super_admin_seeder.js'

const TEST_EMAIL = 'test-super@anta.test'
const TEST_PASSWORD = 'SuperSecret123!'
const ROTATED_PASSWORD = 'NewSecret456!'

test.group('SuperAdminSeeder', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('crée le super admin avec les bons defaults à la première exécution', async ({ assert }) => {
    const result = await SuperAdminSeederLogic.run({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    assert.equal(result.action, 'created')
    assert.equal(result.email, TEST_EMAIL)

    const admin = await AdminUser.findByOrFail('email', TEST_EMAIL)
    assert.equal(admin.role, 'super_admin')
    assert.isTrue(admin.isActive)
    assert.isFalse(admin.passwordChanged)
    assert.isNull(admin.createdById)
    assert.isTrue(await hash.verify(admin.passwordHash, TEST_PASSWORD))
  })

  test('est idempotent — pas de doublon à la ré-exécution avec mêmes credentials', async ({
    assert,
  }) => {
    await SuperAdminSeederLogic.run({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const firstAdmin = await AdminUser.findByOrFail('email', TEST_EMAIL)
    const firstHash = firstAdmin.passwordHash

    const result = await SuperAdminSeederLogic.run({ email: TEST_EMAIL, password: TEST_PASSWORD })

    assert.equal(result.action, 'unchanged')

    const count = await AdminUser.query().where('email', TEST_EMAIL).count('* as total')
    assert.equal(Number(count[0].$extras.total), 1)

    const reloaded = await AdminUser.findByOrFail('email', TEST_EMAIL)
    assert.equal(reloaded.passwordHash, firstHash, 'le hash ne doit pas être régénéré')
  })

  test('rotate le password si SUPER_ADMIN_PASSWORD a changé', async ({ assert }) => {
    await SuperAdminSeederLogic.run({ email: TEST_EMAIL, password: TEST_PASSWORD })

    // Simule un admin qui aurait changé son mot de passe via le panel
    const admin = await AdminUser.findByOrFail('email', TEST_EMAIL)
    admin.passwordChanged = true
    admin.isActive = false
    await admin.save()

    const result = await SuperAdminSeederLogic.run({
      email: TEST_EMAIL,
      password: ROTATED_PASSWORD,
    })

    assert.equal(result.action, 'password_rotated')

    const reloaded = await AdminUser.findByOrFail('email', TEST_EMAIL)
    assert.isTrue(
      await hash.verify(reloaded.passwordHash, ROTATED_PASSWORD),
      'le nouveau hash doit valider le nouveau password'
    )
    assert.isFalse(reloaded.passwordChanged, 'doit être remis à false pour forcer un changement')

    // Préservation des champs métier modifiés par l'admin
    assert.isFalse(reloaded.isActive, 'isActive doit être préservé (le seeder ne réactive pas)')
  })

  test('lève une erreur explicite si SUPER_ADMIN_EMAIL est manquant', async ({ assert }) => {
    try {
      await SuperAdminSeederLogic.run({ email: '', password: TEST_PASSWORD })
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.instanceOf(error, Error)
      assert.include((error as Error).message, 'SUPER_ADMIN_EMAIL')
      assert.include((error as Error).message, 'SUPER_ADMIN_PASSWORD')
    }

    const count = await AdminUser.query().count('* as total')
    assert.equal(Number(count[0].$extras.total), 0, 'aucun enregistrement ne doit avoir été créé')
  })

  test('lève une erreur explicite si SUPER_ADMIN_PASSWORD est manquant', async ({ assert }) => {
    try {
      await SuperAdminSeederLogic.run({ email: TEST_EMAIL, password: '' })
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.instanceOf(error, Error)
      assert.include((error as Error).message, 'SUPER_ADMIN_PASSWORD')
    }

    const count = await AdminUser.query().count('* as total')
    assert.equal(Number(count[0].$extras.total), 0)
  })
})
