import { test } from '@japa/runner'

// Story 10.1 — NotFoundPage traduite (D36) : statut 404, composant `errors/not_found`, titre traduit.
function extractPage(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"'))
}

test.group('Public | NotFoundPage', () => {
  test('URL inconnue → 404 + composant errors/not_found (HTML)', async ({ client, assert }) => {
    const response = await client.get('/cette-page-nexiste-pas')
    response.assertStatus(404)
    const page = extractPage(response.text())
    assert.equal(page?.component, 'errors/not_found')
    assert.equal(page?.props.meta.locale, 'fr')
  })

  test('URL inconnue en requête Inertia → 404 + composant errors/not_found', async ({
    client,
    assert,
  }) => {
    const response = await client
      .get('/cette-page-nexiste-pas')
      .header('X-Inertia', 'true')
      .header('X-Inertia-Version', '1')
    response.assertStatus(404)
    assert.equal(response.body().component, 'errors/not_found')
  })

  test('titre de page traduit — FR par défaut', async ({ client, assert }) => {
    const response = await client.get('/cette-page-nexiste-pas')
    const html = response.text()
    assert.include(html, '<html lang="fr"')
    assert.match(html, /<title[^>]*>\s*Page introuvable — Anta\s*<\/title>/)
  })

  test('titre de page traduit — EN (cookie i18n_lang=en)', async ({ client, assert }) => {
    const request = client.get('/cette-page-nexiste-pas')
    request.cookiesJar['i18n_lang'] = { name: 'i18n_lang', value: 'en' }
    const response = await request
    response.assertStatus(404)
    const html = response.text()
    assert.include(html, '<html lang="en"')
    assert.match(html, /<title[^>]*>\s*Page not found — Anta\s*<\/title>/)
  })

  test('production inexistante → 404 + NotFoundPage avec titre traduit', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/productions/slug-qui-nexiste-pas-404')
    response.assertStatus(404)
    const html = response.text()
    assert.equal(extractPage(html)?.component, 'errors/not_found')
    assert.match(html, /<title[^>]*>\s*Page introuvable — Anta\s*<\/title>/)
  })

  test('requête JSON sur une URL inconnue → 404 JSON, sans page Inertia', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/cette-page-nexiste-pas').accept('json')
    response.assertStatus(404)
    assert.notInclude(response.text(), 'data-page=')
  })
})
