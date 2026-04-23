import { Form } from '@adonisjs/inertia/react'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const { t } = useTranslation('public')

  return (
    <div className="form-container">
      <div>
        <h1>{t('auth.login.title')}</h1>
        <p>{t('auth.login.subtitle')}</p>
      </div>

      <div>
        <Form route="session.store">
          {({ errors }) => (
            <>
              <div>
                <label htmlFor="email">{t('auth.login.email')}</label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  autoComplete="username"
                  data-invalid={errors.email ? 'true' : undefined}
                />
                {errors.email && <div>{errors.email}</div>}
              </div>

              <div>
                <label htmlFor="password">{t('auth.login.password')}</label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  autoComplete="current-password"
                />
                {errors.password ? <span>{errors.password}</span> : ''}
              </div>

              <div>
                <button type="submit" className="button">
                  {t('auth.login.submit')}
                </button>
              </div>
            </>
          )}
        </Form>
      </div>
    </div>
  )
}
