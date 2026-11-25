import { test } from '@japa/runner'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Story 13.2 (WCAG 3.1.1 / 3.1.2) — comportement des helpers purs de `inertia/lib/content_lang.ts`,
 * chargés à l'exécution par une URL calculée (frontière TS6305 limitée au typecheck).
 */
type ContentLangModule = {
  languageTag: (value: string | null | undefined) => string | null
  contentLang: (
    language: string | null | undefined,
    uiLanguage: string | null | undefined
  ) => string | undefined
  documentLang: (uiLanguage: string | null | undefined) => 'fr' | 'en'
}

const load = async (): Promise<ContentLangModule> =>
  import(pathToFileURL(resolve(process.cwd(), 'inertia/lib/content_lang.ts')).href)

test.group('content_lang | languageTag (13.2)', () => {
  test('codes stockés par le formulaire admin', async ({ assert }) => {
    const { languageTag } = await load()
    assert.equal(languageTag('fr'), 'fr')
    assert.equal(languageTag('en'), 'en')
    assert.equal(languageTag(' EN '), 'en')
  })

  test('variantes régionales normalisées en BCP 47', async ({ assert }) => {
    const { languageTag } = await load()
    assert.equal(languageTag('fr-ca'), 'fr-CA')
    assert.equal(languageTag('en_US'), 'en-US')
    assert.equal(languageTag('es-419'), 'es-419')
  })

  test('noms de langue (FR / EN, casse et accents ignorés) et codes ISO 639-2', async ({
    assert,
  }) => {
    const { languageTag } = await load()
    assert.equal(languageTag('Français'), 'fr')
    assert.equal(languageTag('FRANCAIS'), 'fr')
    assert.equal(languageTag('English'), 'en')
    assert.equal(languageTag('Anglais'), 'en')
    assert.equal(languageTag('arabe'), 'ar')
    assert.equal(languageTag('Wolof'), 'wo')
    assert.equal(languageTag('eng'), 'en')
    assert.equal(languageTag('fra'), 'fr')
  })

  test('valeur vide ou inconnue → null (aucun attribut plutôt qu’un attribut faux)', async ({
    assert,
  }) => {
    const { languageTag } = await load()
    assert.isNull(languageTag(null))
    assert.isNull(languageTag(undefined))
    assert.isNull(languageTag(''))
    assert.isNull(languageTag('   '))
    assert.isNull(languageTag('Klingon'))
    assert.isNull(languageTag('fr, en'))
    assert.isNull(languageTag('f'))
  })

  test('codes à 2 lettres inconnus → null ; région inconnue retirée (revue 13.2)', async ({
    assert,
  }) => {
    const { languageTag, contentLang } = await load()
    assert.isNull(languageTag('xx'))
    assert.isNull(languageTag('qq'))
    assert.isNull(languageTag('zz-US'))
    assert.isUndefined(contentLang('xx', 'fr'))
    assert.equal(languageTag('fr-ZZ'), 'fr')
    assert.equal(languageTag('wo'), 'wo')
  })
})

test.group('content_lang | contentLang (13.2)', () => {
  test('langue différente de l’interface → tag', async ({ assert }) => {
    const { contentLang } = await load()
    assert.equal(contentLang('en', 'fr'), 'en')
    assert.equal(contentLang('fr', 'en'), 'fr')
    assert.equal(contentLang('Français', 'en'), 'fr')
    assert.equal(contentLang('pt-BR', 'fr'), 'pt-BR')
  })

  test('même langue primaire → undefined (hérite de <html lang>)', async ({ assert }) => {
    const { contentLang } = await load()
    assert.isUndefined(contentLang('fr', 'fr'))
    assert.isUndefined(contentLang('fr-CA', 'fr'))
    assert.isUndefined(contentLang('English', 'en'))
    assert.isUndefined(contentLang('en', 'en-US'))
  })

  test('langue inconnue ou absente → undefined', async ({ assert }) => {
    const { contentLang } = await load()
    assert.isUndefined(contentLang(null, 'fr'))
    assert.isUndefined(contentLang('Klingon', 'fr'))
  })

  test('interface inconnue : la langue reconnue est posée', async ({ assert }) => {
    const { contentLang } = await load()
    assert.equal(contentLang('en', undefined), 'en')
  })
})

test.group('content_lang | documentLang (13.2)', () => {
  test('fr / en, toute autre valeur → fr', async ({ assert }) => {
    const { documentLang } = await load()
    assert.equal(documentLang('en'), 'en')
    assert.equal(documentLang('en-GB'), 'en')
    assert.equal(documentLang('fr'), 'fr')
    assert.equal(documentLang('de'), 'fr')
    assert.equal(documentLang(undefined), 'fr')
  })
})
