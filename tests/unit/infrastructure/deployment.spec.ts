import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { http } from '#config/app'
import { parse } from 'yaml'

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

  test('ffmpeg (apt) dans l’étape runtime avant USER node, et dans la CI (Story 11.3)', ({
    assert,
  }) => {
    const dockerfile = read('Dockerfile')
    const runtime = dockerfile.slice(dockerfile.search(/FROM .* AS runtime/))
    const install = runtime.indexOf('apt-get install -y --no-install-recommends ffmpeg')
    assert.isAbove(install, -1)
    assert.isBelow(install, runtime.indexOf('USER node'))
    assert.include(runtime, 'rm -rf /var/lib/apt/lists/*')

    const ci = read('.github/workflows/ci.yml')
    const ciInstall = ci.indexOf('apt-get install -y --no-install-recommends ffmpeg')
    assert.isAbove(ciInstall, -1)
    assert.isBelow(ciInstall, ci.indexOf('node ace test unit'))
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

  for (const file of ['scripts/vps/deploy-staging.sh', 'scripts/vps/staging-remote-deploy.sh']) {
    test(`${file} : strict, sans secret ni IP`, ({ assert }) => {
      const script = read(file)
      assert.include(script, 'set -euo pipefail')
      assert.include(script, 'test -f .env')
      assert.notMatch(
        script.replaceAll('127.0.0.1', ''),
        /\b\d{1,3}(\.\d{1,3}){3}\b/,
        'aucune adresse IP en dur (hors loopback)'
      )
      assert.notInclude(script, 'dp.st.')
    })
  }

  test('deploy-staging.sh : délègue le démarrage à remote-deploy.sh', ({ assert }) => {
    const script = read('scripts/vps/deploy-staging.sh')
    assert.include(script, 'scripts/vps/staging-remote-deploy.sh')
    assert.include(script, 'remote-deploy.sh deploy $IMAGE')
    assert.include(script, '--build-arg GIT_SHA=')
  })

  test("trustProxy : nginx joint l'app depuis le réseau bridge Docker", ({ assert }) => {
    assert.isTrue(http.trustProxy!('172.19.0.5', 0))
  })
})

/**
 * CI/CD du staging (Story 8.4) : tests avant tout déploiement, image GHCR par SHA,
 * clé SSH restreinte à remote-deploy.sh, retour à l'image précédente si échec.
 */
test.group('Deployment staging | CI/CD', () => {
  const workflow = parse(read('.github/workflows/deploy-staging.yml'))
  const ci = parse(read('.github/workflows/ci.yml'))

  test('ci.yml : réutilisable, suite functional bloquante, session memory', ({ assert }) => {
    assert.property(ci.on, 'workflow_call')
    assert.notInclude(
      ci.on.push.branches,
      'staging',
      'le gate staging passe par deploy-staging.yml'
    )
    assert.equal(ci.jobs.test.env.SESSION_DRIVER, 'memory')
    const functional = ci.jobs.test.steps.find((st: any) =>
      /node ace test\s+functional/.test(st.run ?? '')
    )
    assert.exists(functional)
    assert.notProperty(functional, 'continue-on-error')
  })

  test('deploy-staging.yml : push staging + rollback manuel, sans concurrence', ({ assert }) => {
    assert.deepEqual(workflow.on.push.branches, ['staging'])
    assert.property(workflow.on.workflow_dispatch.inputs, 'image_tag')
    assert.notProperty(workflow.on, 'pull_request')
    assert.equal(workflow.concurrency['cancel-in-progress'], false)
  })

  test('gate : tests (ci.yml) → image → déploiement', ({ assert }) => {
    assert.equal(workflow.jobs.test.uses, './.github/workflows/ci.yml')
    assert.equal(workflow.jobs.image.needs, 'test')
    assert.includeMembers(workflow.jobs.deploy.needs, ['test', 'image'])
    assert.include(workflow.jobs.deploy.if, "needs.image.result == 'success'")
  })

  test('image GHCR taggée par le SHA, révision passée au build', ({ assert }) => {
    assert.equal(workflow.env.IMAGE, 'ghcr.io/atlastsl/ete-community--anta')
    const build = workflow.jobs.image.steps.find((st: any) =>
      st.uses?.startsWith('docker/build-push-action')
    )
    assert.isTrue(build.with.push)
    assert.include(build.with.tags, '${{ env.IMAGE }}:${{ github.sha }}')
    assert.equal(build.with['build-args'], 'GIT_SHA=${{ github.sha }}')
    assert.equal(workflow.jobs.image.permissions.packages, 'write')
  })

  test('déploiement : environnement staging, host vérifié, health check par révision', ({
    assert,
  }) => {
    const deploy = workflow.jobs.deploy
    assert.equal(deploy.environment.name, 'staging')
    assert.equal(deploy.permissions.packages, 'read')
    const raw = read('.github/workflows/deploy-staging.yml')
    assert.notInclude(raw, 'StrictHostKeyChecking=no')
    assert.include(raw, 'secrets.STAGING_KNOWN_HOSTS')
    assert.include(raw, '"deploy $IMAGE:$TAG"')
    assert.include(raw, "jq -r '.revision")
  })

  test('remote-deploy.sh : commandes et images filtrées, retour arrière', ({ assert }) => {
    const script = read('scripts/vps/staging-remote-deploy.sh')
    assert.include(script, 'SSH_ORIGINAL_COMMAND')
    assert.include(script, 'IMAGE_RE=')
    assert.include(script, 'GHCR_REPO=ghcr.io/atlastsl/ete-community--anta')
    assert.include(script, '--no-build --wait')
    assert.include(script, 'export DOCKER_CONFIG="$tmp/docker"')
    assert.include(script, 'docker logout ghcr.io')
    assert.match(script, /Retour à \$previous/)
    assert.include(script, 'flock')
    assert.notMatch(script, /\beval\b/)
  })

  test('Dockerfile : révision de l’image exposée par /health', ({ assert }) => {
    const dockerfile = read('Dockerfile')
    assert.include(dockerfile, 'ARG GIT_SHA=unknown')
    assert.include(dockerfile, 'ANTA_REVISION=$GIT_SHA')
    assert.include(read('start/routes.ts'), "env.get('ANTA_REVISION', 'unknown')")
  })

  test('sharp : dépendance de production et binaires linux-x64 glibc dans le lockfile', ({
    assert,
  }) => {
    const pkg = JSON.parse(read('package.json'))
    assert.isDefined(pkg.dependencies.sharp)
    assert.isUndefined(pkg.devDependencies?.sharp)
    // `npm ci --omit=dev` de l'image (node:24-bookworm-slim, glibc x64) n'installe que le lock.
    const lock = JSON.parse(read('package-lock.json'))
    const linux = lock.packages['node_modules/@img/sharp-linux-x64']
    assert.isDefined(linux)
    assert.deepEqual(linux.libc, ['glibc'])
    assert.isDefined(lock.packages['node_modules/@img/sharp-libvips-linux-x64'])
  })
})
