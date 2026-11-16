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

/**
 * Staging sur le VPS partagé avec Coffee Chat (Story 8.3) : pas de Caddy, port
 * loopback, nginx de Coffee Chat en reverse proxy. Une erreur ici peut couper
 * Coffee Chat (nginx qui refuse de démarrer) ou exposer l'app sans TLS.
 */
test.group('Deployment staging (VPS partagé, nginx Coffee Chat)', () => {
  test('compose.staging.yaml : Caddy hors profil, port loopback, réseau du proxy', ({ assert }) => {
    const override = read('compose.staging.yaml')
    assert.match(override, /^ {2}caddy:\n(?: {4}#.*\n)* {4}profiles: \[caddy\]$/m)
    assert.include(override, "'127.0.0.1:${APP_PORT:-3333}:3333'")
    assert.notMatch(
      override,
      /^\s+- '?\$?\{?APP_PORT[^']*:3333'?$/m,
      'jamais de port publié sur 0.0.0.0'
    )
    assert.match(override, /aliases:\n\s+- anta-app/)
    assert.include(override, 'external: true')
    assert.notMatch(
      override,
      /^\s+env_file:/m,
      'les entrées sans valeur de compose.yaml écraseraient env_file'
    )
  })

  for (const file of ['deploy/nginx/anta.conf', 'deploy/nginx/anta.http-only.conf']) {
    test(`${file} : résolution paresseuse, limite 110m, challenge ACME`, ({ assert }) => {
      const conf = read(file)
      assert.include(conf, 'server_name anta.peraha.com;')
      assert.include(conf, 'resolver 127.0.0.11')
      assert.include(conf, 'set $anta_upstream http://anta-app:3333;')
      assert.include(conf, 'proxy_pass $anta_upstream;')
      assert.notMatch(
        conf,
        /^\s*upstream\s/m,
        'un upstream statique empêche nginx de démarrer sans Anta'
      )
      assert.notMatch(conf, /proxy_pass http:/, 'proxy_pass statique interdit')
      assert.include(conf, 'client_max_body_size 110m;')
      assert.include(conf, 'location /.well-known/acme-challenge/')
      assert.include(conf, 'proxy_set_header X-Forwarded-Proto $scheme;')
    })
  }

  test('anta.conf : HTTP redirigé vers HTTPS, certificat du domaine', ({ assert }) => {
    const conf = read('deploy/nginx/anta.conf')
    assert.include(conf, 'return 301 https://$host$request_uri;')
    assert.include(conf, 'listen 443 ssl;')
    assert.include(conf, '/etc/letsencrypt/live/anta.peraha.com/fullchain.pem')
  })

  test('deploy-staging.sh : strict, sans build sur le VPS, sans secret ni IP', ({ assert }) => {
    const script = read('scripts/vps/deploy-staging.sh')
    assert.include(script, 'set -euo pipefail')
    assert.include(script, '--no-build')
    assert.include(script, 'test -f .env')
    assert.include(script, '-f compose.yaml -f compose.staging.yaml')
    assert.notMatch(
      script.replaceAll('127.0.0.1', ''),
      /\b\d{1,3}(\.\d{1,3}){3}\b/,
      'aucune adresse IP en dur (hors loopback)'
    )
    assert.notInclude(script, 'dp.st.')
  })

  test("trustProxy : nginx joint l'app depuis le réseau bridge Docker", ({ assert }) => {
    assert.isTrue(http.trustProxy!('172.19.0.5', 0))
  })
})
