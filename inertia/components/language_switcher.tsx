import { useTranslation } from 'react-i18next'

const LANGS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      {LANGS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  )
}
