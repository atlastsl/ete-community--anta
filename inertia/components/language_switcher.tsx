import { useTranslation } from 'react-i18next'

const LANGS = ['fr', 'en'] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div>
      {LANGS.map((lang) => (
        <button
          key={lang}
          onClick={() => i18n.changeLanguage(lang)}
          aria-current={i18n.language === lang ? 'true' : undefined}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
