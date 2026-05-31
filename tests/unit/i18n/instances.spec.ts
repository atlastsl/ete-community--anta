import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createI18nInstance } from '../../../inertia/lib/i18n/shared.js'

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8'))
}

const frPublic = loadJson('inertia/locales/public/fr.json')
const enPublic = loadJson('inertia/locales/public/en.json')
const frAdmin = loadJson('inertia/locales/admin/fr.json')
const enAdmin = loadJson('inertia/locales/admin/en.json')

test.group('i18n instances | public', () => {
  test('initialise et résout une clé en français', async ({ assert }) => {
    const i18n = createI18nInstance({
      fr: { translation: frPublic },
      en: { translation: enPublic },
    })
    await i18n.changeLanguage('fr')

    assert.equal(i18n.t('nav.search'), 'Rechercher')
    assert.equal(i18n.t('actions.download'), 'Télécharger')
  })

  test('bascule en anglais via changeLanguage', async ({ assert }) => {
    const i18n = createI18nInstance({
      fr: { translation: frPublic },
      en: { translation: enPublic },
    })
    await i18n.changeLanguage('en')

    assert.equal(i18n.t('nav.search'), 'Search')
    assert.equal(i18n.t('actions.clear_filters'), 'Clear filters')
  })

  test('retourne la clé brute si elle n’existe pas', async ({ assert }) => {
    const i18n = createI18nInstance({
      fr: { translation: frPublic },
      en: { translation: enPublic },
    })
    await i18n.changeLanguage('fr')

    assert.equal(i18n.t('this.key.does.not.exist'), 'this.key.does.not.exist')
  })
})

test.group('i18n instances | admin', () => {
  test('initialise et résout une clé admin en français', async ({ assert }) => {
    const i18n = createI18nInstance({
      fr: { translation: frAdmin },
      en: { translation: enAdmin },
    })
    await i18n.changeLanguage('fr')

    assert.equal(i18n.t('nav.productions'), 'Productions')
    assert.equal(i18n.t('actions.save'), 'Enregistrer')
  })

  test('admin bascule en anglais', async ({ assert }) => {
    const i18n = createI18nInstance({
      fr: { translation: frAdmin },
      en: { translation: enAdmin },
    })
    await i18n.changeLanguage('en')

    assert.equal(i18n.t('nav.logout'), 'Sign out')
  })
})
