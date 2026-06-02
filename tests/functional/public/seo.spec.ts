import { test } from '@japa/runner'

test.group('Public SEO | meta tags côté serveur', () => {
  test('GET / contient les meta SEO dans le HTML brut', async ({ client, assert }) => {
    const response = await client.get('/')
    response.assertStatus(200)
    const html = response.text()

    assert.match(html, /<title[^>]*>[^<]*Anta[^<]*<\/title>/)
    assert.include(html, '<meta name="description"')
    assert.include(html, '<meta property="og:title"')
    assert.include(html, '<meta property="og:description"')
    assert.include(html, '<meta property="og:type" content="website"')
  })

  test('GET /productions contient les meta génériques', async ({ client, assert }) => {
    const response = await client.get('/productions')
    response.assertStatus(200)
    const html = response.text()

    assert.include(html, '<meta property="og:title"')
    assert.include(html, '<meta property="og:type" content="website"')
  })

  test('GET /privacy-policy contient des meta', async ({ client, assert }) => {
    const response = await client.get('/privacy-policy')
    response.assertStatus(200)
    assert.include(response.text(), '<meta property="og:title"')
  })

  test('cookie i18n_lang=en → description anglaise + html lang="en"', async ({
    client,
    assert,
  }) => {
    // Cookie brut (comme posé par i18next côté client) : on insère directement dans le jar
    // — le serializer api-client (`prepare`) le transmet tel quel, sans signer ni encoder.
    const request = client.get('/')
    request.cookiesJar['i18n_lang'] = { name: 'i18n_lang', value: 'en' }
    const response = await request
    response.assertStatus(200)
    const html = response.text()

    assert.include(html, '<html lang="en"')
    assert.include(html, 'community digital library')
  })

  test('sans cookie → français par défaut + html lang="fr"', async ({ client, assert }) => {
    const response = await client.get('/')
    const html = response.text()

    assert.include(html, '<html lang="fr"')
    assert.include(html, 'bibliothèque numérique communautaire')
  })
})
