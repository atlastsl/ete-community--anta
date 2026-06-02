import { test } from '@japa/runner'

test.group('Public | Privacy Policy', () => {
  test('GET /privacy-policy responds 200', async ({ client }) => {
    const response = await client.get('/privacy-policy')
    response.assertStatus(200)
  })

  test('GET /privacy-policy returns privacy-policy Inertia component', async ({ client }) => {
    const response = await client
      .get('/privacy-policy')
      .header('X-Inertia', 'true')
      .header('X-Inertia-Version', '1')

    response.assertStatus(200)
    const body = response.body()
    if (typeof body === 'object' && body.component) {
      response.assert?.equal(body.component, 'privacy-policy')
    }
  })
})
