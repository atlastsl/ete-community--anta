import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation('public')

  return (
    <>
      <h1>{t('errors.notFound')}</h1>
    </>
  )
}
