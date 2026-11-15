import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { http } from '#config/app'

/**
 * Garde-fous de la conteneurisation (Story 8.2) : image non-root, limite de corps
 * Caddy alignée sur `bodyparser`, logs plafonnés, aucun secret dans le contexte de build.
 */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

test.group('Deployment (Docker + Caddy)', () => {
  test('Dockerfile : multi-stage, non-root, migrations puis serveur', ({ assert }) => {
    const dockerfile = read('Dockerfile')
    assert.match(dockerfile, /FROM .* AS build/)
    assert.match(dockerfile, /FROM .* AS runtime/)
    assert.include(dockerfile, 'RUN node ace build')
    assert.include(dockerfile, 'npm ci --omit=dev')
    assert.include(dockerfile, 'USER node')
    assert.include(dockerfile, 'node ace migration:run --force && exec node bin/server.js')
  })

  test('.dockerignore exclut les fichiers de secrets', ({ assert }) => {
    const ignore = read('.dockerignore').split('\n')
    assert.includeMembers(ignore, ['.env', '.env.*', 'node_modules', 'build'])
  })

  test('Caddyfile : domaine paramétré + limite de corps = bodyparser (110 Mio)', ({ assert }) => {
    const caddyfile = read('Caddyfile')
    assert.include(caddyfile, '{$DOMAIN}')
    assert.include(caddyfile, 'max_size 110MiB')
    assert.include(caddyfile, 'reverse_proxy app:3333')
    assert.include(read('config/bodyparser.ts'), "limit: '110mb'")
  })

  test('compose.yaml : services app + caddy, logs plafonnés', ({ assert }) => {
    const compose = read('compose.yaml')
    assert.match(compose, /^ {2}app:$/m)
    assert.match(compose, /^ {2}caddy:$/m)
    assert.include(compose, 'driver: json-file')
    assert.include(compose, 'max-size:')
    assert.include(compose, 'max-file:')
    assert.notMatch(
      compose,
      /^\s+env_file:/m,
      'pas de fichier .env : Doppler injecte les variables'
    )
  })

  test('trustProxy : loopback et réseaux privés uniquement', ({ assert }) => {
    assert.isTrue(http.trustProxy!('127.0.0.1', 0))
    assert.isTrue(http.trustProxy!('172.18.0.3', 0), 'Caddy sur le réseau Compose')
    assert.isFalse(http.trustProxy!('203.0.113.7', 0), 'IP publique')
  })
})
