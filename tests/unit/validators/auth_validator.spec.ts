import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { loginValidator, changePasswordValidator } from '#validators/auth_validator'

const VALID_PASSWORD = 'AValidPassword123' // 17 chars, ≥ 12

test.group('AuthValidator | loginValidator', () => {
  test('accepte un email valide et un password non vide', async ({ assert }) => {
    const result = await loginValidator.validate({
      email: 'admin@anta.test',
      password: 'anyValue',
    })
    assert.equal(result.email, 'admin@anta.test')
    assert.equal(result.password, 'anyValue')
  })

  test("trim et normalise l'email", async ({ assert }) => {
    const result = await loginValidator.validate({
      email: '  admin@anta.test  ',
      password: 'x',
    })
    assert.equal(result.email, 'admin@anta.test')
  })

  test('rejette un email manquant', async ({ assert }) => {
    try {
      await loginValidator.validate({ password: 'anyValue' })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(messages.some((m: any) => m.field === 'email'))
    }
  })

  test('rejette un email malformé', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'not-an-email', password: 'x' })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(messages.some((m: any) => m.field === 'email'))
    }
  })

  test('rejette un password manquant', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'admin@anta.test' })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(messages.some((m: any) => m.field === 'password'))
    }
  })

  test('rejette un password vide', async ({ assert }) => {
    try {
      await loginValidator.validate({ email: 'admin@anta.test', password: '' })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(messages.some((m: any) => m.field === 'password'))
    }
  })
})

test.group('AuthValidator | changePasswordValidator', () => {
  test('accepte un password ≥ 12 chars avec confirmation identique', async ({ assert }) => {
    const result = await changePasswordValidator.validate({
      password: VALID_PASSWORD,
      password_confirmation: VALID_PASSWORD,
    })
    assert.equal(result.password, VALID_PASSWORD)
  })

  test('accepte un password de exactement 12 caractères (boundary)', async ({ assert }) => {
    const exactly12 = '123456789012'
    const result = await changePasswordValidator.validate({
      password: exactly12,
      password_confirmation: exactly12,
    })
    assert.equal(result.password, exactly12)
  })

  test('rejette un password manquant', async ({ assert }) => {
    try {
      await changePasswordValidator.validate({ password_confirmation: VALID_PASSWORD })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(
        messages.some(
          (m: any) =>
            m.field === 'password' && m.message === 'auth.change_password.errors.password_required'
        )
      )
    }
  })

  test('rejette un password de 11 caractères', async ({ assert }) => {
    try {
      const short = '12345678901' // 11 chars
      await changePasswordValidator.validate({
        password: short,
        password_confirmation: short,
      })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(
        messages.some(
          (m: any) =>
            m.field === 'password' && m.message === 'auth.change_password.errors.password_too_short'
        )
      )
    }
  })

  test('rejette une confirmation différente', async ({ assert }) => {
    try {
      await changePasswordValidator.validate({
        password: VALID_PASSWORD,
        password_confirmation: 'DifferentValue123',
      })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      // VineJS reporte l'erreur `confirmed` sur le champ de confirmation, pas le principal
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(
        messages.some(
          (m: any) =>
            m.field === 'password_confirmation' &&
            m.message === 'auth.change_password.errors.confirmation_mismatch'
        )
      )
    }
  })

  test('rejette une confirmation absente', async ({ assert }) => {
    try {
      await changePasswordValidator.validate({ password: VALID_PASSWORD })
      assert.fail('Expected validation to throw')
    } catch (error) {
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      // VineJS confirmed() rapporte l'erreur sur le champ principal `password`
      const messages = (error as InstanceType<typeof errors.E_VALIDATION_ERROR>).messages
      assert.isTrue(messages.length >= 1)
    }
  })
})
