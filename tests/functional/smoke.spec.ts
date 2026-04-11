import { test } from '@japa/runner'

test.group('Smoke test', () => {
  test('server responds 200 on /', async ({ client }) => {
    const response = await client.get('/')
    response.assertStatus(200)
  })
})
