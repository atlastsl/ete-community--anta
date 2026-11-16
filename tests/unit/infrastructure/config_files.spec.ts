import { test } from '@japa/runner'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const r = (p: string) => resolve(process.cwd(), p)

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

  test('CI exécute la suite functional (Story 2.6 — gate auth admin)', ({ assert }) => {
    const steps = ci.jobs.test.steps.map((s: any) => s.run || '')
    // La suite est un argument positionnel (`node ace test <suites...>`) ; le flag
    // `--suite` n'existe pas et faisait tourner TOUTES les suites dans le step unit.
    assert.isTrue(
      steps.some((s: string) => /node ace test\s+unit(\s|$)/.test(s)),
      'suite unit doit être lancée explicitement'
    )
    assert.isTrue(
      steps.some((s: string) => /node ace test\s+functional(\s|$)/.test(s)),
      'suite functional doit être lancée — sinon les tests middleware/login/change-password/logout sont ignorés en CI'
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
    assert.include(readme, 'docs/staging-vps.md')
  })

  test('_docs/git-workflow.md existe et documente les 3 branches', ({ assert }) => {
    assert.isTrue(existsSync(r('_docs/git-workflow.md')))
    const content = readFileSync(r('_docs/git-workflow.md'), 'utf-8')
    assert.include(content, 'master')
    assert.include(content, 'development')
    assert.include(content, 'staging')
  })

  test('Render décommissionné : plus de render.yaml ni de lien onrender.com (Story 8.5)', ({
    assert,
  }) => {
    assert.isFalse(existsSync(r('render.yaml')))
    assert.isFalse(existsSync(r('_docs/deployment-render.md')))
    // Docs vivantes seulement : _bmad-output/ et la rétrospective Render restent historiques
    const docs = [
      'README.md',
      '_docs/git-workflow.md',
      ...readdirSync(r('docs'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => `docs/${f}`),
    ]
    for (const doc of docs) {
      assert.notInclude(readFileSync(r(doc), 'utf-8'), 'onrender.com', doc)
    }
  })
})

test.group('Infrastructure | config/bodyparser.ts (limite upload)', () => {
  // La limite multipart globale doit être >= à la limite par-fichier (100 Mo,
  // cf. files_controller + FileStorageService.MAX_FILE_SIZE_BYTES). Sinon le
  // bodyparser rejette la requête en 413 "Request entity too large" avant que
  // la validation par-fichier ne produise un flash d'erreur propre.
  const parseMiB = (s: string): number => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*mb/i)
    if (!m) throw new Error(`unparseable multipart limit: ${s}`)
    return Number.parseFloat(m[1])
  }

  test('la limite multipart est >= 100 Mo (NFR3/NFR10)', ({ assert }) => {
    const src = readFileSync(r('config/bodyparser.ts'), 'utf-8')
    const limitMatch = src.match(/limit:\s*['"](\d+(?:\.\d+)?\s*mb)['"]/i)
    assert.exists(limitMatch, 'multipart.limit introuvable dans config/bodyparser.ts')
    const limit = parseMiB(limitMatch![1])
    assert.isAtLeast(
      limit,
      100,
      `multipart.limit = ${limit}mb doit être >= 100mb — sinon un upload de 20-100 Mo échoue en 413`
    )
  })
})

test.group('Infrastructure | config/session.ts (Story 2.4)', () => {
  const sessionConfigSource = readFileSync(r('config/session.ts'), 'utf-8')

  test('age est configurable via SESSION_AGE avec défaut 2h (NFR6)', ({ assert }) => {
    assert.match(
      sessionConfigSource,
      /age:\s*env\.get\(['"]SESSION_AGE['"],\s*['"]2h['"]\)/,
      "config/session.ts doit lire SESSION_AGE avec défaut '2h'"
    )
  })

  test('clearWithBrowser est désactivé (session persistante au-delà de la fermeture)', ({
    assert,
  }) => {
    assert.match(sessionConfigSource, /clearWithBrowser:\s*false/)
  })

  test('cookie httpOnly est activé (protection XSS)', ({ assert }) => {
    assert.match(sessionConfigSource, /httpOnly:\s*true/)
  })

  test('cookie sameSite est lax (défense en profondeur contre CSRF)', ({ assert }) => {
    assert.match(sessionConfigSource, /sameSite:\s*['"]lax['"]/)
  })

  test('cookie secure est activé en production', ({ assert }) => {
    assert.match(sessionConfigSource, /secure:\s*app\.inProduction/)
  })

  test('SESSION_AGE est déclaré comme variable optionnelle dans start/env.ts', ({ assert }) => {
    const envSource = readFileSync(r('start/env.ts'), 'utf-8')
    assert.match(envSource, /SESSION_AGE:\s*Env\.schema\.string\.optional\(\)/)
  })
})
