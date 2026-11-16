import { test } from '@japa/runner'

test.group('Health check', () => {
  test('GET /health → 200 { status: ok }', async ({ client }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    response.assertBody({ status: 'ok' })
  })
})
