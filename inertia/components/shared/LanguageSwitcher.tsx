import { useTranslation } from 'react-i18next'

const LANGUAGES = ['fr', 'en'] as const

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <nav aria-label={t('language_switcher.label')} className="flex items-center gap-1 text-sm">
      {LANGUAGES.map((lang, idx) => {
        const active = current === lang
        return (
          <span key={lang} className="flex items-center gap-1">
            {idx > 0 && <span className="text-stone-300" aria-hidden>|</span>}
            <button
              type="button"
              onClick={() => i18n.changeLanguage(lang)}
              aria-current={active ? 'true' : undefined}
              className={
                active
                  ? 'inline-flex min-h-11 items-center px-2 font-semibold text-green-700'
                  : 'inline-flex min-h-11 items-center px-2 text-stone-600 hover:text-stone-900'
              }
            >
              {lang.toUpperCase()}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
