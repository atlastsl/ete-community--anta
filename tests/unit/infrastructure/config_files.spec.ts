import { test } from '@japa/runner'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const r = (p: string) => resolve(process.cwd(), p)

test.group('Infrastructure | render.yaml', () => {
  const renderConfig = parse(readFileSync(r('render.yaml'), 'utf-8'))

  test('render.yaml est un YAML valide avec au moins un service', ({ assert }) => {
    assert.isArray(renderConfig.services)
    assert.isAtLeast(renderConfig.services.length, 1)
  })

  test('service anta-staging surveille la branche staging', ({ assert }) => {
    const svc = renderConfig.services.find((s: any) => s.name === 'anta-staging')
    assert.exists(svc, 'service anta-staging absent')
    assert.equal(svc.branch, 'staging')
    assert.equal(svc.type, 'web')
    assert.equal(svc.runtime, 'node')
  })

  test('build et start commands sont corrects', ({ assert }) => {
    const svc = renderConfig.services[0]
    assert.include(svc.buildCommand, 'npm install')
    assert.include(svc.buildCommand, 'node ace build')
    assert.include(svc.startCommand, 'migration:run')
    assert.include(svc.startCommand, 'build/bin/server.js')
  })

  test('les secrets sont marqués sync: false (pas de leak)', ({ assert }) => {
    const svc = renderConfig.services[0]
    const sensitiveKeys = [
      'APP_KEY',
      'DB_PASSWORD',
      'R2_SECRET_ACCESS_KEY',
      'RESEND_API_KEY',
      'SUPER_ADMIN_PASSWORD',
    ]
    for (const key of sensitiveKeys) {
      const v = svc.envVars.find((e: any) => e.key === key)
      assert.exists(v, `${key} absent de render.yaml`)
      assert.equal(v.sync, false, `${key} doit être sync: false`)
    }
  })
})

test.group('Infrastructure | GitHub Actions CI', () => {
  const ci = parse(readFileSync(r('.github/workflows/ci.yml'), 'utf-8'))

  test('CI workflow trigge sur PR vers les 3 branches', ({ assert }) => {
    // yaml@2 (YAML 1.2) parse `on:` comme la string "on", pas le booléen true
    const branches = ci.on.pull_request.branches
    assert.includeMembers(branches, ['development', 'staging', 'master'])
  })

  test('CI utilise Node 24', ({ assert }) => {
    const testJob = ci.jobs.test
    assert.exists(testJob)
    const setupNode = testJob.steps.find((s: any) => s.uses?.includes('setup-node'))
    assert.equal(setupNode.with['node-version'], '24')
  })

  test('CI lance un service PostgreSQL 16', ({ assert }) => {
    const pg = ci.jobs.test.services.postgres
    assert.exists(pg)
    assert.include(pg.image, 'postgres:16')
  })

  test('CI exécute lint et tests unitaires', ({ assert }) => {
    const steps = ci.jobs.test.steps.map((s: any) => s.run || '')
    assert.isTrue(
      steps.some((s: string) => s.includes('npm run lint')),
      'step lint absent'
    )
    assert.isTrue(
      steps.some((s: string) => s.includes('node ace test')),
      'step test absent'
    )
    assert.isTrue(
      steps.some((s: string) => s.includes('migration:run')),
      'step migration absent'
    )
  })
})

test.group('Infrastructure | .gitignore', () => {
  const gitignore = readFileSync(r('.gitignore'), 'utf-8')

  test('exclut .env et les fichiers de secrets', ({ assert }) => {
    assert.match(gitignore, /^\.env$/m)
  })

  test('exclut node_modules, build et tmp', ({ assert }) => {
    assert.match(gitignore, /^node_modules$/m)
    assert.match(gitignore, /^build$/m)
    assert.match(gitignore, /^tmp\/\*/m)
  })

  test('exclut les fichiers générés par AdonisJS et Lucid', ({ assert }) => {
    assert.match(gitignore, /\.adonisjs/)
    assert.match(gitignore, /database\/schema\.ts/)
  })

  test('exclut storage local (R2 utilisé en remote)', ({ assert }) => {
    assert.match(gitignore, /storage/)
  })
})

test.group('Infrastructure | Documentation', () => {
  test('README.md existe et référence les docs', ({ assert }) => {
    assert.isTrue(existsSync(r('README.md')))
    const readme = readFileSync(r('README.md'), 'utf-8')
    assert.include(readme, '_docs/git-workflow.md')
    assert.include(readme, '_docs/deployment-render.md')
  })

  test('_docs/git-workflow.md existe et documente les 3 branches', ({ assert }) => {
    assert.isTrue(existsSync(r('_docs/git-workflow.md')))
    const content = readFileSync(r('_docs/git-workflow.md'), 'utf-8')
    assert.include(content, 'master')
    assert.include(content, 'development')
    assert.include(content, 'staging')
  })

  test('_docs/deployment-render.md existe et documente le keep-alive', ({ assert }) => {
    assert.isTrue(existsSync(r('_docs/deployment-render.md')))
    const content = readFileSync(r('_docs/deployment-render.md'), 'utf-8')
    assert.include(content, 'cron-job.org')
    assert.include(content, 'render.com')
  })
})
