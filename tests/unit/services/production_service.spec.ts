import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Production from '#models/production'
import ProductionService from '#services/production_service'

function makeProduction(overrides: Partial<Production> = {}): Production {
  const p = new Production()
  p.title = ''
  p.summary = null
  p.authors = []
  p.tags = []
  p.category = null
  p.domain = null
  p.subdomain = []
  p.language = null
  p.publicationCountry = null
  p.licenseStatus = 'member'
  p.workPublishedAt = null
  Object.assign(p, overrides)
  return p
}

function makeComplete(license: 'member' | 'free_license' | 'external_link' = 'member'): Production {
  return makeProduction({
    title: 'T',
    summary: 'S',
    authors: ['A'],
    tags: ['x'],
    category: 'article',
    domain: 'Maths',
    subdomain: ['Topo'],
    language: 'fr',
    publicationCountry: 'SN',
    licenseStatus: license,
    workPublishedAt: DateTime.fromISO('2024-01-01'),
  })
}

test.group('ProductionService | getMissingForPublish', () => {
  test('production vide → tous les champs requis manquants + attachement', ({ assert }) => {
    const missing = ProductionService.getMissingForPublish(makeProduction(), false, false)
    for (const key of [
      'title',
      'category',
      'domain',
      'subdomain',
      'language',
      'publicationCountry',
      'summary',
      'authors',
      'tags',
      'workPublishedAt',
      'attachment',
    ]) {
      assert.include(missing, key)
    }
  })

  test('production complète + fichier → aucun manquant', ({ assert }) => {
    const missing = ProductionService.getMissingForPublish(makeComplete(), true, false)
    assert.lengthOf(missing, 0)
  })

  test('production complète + lien → aucun manquant', ({ assert }) => {
    const missing = ProductionService.getMissingForPublish(makeComplete(), false, true)
    assert.lengthOf(missing, 0)
  })

  test('external_link + fichier seul → attachement manquant', ({ assert }) => {
    const missing = ProductionService.getMissingForPublish(
      makeComplete('external_link'),
      true,
      false
    )
    assert.deepEqual(missing, ['attachment'])
  })

  test('external_link + lien → aucun manquant', ({ assert }) => {
    const missing = ProductionService.getMissingForPublish(
      makeComplete('external_link'),
      false,
      true
    )
    assert.lengthOf(missing, 0)
  })
})

test.group('ProductionService | generateSlug', () => {
  test('retire les accents et met en minuscules', ({ assert }) => {
    assert.equal(ProductionService.generateSlug('Étude sur l’Économie'), 'etude-sur-l-economie')
  })

  test('remplace ponctuation/espaces par des tirets, sans tirets en bordure', ({ assert }) => {
    assert.equal(ProductionService.generateSlug('  Hello,   World!  '), 'hello-world')
  })

  test('titre vide ou non-alphanumérique → fallback', ({ assert }) => {
    assert.equal(ProductionService.generateSlug(''), 'production')
    assert.equal(ProductionService.generateSlug('!!! ??? ...'), 'production')
  })
})

test.group('ProductionService | generateUniqueSlug', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('slug libre → slug de base', async ({ assert }) => {
    const slug = await ProductionService.generateUniqueSlug('Un Titre Vraiment Unique 12345')
    assert.equal(slug, 'un-titre-vraiment-unique-12345')
  })

  test('collision → suffixe incrémenté', async ({ assert }) => {
    await Production.create({
      title: 'Titre En Double XYZ',
      authors: [],
      tags: [],
      subdomain: [],
      licenseStatus: 'member',
      status: 'draft',
    })
    const slug = await ProductionService.generateUniqueSlug('Titre En Double XYZ')
    assert.equal(slug, 'titre-en-double-xyz-2')
  })
})
