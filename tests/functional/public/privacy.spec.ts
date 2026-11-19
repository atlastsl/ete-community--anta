import { test } from '@japa/runner'

test.group('Public | Privacy Policy', () => {
  test('GET /privacy-policy responds 200', async ({ client }) => {
    const response = await client.get('/privacy-policy')
    response.assertStatus(200)
  })

  test('GET /privacy-policy returns privacy-policy Inertia component', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/privacy-policy')
      .header('X-Inertia', 'true')
      .header('X-Inertia-Version', '1')

    response.assertStatus(200)
    assert.equal(response.body().component, 'privacy-policy')
  })

  // Story 10.1 — titre dédié (report Epic 5 soldé), FR et EN.
  test('titre serveur dédié en FR', async ({ client, assert }) => {
    const response = await client.get('/privacy-policy')
    const html = response.text()
    assert.match(html, /<title[^>]*>\s*Politique de confidentialité — Anta\s*<\/title>/)
  })

  test('titre serveur dédié en EN (cookie i18n_lang=en)', async ({ client, assert }) => {
    const request = client.get('/privacy-policy')
    request.cookiesJar['i18n_lang'] = { name: 'i18n_lang', value: 'en' }
    const response = await request
    const html = response.text()
    assert.include(html, '<html lang="en"')
    assert.match(html, /<title[^>]*>\s*Privacy policy — Anta\s*<\/title>/)
  })
})
