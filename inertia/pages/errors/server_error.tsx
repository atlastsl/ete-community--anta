import { useTranslation } from 'react-i18next'

export default function ServerError() {
  const { t } = useTranslation('public')

  return (
    <>
      <h1>{t('errors.serverError')}</h1>
    </>
  )
}
