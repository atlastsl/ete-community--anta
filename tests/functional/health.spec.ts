import { test } from '@japa/runner'

test.group('Health check', () => {
  test('GET /health → 200 { status: ok, revision }', async ({ client }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    // ANTA_REVISION absent hors image Docker
    response.assertBody({ status: 'ok', revision: 'unknown' })
  })
})
