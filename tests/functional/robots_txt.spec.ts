import { test } from '@japa/runner'

test.group('robots.txt', () => {
  test('GET /robots.txt → 200 + content-type text/plain', async ({ client, assert }) => {
    const response = await client.get('/robots.txt')
    response.assertStatus(200)
    assert.include(response.header('content-type') ?? '', 'text/plain')
  })

  test('Le contenu exclut /admin/ (FR37)', async ({ client, assert }) => {
    const response = await client.get('/robots.txt')
    const body = response.text()
    assert.include(body, 'User-agent: *', 'doit déclarer User-agent universel')
    assert.include(body, 'Disallow: /admin/', 'doit exclure le panel admin')
  })
})
