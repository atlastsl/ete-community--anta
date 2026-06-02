import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'inertia/components/shared/LanguageSwitcher.tsx'),
  'utf-8'
)

test.group('LanguageSwitcher | source analysis', () => {
  test('uses useTranslation from react-i18next', ({ assert }) => {
    assert.include(source, 'useTranslation')
    assert.include(source, 'react-i18next')
  })

  test('calls i18n.changeLanguage for language switching', ({ assert }) => {
    assert.include(source, 'i18n.changeLanguage')
  })

  test('uses aria-current for active language indication', ({ assert }) => {
    assert.include(source, 'aria-current')
  })

  test('supports both FR and EN languages', ({ assert }) => {
    assert.include(source, "'fr'")
    assert.include(source, "'en'")
  })

  test('renders accessible nav with aria-label', ({ assert }) => {
    assert.include(source, 'aria-label')
    assert.include(source, '<nav')
  })

  test('uses button elements with type="button"', ({ assert }) => {
    assert.include(source, '<button')
    assert.include(source, 'type="button"')
  })
})
