import { useTranslation } from 'react-i18next'

export default function Home() {
  const { t } = useTranslation('public')

  return (
    <>
      <div className="hero">
        <h1>{t('home.hero.title')}</h1>
        <p>{t('home.hero.subtitle')}</p>
      </div>
    </>
  )
}
