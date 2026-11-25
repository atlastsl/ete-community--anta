import { test } from '@japa/runner'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import env from '#start/env'
import type { ApiClient } from '@japa/api-client'

const APP_URL = String(env.get('APP_URL')).replace(/\/+$/, '')

/** Corps texte d'une réponse GET. */
async function fetchText(client: ApiClient, path: string): Promise<string> {
  const response = await client.get(path)
  return response.text()
}

/** Requête brute vers le serveur de test : en-têtes exacts, aucun cookie. */
function rawRequest(path: string): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: process.env.HOST || 'localhost', port: Number(process.env.PORT), path },
      (res) => {
        res.resume()
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }))
        res.on('error', reject)
      }
    )
    req.setTimeout(5000, () => req.destroy(new Error(`timeout on ${path}`)))
    req.on('error', reject)
    req.end()
  })
}

test.group('robots.txt', (group) => {
  // Mode par défaut (ROBOTS_DISALLOW_ALL absente) quel que soit l'environnement du lanceur.
  let previous: boolean | undefined
  group.each.setup(() => {
    previous = env.get('ROBOTS_DISALLOW_ALL')
    env.set('ROBOTS_DISALLOW_ALL', false)
    return () => env.set('ROBOTS_DISALLOW_ALL', previous as boolean)
  })

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

  test('Déclare le plan du site en URL absolue (Story 13.3)', async ({ client, assert }) => {
    const body = await fetchText(client, '/robots.txt')
    const lines = body.split('\n').filter((line) => line.startsWith('Sitemap:'))
    assert.deepEqual(lines, [`Sitemap: ${APP_URL}/sitemap.xml`])
    assert.match(lines[0], /^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/)
  })

  test('Servi sans session ni cookies, cachable publiquement (Story 13.3)', async ({ assert }) => {
    const response = await rawRequest('/robots.txt')
    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8')
    assert.equal(response.headers['cache-control'], 'public, max-age=3600')
    assert.isUndefined(response.headers['set-cookie'])
  })

  test('ROBOTS_DISALLOW_ALL=true (staging) : Disallow: / et aucune ligne Sitemap (Story 13.3)', async ({
    client,
    assert,
  }) => {
    env.set('ROBOTS_DISALLOW_ALL', true)
    const response = await client.get('/robots.txt')
    response.assertStatus(200)
    const body = response.text()
    assert.include(body, 'User-agent: *\nDisallow: /\n')
    assert.notInclude(body, 'Sitemap:')
    // Le plan du site reste servi (seuls les robots sont congédiés).
    const sitemap = await client.get('/sitemap.xml')
    sitemap.assertStatus(200)
  })
})
